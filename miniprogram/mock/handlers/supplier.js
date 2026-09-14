/**
 * Mock 处理器：供应商 / 品牌方协同门户。
 * 供货单、对账与结算状态同源；对账确认为「后台操作」，代替协同侧执行并保留操作人。
 */

const db = require('../db');
const { fail } = require('../utils');
const fmt = require('../../utils/format');

const STATUS = {
  PENDING: { label: '待对账', pill: 'warn' },
  RECONCILED: { label: '已对账', pill: 'ok' },
  SETTLED: { label: '已结算', pill: 'gray' }
};

const TYPE_LABEL = { SUPPLIER: '供应商', BRAND: '品牌方' };

function monthAmountFen(p) {
  return p.items.reduce((s, it) => s + it.qty * it.unitPriceFen, 0);
}

function partnerView(p) {
  const st = STATUS[p.status] || STATUS.PENDING;
  const amountFen = monthAmountFen(p);
  return {
    id: p.id,
    name: p.name,
    org: p.org,
    type: p.type,
    typeLabel: TYPE_LABEL[p.type] || p.type,
    emoji: p.emoji,
    category: p.category,
    base: p.base,
    contact: p.contact,
    skuCount: p.skuCount,
    orderCount: p.orderCount,
    period: p.period,
    status: p.status,
    statusLabel: st.label,
    pill: st.pill,
    monthAmountFen: amountFen,
    monthAmountText: '¥' + fmt.fenToYuan(amountFen),
    reconciledText: p.reconciledAt ? fmt.formatDate(p.reconciledAt) : '',
    settledText: p.settledAt ? fmt.formatDate(p.settledAt) : '',
    canConfirm: p.status === 'PENDING'
  };
}

function partnerDetail(p) {
  return {
    partner: partnerView(p),
    items: p.items.map((it, i) => ({
      id: p.id + '_i' + i,
      name: it.name,
      spec: it.spec,
      qty: it.qty,
      unitPriceText: '¥' + fmt.fenToYuan(it.unitPriceFen),
      amountFen: it.qty * it.unitPriceFen,
      amountText: '¥' + fmt.fenToYuan(it.qty * it.unitPriceFen)
    })),
    records: p.records
      .slice()
      .sort((a, b) => b.at - a.at)
      .map((r, i) => ({
        id: p.id + '_r' + i,
        action: r.action,
        operator: r.operator,
        atText: fmt.formatTime(r.at)
      }))
  };
}

function findPartner(d, id) {
  const p = d.suppliers.partners.find((x) => x.id === id);
  if (!p) throw fail('NOT_FOUND', '协同伙伴不存在');
  return p;
}

module.exports = function (on) {
  on('GET', '/supplier/portal', () => {
    const d = db.load();
    const list = d.suppliers.partners.map(partnerView);
    return {
      summary: {
        partnerCount: list.length,
        supplierCount: list.filter((x) => x.type === 'SUPPLIER').length,
        brandCount: list.filter((x) => x.type === 'BRAND').length,
        skuCount: list.reduce((s, x) => s + x.skuCount, 0),
        monthAmountFen: list.reduce((s, x) => s + x.monthAmountFen, 0),
        pendingCount: list.filter((x) => x.status === 'PENDING').length
      },
      list
    };
  });

  on('GET', '/supplier/partners/:id', (ctx) => {
    const d = db.load();
    return partnerDetail(findPartner(d, ctx.params.id));
  });

  /** 后台操作：代替供应商 / 品牌方确认对账（写入操作人与审计日志，进入结算流程） */
  on('POST', '/supplier/partners/:id/confirm', (ctx) => {
    const d = db.load();
    const p = findPartner(d, ctx.params.id);
    if (p.status !== 'PENDING') throw fail('CONFLICT', '当前状态无需确认对账');
    p.status = 'RECONCILED';
    p.reconciledAt = Date.now();
    p.records.unshift({ at: Date.now(), action: p.period + ' 对账确认（协同侧）', operator: p.contact });
    d.auditLogs.unshift({
      id: 'a_' + db.nextSeq(),
      at: Date.now(),
      operator: p.contact + '（' + p.name + '）',
      action: '供货对账确认',
      detail:
        '确认 ' + p.period + ' 供货对账 ¥' + fmt.fenToYuan(monthAmountFen(p)) + '，进入结算流程'
    });
    db.save();
    return partnerDetail(p);
  });
};
