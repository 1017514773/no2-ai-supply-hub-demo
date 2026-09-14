const orderApi = require('../../api/order');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

Page({
  data: {
    orderId: '',
    order: null,
    reasons: C.AFTER_SALE_REASONS,
    reason: '',
    amountYuan: '',
    remark: '',
    maxYuan: '',
    submitting: false
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId || '' });
    this.load();
  },

  load() {
    orderApi
      .detail(this.data.orderId)
      .then((o) => {
        this.setData({
          order: Object.assign({}, o, {
            statusLabel: C.ORDER_STATUS_LABEL[o.status],
            fulfillmentLabel: C.FULFILLMENT_LABEL[o.fulfillment],
            createdText: fmt.formatTime(o.createdAt),
            itemCount: (o.items || []).reduce((s, i) => s + i.qty, 0)
          }),
          amountYuan: fmt.fenToYuan(o.payableFen),
          maxYuan: fmt.fenToYuan(o.payableFen)
        });
      })
      .catch((e) => {
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onReason(e) {
    this.setData({ reason: e.currentTarget.dataset.reason });
  },

  onAmount(e) {
    this.setData({ amountYuan: e.detail.value });
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  onSubmit() {
    const { reason, amountYuan, remark, order, submitting, orderId } = this.data;
    if (submitting) return;
    if (!reason) {
      wx.showToast({ title: '请选择售后原因', icon: 'none' });
      return;
    }
    const amountFen = Math.round(Number(amountYuan) * 100);
    if (!amountFen || amountFen <= 0) {
      wx.showToast({ title: '请输入正确的退款金额', icon: 'none' });
      return;
    }
    if (amountFen > order.payableFen) {
      wx.showToast({ title: '退款金额不能超过实付 ¥' + this.data.maxYuan, icon: 'none' });
      return;
    }
    wx.showModal({
      title: '提交售后申请',
      content: '提交后订单将标记为「售后中」且不计入业绩；审核通过后佣金自动生成负向冲销流水。',
      confirmText: '提交申请',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ submitting: true });
        orderApi
          .afterSales(orderId, { reason, amountFen, remark })
          .then(() => {
            wx.showToast({ title: '已提交，等待审核', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 900);
          })
          .catch((e) => {
            this.setData({ submitting: false });
            wx.showToast({ title: e.message || '提交失败', icon: 'none' });
          });
      }
    });
  }
});
