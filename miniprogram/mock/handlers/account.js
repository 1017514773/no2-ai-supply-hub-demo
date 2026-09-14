/** Mock 处理器：登录、用户、地址、寄存库存、OPC 台账 */

const db = require('../db');
const { fail } = require('../utils');
const fmt = require('../../utils/format');
const WH = require('../warehouses');

function publicUser(d) {
  const u = d.user;
  return {
    id: u.id,
    nickname: u.nickname,
    avatarText: u.avatarText,
    agentNo: u.agentNo,
    phone: u.phone,
    role: u.role,
    badge: u.badge,
    realnameStatus: u.realnameStatus
  };
}

function validateAddress(payload) {
  if (!payload.name) throw fail('VALIDATION_ERROR', '请填写收货人姓名');
  if (!/^1\d{10}$/.test(String(payload.phone || ''))) {
    throw fail('VALIDATION_ERROR', '请填写正确的 11 位手机号');
  }
  if (!payload.region) throw fail('VALIDATION_ERROR', '请选择所在地区');
  if (!payload.detail) throw fail('VALIDATION_ERROR', '请填写详细地址');
}

module.exports = function (on) {
  on('POST', '/auth/wechat/login', () => {
    const d = db.load();
    return { token: d.token, user: publicUser(d) };
  });

  on('GET', '/me', () => {
    const d = db.load();
    return {
      user: publicUser(d),
      agent: { status: d.agentQual.status, agentNo: d.user.agentNo }
    };
  });

  // ===== 数据重置 =====
  on('POST', '/demo/reset', () => {
    db.reset();
    return { ok: true, message: '数据已重置为初始状态' };
  });

  // ===== 收货地址 =====
  on('GET', '/addresses', () => {
    const d = db.load();
    const list = d.addresses.slice().sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
    return db.clone(list);
  });

  on('POST', '/addresses', (ctx) => {
    const d = db.load();
    validateAddress(ctx.data);
    const addr = {
      id: 'addr_' + db.nextSeq(),
      name: ctx.data.name,
      phone: String(ctx.data.phone),
      region: ctx.data.region,
      detail: ctx.data.detail,
      tag: ctx.data.tag || '',
      isDefault: !!ctx.data.isDefault || d.addresses.length === 0
    };
    if (addr.isDefault) d.addresses.forEach((a) => (a.isDefault = false));
    d.addresses.push(addr);
    db.save();
    return db.clone(addr);
  });

  on('PUT', '/addresses/:id', (ctx) => {
    const d = db.load();
    const addr = d.addresses.find((a) => a.id === ctx.params.id);
    if (!addr) throw fail('NOT_FOUND', '地址不存在');
    validateAddress(Object.assign({}, addr, ctx.data));
    Object.assign(addr, {
      name: ctx.data.name,
      phone: String(ctx.data.phone),
      region: ctx.data.region,
      detail: ctx.data.detail,
      tag: ctx.data.tag || addr.tag
    });
    db.save();
    return db.clone(addr);
  });

  on('DELETE', '/addresses/:id', (ctx) => {
    const d = db.load();
    const idx = d.addresses.findIndex((a) => a.id === ctx.params.id);
    if (idx < 0) throw fail('NOT_FOUND', '地址不存在');
    const wasDefault = d.addresses[idx].isDefault;
    d.addresses.splice(idx, 1);
    if (wasDefault && d.addresses.length) d.addresses[0].isDefault = true;
    db.save();
    return { ok: true };
  });

  on('POST', '/addresses/:id/default', (ctx) => {
    const d = db.load();
    const addr = d.addresses.find((a) => a.id === ctx.params.id);
    if (!addr) throw fail('NOT_FOUND', '地址不存在');
    d.addresses.forEach((a) => (a.isDefault = a.id === addr.id));
    db.save();
    return db.clone(addr);
  });

  // ===== 寄存库存（分销员仓内寄存批次） =====
  on('GET', '/inventory/lots', () => {
    const d = db.load();
    const lots = d.inventoryLots.filter((l) => l.ownerId === d.user.id);
    return {
      list: db.clone(lots),
      totalRemain: lots.reduce((s, l) => s + l.remain, 0),
      warehouse: WH.getDefault(d).name
    };
  });

  // ===== 库存流水（预占 / 释放 / 出库 / 寄存 / 盘点） =====
  on('GET', '/inventory/ledger', () => {
    const d = db.load();
    const list = d.stockLedger.slice().sort((a, b) => b.at - a.at);
    return {
      list: db.clone(list),
      total: list.length,
      warehouse: WH.getDefault(d).name
    };
  });

  /** 后台操作：发起现场盘点（生成盘点流水并写入审计日志） */
  on('POST', '/inventory/stocktake', (ctx) => {
    const d = db.load();
    const now = Date.now();
    const batchNo = 'PD' + fmt.formatDate(now).replace(/-/g, '') + '-' + (d.seq % 1000);
    const ids = ctx.data.productIds || d.products.filter((p) => p.status === 'ON').slice(0, 3).map((p) => p.id);
    const rows = [];
    ids.forEach((id) => {
      const p = d.products.find((x) => x.id === id);
      if (!p) return;
      d.stockLedger.unshift({
        id: 'sl_' + db.nextSeq(),
        at: now,
        type: 'STOCKTAKE',
        productId: p.id,
        productName: p.name,
        qty: 0,
        refNo: batchNo,
        note: '现场盘点：账面 ' + p.stock + ' 件（预占 ' + (p.reserved || 0) + ' 件），实盘一致，无差异'
      });
      rows.push({ productId: p.id, name: p.name, stock: p.stock });
    });
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: now,
      operator: '仓管-小陈',
      action: '库存盘点',
      detail: '盘点批次 ' + batchNo + '：抽查 ' + rows.length + ' 个在售 SKU，账实一致，盘点流水已记录'
    });
    db.save();
    return { batchNo, count: rows.length, rows: db.clone(rows) };
  });

  // ===== OPC 主体台账（二期能力入口） =====
  on('GET', '/opc/ledger', () => {
    const d = db.load();
    const list = d.opcLedger.slice().sort((a, b) => b.date - a.date);
    const incomeFen = list.filter((x) => x.amountFen > 0).reduce((s, x) => s + x.amountFen, 0);
    const expenseFen = list.filter((x) => x.amountFen < 0).reduce((s, x) => s + x.amountFen, 0);
    return {
      subject: '金轮椅（上海）供应链管理有限公司 · OPC 主体',
      summary: { incomeFen, expenseFen, balanceFen: incomeFen + expenseFen },
      list: db.clone(list)
    };
  });

  on('GET', '/opc/export', () => {
    const d = db.load();
    const header = '日期,类型,金额(元),凭证号,备注';
    const rows = d.opcLedger
      .slice()
      .sort((a, b) => a.date - b.date)
      .map((x) =>
        [fmt.formatDate(x.date), x.type, fmt.fenToYuan(x.amountFen), x.voucherNo, x.note].join(',')
      );
    const csv = [header].concat(rows).join('\n');
    return {
      fileName: 'OPC台账_' + fmt.formatDate(Date.now()) + '.csv',
      csv,
      rowCount: rows.length
    };
  });
};
