/** 平台概况与数据看板：首页 Hero 统计（基准值 + 当日实时聚合）；看板日/周/月口径；多仓网络与组织权限 */

const db = require('../db');
const { fail, DAY } = require('../utils');
const fmt = require('../../utils/format');
const WH = require('../warehouses');

/** 时间戳是否为今天 */
function isToday(ts) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** 日 / 周 / 月看板基准值（除当日外的历史经营数据为预置口径） */
const DASH_BASE = {
  today: { orders: 328, gmvFen: 86000000, refundCount: 2, refundFen: 8900, commissionFen: 45200, groupOrders: 86, groupQty: 412 },
  week: { orders: 1968, gmvFen: 512000000, refundCount: 11, refundFen: 45600, commissionFen: 268000, groupOrders: 512, groupQty: 2460 },
  month: { orders: 8236, gmvFen: 2180000000, refundCount: 46, refundFen: 189000, commissionFen: 1120000, groupOrders: 2180, groupQty: 10680 }
};

/** 近 7 日 GMV 基准（含今日，今日值与 platform.baseTodayGmvFen 对齐） */
const WEEK_BARS_BASE = [82000000, 91600000, 78400000, 95800000, 88200000, 102600000, 86000000];

/** 组织角色与权限范围（当前账号为店主；正式版按组织架构分配账号） */
const ORG_ROLES = [
  { key: 'OWNER', name: '店主', desc: '全部模块，含财务与账号权限分配', modules: ['商品', '订单', '团购', '分销', '库存', '客服', '财务', '数据'] },
  { key: 'OPS', name: '运营', desc: '商品与团购运营、数据看板；不含财务与权限分配', modules: ['商品', '订单', '团购', '分销', '数据'] },
  { key: 'SERVICE', name: '客服', desc: '企微会话、售后审核、客户归属纠错', modules: ['企微客服', '售后审核', '归属纠错'] },
  { key: 'WAREHOUSE', name: '仓储', desc: '库存、盘点、寄存与出库作业', modules: ['库存', '盘点', '寄存', '出库'] },
  { key: 'FINANCE', name: '财务', desc: '对账中心、佣金结算、OPC 台账、提现审核', modules: ['对账', '佣金', 'OPC 台账', '提现审核'] }
];

module.exports = function (on) {
  on('GET', '/platform/overview', () => {
    const d = db.load();
    const todayPaid = d.orders.filter((o) => o.paidAt && isToday(o.paidAt));
    const todayGmvFen = todayPaid.reduce((s, o) => s + (o.payableFen || 0), 0);
    return {
      todayOrders: d.platform.baseTodayOrders + todayPaid.length,
      todayGmvFen: d.platform.baseTodayGmvFen + todayGmvFen,
      cities: d.platform.cities
    };
  });

  /** 数据看板：日 / 周 / 月三口径，取数与订单 / 退款 / 佣金流水同源 */
  on('GET', '/platform/dashboard', () => {
    const d = db.load();
    const now = Date.now();

    function rangeAgg(since, key) {
      const paid = d.orders.filter((o) => o.paidAt >= since);
      const gmvFen = paid.reduce((s, o) => s + (o.payableFen || 0), 0);
      const groupOrders = paid.filter((o) => o.groupId);
      const refunds = d.afterSales.filter((a) => a.status === 'REFUNDED' && (a.reviewedAt || a.createdAt) >= since);
      const settled = d.commissions.filter((c) => c.status === 'SETTLED' && (c.settledAt || c.createdAt) >= since);
      const b = DASH_BASE[key];
      return {
        orders: b.orders + paid.length,
        gmvFen: b.gmvFen + gmvFen,
        refundCount: b.refundCount + refunds.length,
        refundFen: b.refundFen + refunds.reduce((s, a) => s + a.amountFen, 0),
        commissionFen: b.commissionFen + settled.reduce((s, c) => s + Math.max(0, c.amountFen), 0),
        groupOrders: b.groupOrders + groupOrders.length,
        groupQty: b.groupQty + groupOrders.reduce((s, o) => s + o.items.reduce((x, i) => x + i.qty, 0), 0)
      };
    }

    function gmvOn(dayStart) {
      return d.orders
        .filter((o) => o.paidAt >= dayStart && o.paidAt < dayStart + DAY)
        .reduce((s, o) => s + (o.payableFen || 0), 0);
    }

    const bars = [];
    for (let i = 6; i >= 0; i--) {
      const ds = startOfDay(now - i * DAY);
      bars.push({
        label: fmt.formatDate(ds).slice(5),
        gmvFen: WEEK_BARS_BASE[6 - i] + gmvOn(ds)
      });
    }

    return {
      today: rangeAgg(startOfDay(now), 'today'),
      week: rangeAgg(startOfDay(now - 6 * DAY), 'week'),
      month: rangeAgg(startOfDay(now - 29 * DAY), 'month'),
      weekBars: bars,
      updatedAt: now
    };
  });

  /** 多仓网络：仓库节点（中心仓实时聚合商品 / 寄存口径）+ 城市覆盖 + 组织权限 */
  on('GET', '/platform/warehouses', () => {
    const d = db.load();
    const def = WH.getDefault(d);
    const liveStats = {
      skuCount: d.products.filter((p) => p.status === 'ON').length,
      stockQty: d.products.reduce((s, p) => s + (p.stock || 0), 0),
      lotCount: d.inventoryLots.filter((l) => l.status === 'IN_STOCK').length
    };
    const list = WH.WAREHOUSES.map((w) => {
      const stat = w.id === 'wh_1' ? liveStats : WH.SPOKE_STATS[w.id] || liveStats;
      return Object.assign({}, w, stat, {
        isDefault: w.id === def.id,
        rolePill: w.role === 'HUB' ? 'ok' : 'gray'
      });
    });
    const cityMap = {};
    list.forEach((w) => {
      if (!cityMap[w.city]) cityMap[w.city] = [];
      cityMap[w.city].push(w.name);
    });
    const cities = Object.keys(cityMap).map((city) => ({
      city,
      count: cityMap[city].length,
      names: cityMap[city].join('、')
    }));
    return {
      totalCities: d.platform.cities,
      defaultId: def.id,
      summary: {
        warehouseCount: list.length,
        skuCount: list.reduce((s, w) => s + w.skuCount, 0),
        stockQty: list.reduce((s, w) => s + w.stockQty, 0),
        lotCount: list.reduce((s, w) => s + w.lotCount, 0)
      },
      list,
      cities,
      org: {
        account: d.user.nickname + ' · 店主',
        roles: ORG_ROLES.map((r) => Object.assign({}, r, { current: r.key === 'OWNER' }))
      }
    };
  });

  /** 自提点：当前默认仓的展示口径（商品详情 / 团购详情等说明文案联动用） */
  on('GET', '/platform/pickup-point', () => {
    const d = db.load();
    return WH.pickupView(WH.getDefault(d));
  });

  /** 后台操作：切换默认仓（影响后续新订单自提点与寄存批次归属，历史记录不变） */
  on('POST', '/platform/warehouses/switch', (ctx) => {
    const d = db.load();
    const w = WH.WAREHOUSES.find((x) => x.id === ctx.data.id);
    if (!w) throw fail('NOT_FOUND', '仓库不存在');
    if (d.defaultWarehouseId === w.id) {
      return { defaultId: w.id, name: w.name, changed: false };
    }
    d.defaultWarehouseId = w.id;
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: d.user.nickname + '（店主）',
      action: '切换默认仓',
      detail: '默认仓切换为「' + w.name + '」，后续新订单自提点与寄存批次归属该仓'
    });
    db.save();
    return { defaultId: w.id, name: w.name, changed: true };
  });
};
