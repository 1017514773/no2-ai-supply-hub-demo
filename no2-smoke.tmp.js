/**
 * 冒烟测试（Node 环境直连 mock dispatch）：
 * 覆盖基础链路、多仓/组织、下单自提联动、企微客服、AI 工作台、供应商协同。
 * 运行：node no2-smoke.tmp.js（PowerShell: node no2-smoke.tmp.js; echo "exit=$LASTEXITCODE"）
 */

// ---- 模拟小程序 Storage（内存态） ----
const store = {};
global.wx = {
  getStorageSync: (k) => (store[k] === undefined ? '' : store[k]),
  setStorageSync: (k, v) => {
    store[k] = v;
  },
  removeStorageSync: (k) => {
    delete store[k];
  }
};

const { dispatch } = require('./miniprogram/mock/index.js');
const db = require('./miniprogram/mock/db.js');
const env = require('./miniprogram/config/env.js');

let passed = 0;
let failed = 0;

function ok(name, cond, extra) {
  if (cond) {
    passed += 1;
    console.log('  OK  ' + name);
  } else {
    failed += 1;
    console.log('  FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}

function call(method, url, data) {
  return dispatch({ url, method, data: data || {} });
}

async function expectErr(method, url, data) {
  try {
    await call(method, url, data);
    return null;
  } catch (e) {
    return e;
  }
}

(async function main() {
  console.log('\n[1] 基础链路');
  const products = await call('GET', '/products', {});
  ok('商品列表非空', products.list.length > 0, products.list.length);
  const groups = await call('GET', '/groups', {});
  ok('团购列表非空', groups.list.length > 0, groups.list.length);
  const exp = await call('GET', '/reconcile/export');
  ok('对账导出使用当前仓地区', exp.csv.indexOf('上海宝山 对账中心导出') === 0, exp.csv.slice(0, 30));

  console.log('\n[2] 多仓网络与组织权限');
  const wh = await call('GET', '/platform/warehouses');
  ok('仓库数 3', wh.list.length === 3, wh.list.length);
  ok('默认仓 wh_1', wh.defaultId === 'wh_1' && wh.list[0].isDefault === true, wh.defaultId);
  ok('城市覆盖 3 城', wh.cities.length === 3, wh.cities.length);
  ok('组织角色 5 个', wh.org.roles.length === 5, wh.org.roles.length);
  const sw = await call('POST', '/platform/warehouses/switch', { id: 'wh_2' });
  ok('切换到 wh_2', sw.defaultId === 'wh_2' && sw.changed === true, sw);
  const pp2 = await call('GET', '/platform/pickup-point');
  ok('自提点接口随默认仓（昆山）', pp2 && pp2.name.indexOf('昆山') >= 0, pp2 && pp2.name);
  const exp2 = await call('GET', '/reconcile/export');
  ok('对账导出随默认仓（昆山）', exp2.csv.indexOf('苏州昆山 对账中心导出') === 0, exp2.csv.slice(0, 30));

  console.log('\n[3] 下单自提联动默认仓');
  // 批发起订 ¥1000：选不限购且库存充足的商品，按起订额计算购买数量
  const minNeed = 100000;
  const sellable =
    products.list.find((p) => {
      const q = Math.max(1, Math.ceil(minNeed / p.priceFen));
      return p.stock > 0 && !p.limitPerUser && p.stock >= q;
    }) || products.list.find((p) => p.stock > 0);
  const buyQty = Math.max(1, Math.ceil(minNeed / sellable.priceFen));
  const prev = await call('POST', '/orders/preview', {
    items: [{ productId: sellable.id, qty: buyQty }],
    fulfillment: 'PICKUP'
  });
  ok(
    '自提点随默认仓联动（含昆山）',
    prev.pickupPoint && prev.pickupPoint.name.indexOf('昆山') >= 0,
    prev.pickupPoint
  );
  const ord = await call('POST', '/orders', {
    items: [{ productId: sellable.id, qty: buyQty }],
    fulfillment: 'PICKUP'
  });
  const od1 = await call('GET', '/orders/' + ord.id);
  ok(
    '订单自提点为下单时仓库（昆山）',
    od1.pickupPoint && od1.pickupPoint.name.indexOf('昆山') >= 0,
    od1.pickupPoint && od1.pickupPoint.name
  );
  await call('POST', '/platform/warehouses/switch', { id: 'wh_1' });
  const pp1 = await call('GET', '/platform/pickup-point');
  ok('自提点接口回切中心仓', pp1 && pp1.name.indexOf('样板仓') >= 0, pp1 && pp1.name);
  const od2 = await call('GET', '/orders/' + ord.id);
  ok(
    '历史订单自提点保持下单快照',
    od2.pickupPoint && od2.pickupPoint.name.indexOf('昆山') >= 0,
    od2.pickupPoint && od2.pickupPoint.name
  );
  const minErr = await expectErr('POST', '/orders', {
    items: [{ productId: sellable.id, qty: 1 }],
    fulfillment: 'PICKUP'
  });
  ok('批发订单不足 ¥1000 被拦截', !!minErr && minErr.code === 'MIN_ORDER', minErr && minErr.code);

  console.log('\n[4] 企微客服');
  const convs = await call('GET', '/wecom/conversations');
  ok('会话数 5', convs.list.length === 5, convs.list.length);
  ok('待回复数 >= 1', convs.pendingCount >= 1, convs.pendingCount);
  const convId = convs.list[0].id;
  const conv = await call('GET', '/wecom/conversations/' + convId);
  ok('会话详情含消息', conv.messages.length > 0, conv.messages.length);
  const draft = await call('POST', '/wecom/conversations/' + convId + '/draft');
  ok('AI 草稿 2 版', draft.drafts.length === 2, draft.drafts.length);
  const rep = await call('POST', '/wecom/conversations/' + convId + '/reply', {
    text: '冒烟测试回复'
  });
  const lastMsg = rep.conversation.messages[rep.conversation.messages.length - 1];
  ok('回复后末条为我方', lastMsg.mine === true && lastMsg.text === '冒烟测试回复');
  const grps = await call('GET', '/wecom/groups');
  ok('社群数 3', grps.list.length === 3, grps.list.length);
  const bc = await call('POST', '/wecom/groups/' + grps.list[0].id + '/broadcast', {
    type: 'PROGRESS'
  });
  ok('群发文案已生成', !!bc.sentText && bc.sentText.indexOf('进度') >= 0, bc.sentText);

  console.log('\n[5] AI 工作台');
  const copy = await call('POST', '/ai/copy', { productId: sellable.id, style: 'WARM' });
  ok('文案 3 版', copy.versions.length === 3, copy.versions.length);
  ok(
    '占位符已全部填充',
    copy.versions.every((v) => v.text.indexOf('{') < 0 && v.text.length > 10),
    copy.versions.map((v) => v.text.slice(0, 12))
  );
  const poster = await call('POST', '/ai/poster', { groupId: groups.list[0].id });
  ok(
    '海报标题含团购名',
    poster.pack.title.indexOf(groups.list[0].title) >= 0,
    poster.pack.title
  );
  ok('海报备选 3 条', poster.alternates.length === 3, poster.alternates.length);
  const copyErr = await expectErr('POST', '/ai/copy', {});
  ok('未选商品被拦截', !!copyErr && copyErr.code === 'VALIDATION_ERROR', copyErr);

  console.log('\n[6] 供应商协同');
  const portal = await call('GET', '/supplier/portal');
  ok('协同伙伴 4 个', portal.list.length === 4, portal.list.length);
  ok('待对账 >= 1', portal.summary.pendingCount >= 1, portal.summary.pendingCount);
  const pending = portal.list.find((x) => x.status === 'PENDING');
  const detail = await call('GET', '/supplier/partners/' + pending.id);
  ok('对账单含供货明细', detail.items.length > 0, detail.items.length);
  ok('对账单含历史记录', detail.records.length > 0, detail.records.length);
  const cfm = await call('POST', '/supplier/partners/' + pending.id + '/confirm');
  ok('确认后状态 RECONCILED', cfm.partner.status === 'RECONCILED', cfm.partner.status);
  const audit = db.load().auditLogs[0];
  ok('确认写入审计日志', audit && audit.action === '供货对账确认', audit);
  const dup = await expectErr('POST', '/supplier/partners/' + pending.id + '/confirm');
  ok('重复确认被拦截', !!dup && dup.code === 'CONFLICT', dup);

  console.log('\n结果: passed=' + passed + ' failed=' + failed);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => {
  console.error('冒烟测试异常终止:', e);
  process.exit(2);
});
