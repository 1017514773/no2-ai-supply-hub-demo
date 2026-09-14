const orderApi = require('../../api/order');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

const AFTER_SALE_STATUS_LABEL = {
  REFUNDING: '审核中',
  REFUNDED: '已退款',
  REJECTED: '已驳回'
};

const STATUS_DESC = {
  PENDING_PAYMENT: '请尽快完成支付；取消订单将释放预占库存。',
  PAID: '支付成功，仓库备货处理中。',
  FULFILLING: '仓库作业中，请留意后续物流或核销通知。',
  SHIPPED: '包裹运输中，收到货后请确认收货。',
  PICKUP_READY: '备货完成，凭核销码到仓自提。',
  COMPLETED: '订单已完成，佣金将在售后期后转可结算。',
  CANCELLED: '订单已取消，预占库存已释放。',
  REFUNDING: '售后审核中，订单已标记不计入业绩。',
  REFUNDED: '退款完成，原佣金已生成负向冲销流水。'
};

function fulfillmentText(o) {
  if (o.status === C.ORDER_STATUS.CANCELLED) return '已取消';
  if (o.status === C.ORDER_STATUS.PENDING_PAYMENT) return '待支付后安排';
  if (o.status === C.ORDER_STATUS.REFUNDING || o.status === C.ORDER_STATUS.REFUNDED) {
    return o.shippedAt ? '已发货后退款' : '未发货退款';
  }
  if (o.fulfillment === C.FULFILLMENT.PICKUP) {
    if (o.status === C.ORDER_STATUS.PICKUP_READY) return '待自提（核销码 ' + o.pickupCode + '）';
    if (o.status === C.ORDER_STATUS.COMPLETED) return '已自提核销';
    return '仓库备货中';
  }
  if (o.fulfillment === C.FULFILLMENT.CONSIGN) {
    if (o.consignLotNos && o.consignLotNos.length) return '已寄存（批次 ' + o.consignLotNos.join('、') + '）';
    return o.paidAt ? '待寄存登记' : '待支付后安排';
  }
  if (o.status === C.ORDER_STATUS.SHIPPED) return '运输中（' + o.trackingNo + '）';
  if (o.status === C.ORDER_STATUS.COMPLETED) return '已签收';
  return '仓库备货中';
}

Page({
  data: {
    id: '',
    order: null,
    timeline: [],
    statusGrid: [],
    pickupPoint: null,
    showPay: false,
    canPay: false,
    canCancel: false,
    canConfirm: false,
    canAfterSale: false,
    canShip: false,
    canVerify: false,
    canAudit: false,
    shipLabel: '仓库发货',
    loading: true
  },

  onLoad(options) {
    this.setData({ id: options.id || '' });
  },

  onShow() {
    if (this.data.id) this.load();
  },

  load() {
    orderApi
      .detail(this.data.id)
      .then((o) => this.render(o))
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  render(o) {
    const status = o.status;
    const afterSale = o.afterSale
      ? Object.assign({}, o.afterSale, {
          statusLabel: AFTER_SALE_STATUS_LABEL[o.afterSale.status] || o.afterSale.status,
          createdText: fmt.formatTime(o.afterSale.createdAt)
        })
      : null;
    const canAfterSale =
      [
        C.ORDER_STATUS.PAID,
        C.ORDER_STATUS.FULFILLING,
        C.ORDER_STATUS.SHIPPED,
        C.ORDER_STATUS.PICKUP_READY,
        C.ORDER_STATUS.COMPLETED
      ].indexOf(status) >= 0 && !o.afterSaleId;

    const commissions = (o.commissions || []).map((c) => {
      const neg = c.amountFen < 0;
      return Object.assign({}, c, {
        typeLabel: C.COMMISSION_TYPE_LABEL[c.type] || c.type,
        statusLabel: C.COMMISSION_STATUS_LABEL[c.status] || c.status,
        negative: neg,
        amountText: (neg ? '-¥' : '+¥') + fmt.fenToYuan(Math.abs(c.amountFen)),
        timeText: fmt.formatTime(c.createdAt)
      });
    });

    const payStatus = o.refundedAt
      ? '已退款'
      : o.paidAt
      ? '已支付（' + fmt.formatTime(o.paidAt) + '）'
      : status === C.ORDER_STATUS.CANCELLED
      ? '未支付（已取消）'
      : '待支付';

    const view = Object.assign({}, o, {
      statusLabel: C.ORDER_STATUS_LABEL[status],
      pill: C.orderStatusPill(status),
      statusDesc: STATUS_DESC[status] || '',
      fulfillmentLabel: C.FULFILLMENT_LABEL[o.fulfillment],
      createdText: fmt.formatTime(o.createdAt),
      freightText: o.freightFen ? '¥' + fmt.fenToYuan(o.freightFen) : '免运费',
      itemCount: (o.items || []).reduce((s, i) => s + i.qty, 0),
      consignLotText: (o.consignLotNos || []).join('、'),
      afterSale,
      commissions,
      countableText: o.countable ? '计入业绩' : '不计入业绩（退款 / 售后单）'
    });

    this.setData({
      order: view,
      pickupPoint: o.pickupPoint || this.data.pickupPoint,
      loading: false,
      timeline: (o.timeline || []).map((t, i) => ({
        id: 'tl_' + i,
        text: t.text,
        at: t.at,
        atText: fmt.formatTime(t.at, true)
      })),
      statusGrid: [
        { label: '订单状态', value: view.statusLabel },
        { label: '支付状态', value: payStatus },
        { label: '履约状态', value: fulfillmentText(o) },
        { label: '售后状态', value: afterSale ? afterSale.statusLabel : '无售后' }
      ],
      canPay: status === C.ORDER_STATUS.PENDING_PAYMENT,
      canCancel: status === C.ORDER_STATUS.PENDING_PAYMENT,
      canConfirm: status === C.ORDER_STATUS.SHIPPED,
      canAfterSale,
      canShip: status === C.ORDER_STATUS.PAID || status === C.ORDER_STATUS.FULFILLING,
      canVerify: status === C.ORDER_STATUS.PICKUP_READY,
      canAudit: !!(afterSale && afterSale.status === 'REFUNDING'),
      shipLabel:
        o.fulfillment === C.FULFILLMENT.PICKUP
          ? '仓库备货出库'
          : o.fulfillment === C.FULFILLMENT.CONSIGN
          ? '寄存登记'
          : '仓库发货'
    });
  },

  after(action, tip) {
    action()
      .then(() => {
        wx.showToast({ title: tip, icon: 'success' });
        this.load();
      })
      .catch((e) => wx.showToast({ title: e.message || '操作失败', icon: 'none' }));
  },

  onPay() {
    this.setData({ showPay: true });
  },

  onPayClose() {
    this.setData({ showPay: false });
  },

  onPaySuccess() {
    this.setData({ showPay: false });
    this.load();
  },

  onCancel() {
    wx.showModal({
      title: '取消订单',
      content: '取消后将释放预占库存，确定取消吗？',
      confirmText: '取消订单',
      confirmColor: '#e86832',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.cancel(this.data.id), '订单已取消');
      }
    });
  },

  onConfirm() {
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？确认后订单完成，佣金进入可结算。',
      confirmText: '确认收货',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.confirm(this.data.id), '已确认收货');
      }
    });
  },

  onAfterSale() {
    wx.navigateTo({ url: '/pages/aftersale-apply/index?orderId=' + this.data.id });
  },

  onShip() {
    wx.showModal({
      title: '仓库作业',
      content: '代替仓库后台执行：' + this.data.shipLabel + '。',
      confirmText: '执行',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.ship(this.data.id), '仓库作业完成');
      }
    });
  },

  onVerify() {
    wx.showModal({
      title: '自提核销',
      content: '代替自提点操作：核销后订单完成，佣金进入可结算。',
      confirmText: '核销',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.verifyPickup(this.data.id), '核销完成');
      }
    });
  },

  onApprove() {
    const as = this.data.order.afterSale;
    wx.showModal({
      title: '客服审核通过',
      content: '同意退款 ¥' + fmt.fenToYuan(as.amountFen) + '，佣金将生成负向冲销流水。',
      confirmText: '通过并退款',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.approveAfterSale(as.id), '退款完成');
      }
    });
  },

  onReject() {
    const as = this.data.order.afterSale;
    wx.showModal({
      title: '客服驳回',
      content: '驳回后订单状态恢复，重新计入业绩。',
      confirmText: '驳回',
      confirmColor: '#e86832',
      success: (r) => {
        if (r.confirm) this.after(() => orderApi.rejectAfterSale(as.id), '已驳回');
      }
    });
  },

  onCopyTracking() {
    const no = this.data.order && this.data.order.trackingNo;
    if (!no) return;
    wx.setClipboardData({ data: no });
  },

  onCopyOutbound() {
    const no = this.data.order && this.data.order.outboundNo;
    if (!no) return;
    wx.setClipboardData({ data: no });
  }
});
