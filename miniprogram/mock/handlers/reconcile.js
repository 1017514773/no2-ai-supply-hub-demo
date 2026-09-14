/** Mock 处理器：对账中心（订单 / 退款 / 佣金 / 库存四账，CSV 导出与页面汇总同源） */

const db = require('../db');
const fmt = require('../../utils/format');
const C = require('../../config/constants');
const WH = require('../warehouses');
const social = require('./social');

/** 四账聚合：页面汇总与 CSV 导出使用同一份数据，保证「导出数据与后台汇总金额一致」 */
function buildReconcile(d) {
  const now = Date.now();

  // 订单账：支付口径（含后续退款单），取消 / 待付款不计入
  const paidOrders = d.orders
    .filter((o) => o.paidAt)
    .sort((a, b) => b.paidAt - a.paidAt);
  const countable = paidOrders.filter((o) => o.countable);
  const orders = {
    paidCount: paidOrders.length,
    gmvFen: paidOrders.reduce((s, o) => s + (o.payableFen || 0), 0),
    productAmountFen: paidOrders.reduce((s, o) => s + o.productAmountFen, 0),
    freightFen: paidOrders.reduce((s, o) => s + (o.freightFen || 0), 0),
    countableCount: countable.length,
    countableAmountFen: countable.reduce((s, o) => s + o.productAmountFen, 0),
    rows: paidOrders.map((o) => ({
      orderNo: o.orderNo,
      statusLabel: C.ORDER_STATUS_LABEL[o.status] || o.status,
      payableFen: o.payableFen,
      countable: o.countable,
      paidAt: o.paidAt
    }))
  };

  // 退款账
  const refundList = d.afterSales
    .filter((a) => a.status === 'REFUNDED')
    .sort((a, b) => (b.reviewedAt || b.createdAt) - (a.reviewedAt || a.createdAt));
  const refundAmountFen = refundList.reduce((s, a) => s + a.amountFen, 0);
  const refunds = {
    count: refundList.length,
    amountFen: refundAmountFen,
    ratePct: orders.gmvFen > 0 ? Math.round((refundAmountFen / orders.gmvFen) * 10000) / 100 : 0,
    rows: refundList.map((a) => ({
      id: a.id,
      orderNo: a.orderNo,
      reason: a.reason,
      amountFen: a.amountFen,
      refundNo: a.refundNo,
      reviewedAt: a.reviewedAt || a.createdAt
    }))
  };

  // 佣金账：与收益看板同一口径（历史基线 + 流水合计）
  const totals = social.earningsTotals(d);
  const commissions = {
    estimatedFen: totals.estimatedFen,
    frozenFen: totals.frozenFen,
    readyFen: totals.readyFen,
    settledFen: totals.settledFen,
    reversedFen: totals.reversedFen,
    rows: d.commissions
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((c) => ({
        id: c.id,
        orderNo: c.orderNo || '-',
        typeLabel: C.COMMISSION_TYPE_LABEL[c.type] || c.type,
        statusLabel: C.COMMISSION_STATUS_LABEL[c.status] || c.status,
        amountFen: c.amountFen,
        createdAt: c.createdAt
      }))
  };

  // 库存账：在售 SKU 账面 / 预占 / 可用 + 寄存批次
  const onSale = d.products.filter((p) => p.status === 'ON');
  const stockQty = onSale.reduce((s, p) => s + (p.stock || 0), 0);
  const reservedQty = onSale.reduce((s, p) => s + (p.reserved || 0), 0);
  const inventory = {
    skuCount: onSale.length,
    stockQty,
    reservedQty,
    availableQty: stockQty - reservedQty,
    lotCount: d.inventoryLots.length,
    lotRemainQty: d.inventoryLots.reduce((s, l) => s + l.remain, 0),
    rows: onSale.map((p) => ({
      name: p.name,
      spec: p.spec,
      stock: p.stock,
      reserved: p.reserved || 0,
      available: Math.max(0, (p.stock || 0) - (p.reserved || 0)),
      unit: p.unit
    }))
  };

  return { generatedAt: now, orders, refunds, commissions, inventory };
}

/** CSV：与页面汇总同一数据源（buildReconcile），保证导出与汇总一致；表头地区随默认仓联动 */
function buildCsv(res, area) {
  const L = [];
  L.push(area + ' 对账中心导出,生成时间,' + fmt.formatTime(res.generatedAt));
  L.push('账目,指标,数值');
  L.push(['订单账', '已支付订单数', res.orders.paidCount].join(','));
  L.push(['订单账', '订单总额(元)', fmt.fenToYuan(res.orders.gmvFen)].join(','));
  L.push(['订单账', '商品金额(元)', fmt.fenToYuan(res.orders.productAmountFen)].join(','));
  L.push(['订单账', '运费(元)', fmt.fenToYuan(res.orders.freightFen)].join(','));
  L.push(['订单账', '可计入业绩商品金额(元)', fmt.fenToYuan(res.orders.countableAmountFen)].join(','));
  L.push(['退款账', '退款单数', res.refunds.count].join(','));
  L.push(['退款账', '退款总额(元)', fmt.fenToYuan(res.refunds.amountFen)].join(','));
  L.push(['退款账', '退款率(%)', res.refunds.ratePct].join(','));
  L.push(['佣金账', '预计佣金(元)', fmt.fenToYuan(res.commissions.estimatedFen)].join(','));
  L.push(['佣金账', '冻结中(元)', fmt.fenToYuan(res.commissions.frozenFen)].join(','));
  L.push(['佣金账', '可结算(元)', fmt.fenToYuan(res.commissions.readyFen)].join(','));
  L.push(['佣金账', '已结算(元)', fmt.fenToYuan(res.commissions.settledFen)].join(','));
  L.push(['佣金账', '已冲销(元)', fmt.fenToYuan(res.commissions.reversedFen)].join(','));
  L.push(['库存账', '在售SKU', res.inventory.skuCount].join(','));
  L.push(['库存账', '在库件数', res.inventory.stockQty].join(','));
  L.push(['库存账', '预占件数', res.inventory.reservedQty].join(','));
  L.push(['库存账', '可用件数', res.inventory.availableQty].join(','));
  L.push(['库存账', '寄存批次', res.inventory.lotCount].join(','));
  L.push(['库存账', '寄存剩余件数', res.inventory.lotRemainQty].join(','));
  L.push('');
  L.push('【订单账明细】');
  L.push('订单号,状态,实付(元),可计入业绩,支付时间');
  res.orders.rows.forEach((r) => {
    L.push([r.orderNo, r.statusLabel, fmt.fenToYuan(r.payableFen), r.countable ? '是' : '否', fmt.formatTime(r.paidAt)].join(','));
  });
  L.push('');
  L.push('【退款账明细】');
  L.push('售后单号,订单号,原因,退款金额(元),退款单号,完成时间');
  res.refunds.rows.forEach((r) => {
    L.push([r.id, r.orderNo, r.reason, fmt.fenToYuan(r.amountFen), r.refundNo, fmt.formatTime(r.reviewedAt)].join(','));
  });
  L.push('');
  L.push('【佣金账明细】');
  L.push('流水号,关联订单,类型,状态,金额(元),时间');
  res.commissions.rows.forEach((r) => {
    L.push([r.id, r.orderNo, r.typeLabel, r.statusLabel, fmt.fenToYuan(r.amountFen), fmt.formatTime(r.createdAt)].join(','));
  });
  L.push('');
  L.push('【库存账明细】');
  L.push('商品,规格,在库,预占,可用,单位');
  res.inventory.rows.forEach((r) => {
    L.push([r.name, r.spec, r.stock, r.reserved, r.available, r.unit].join(','));
  });
  return L.join('\n');
}

module.exports = function (on) {
  on('GET', '/reconcile/summary', () => buildReconcile(db.load()));

  on('GET', '/reconcile/export', () => {
    const d = db.load();
    const res = buildReconcile(d);
    const csv = buildCsv(res, WH.areaName(WH.getDefault(d)));
    return {
      fileName: '对账中心_' + fmt.formatDate(res.generatedAt) + '.csv',
      csv,
      rowCount: res.orders.rows.length + res.refunds.rows.length + res.commissions.rows.length + res.inventory.rows.length,
      generatedAt: res.generatedAt
    };
  });
};
