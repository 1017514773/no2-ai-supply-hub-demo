/**
 * 收银台弹层：完成微信支付流程。
 * 正式环境流程：POST /orders/{id}/pay 取支付参数 → wx.requestPayment → 服务端接收回调。
 * 当前以「确认支付」按钮代替 requestPayment，并额外提供「再次发送回调」按钮验证幂等。
 */

const orderApi = require('../../api/order');
const fmt = require('../../utils/format');

Component({
  properties: {
    show: { type: Boolean, value: false },
    order: { type: Object, value: null }
  },

  data: {
    payParams: null,
    amountText: '',
    busy: false
  },

  observers: {
    'show, order': function (show, order) {
      if (show && order && order.id) {
        this.setData({ amountText: fmt.fenToYuan(order.payableFen || 0), payParams: null });
        this.loadPayParams(order.id);
      }
    }
  },

  methods: {
    loadPayParams(orderId) {
      orderApi
        .pay(orderId)
        .then((res) => this.setData({ payParams: res }))
        .catch((e) => wx.showToast({ title: e.message || '获取支付参数失败', icon: 'none' }));
    },

    onPay() {
      const { order, payParams } = this.data;
      if (!order || !payParams || this.data.busy) return;
      this.setData({ busy: true });
      orderApi
        .payCallback({ orderId: order.id, transactionId: payParams.transactionId })
        .then((res) => {
          this.setData({ busy: false });
          if (res.duplicated) {
            wx.showToast({ title: '回调已处理过，忽略', icon: 'none' });
            return;
          }
          wx.showToast({ title: '支付成功', icon: 'success' });
          this.triggerEvent('success', { order: res.order });
        })
        .catch((e) => {
          this.setData({ busy: false });
          wx.showToast({ title: e.message || '支付失败', icon: 'none' });
        });
    },

    /** 验收项：同一 transactionId 重复回调不产生重复订单/佣金 */
    onDuplicateCallback() {
      const { order, payParams } = this.data;
      if (!order || !payParams || this.data.busy) return;
      this.setData({ busy: true });
      orderApi
        .payCallback({ orderId: order.id, transactionId: payParams.transactionId })
        .then((res) => {
          this.setData({ busy: false });
          wx.showModal({
            title: '重复回调验证',
            content: res.duplicated ? res.message : '首次回调已生效（本次为首次发送）',
            showCancel: false,
            confirmText: '知道了'
          });
        })
        .catch((e) => {
          this.setData({ busy: false });
          wx.showToast({ title: e.message || '回调失败', icon: 'none' });
        });
    },

    onClose() {
      if (this.data.busy) return;
      this.triggerEvent('close');
    },

    noop() {}
  }
});
