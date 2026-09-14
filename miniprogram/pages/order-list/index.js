const orderApi = require('../../api/order');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

Page({
  data: {
    tabs: C.ORDER_TABS,
    activeTab: 'ALL',
    list: [],
    loading: true,
    showPay: false,
    payOrder: null
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: '我的订单' });
    if (options.tab) this.setData({ activeTab: options.tab });
    this.load();
  },

  onShow() {
    this.load();
  },

  load() {
    orderApi
      .list({ tab: this.data.activeTab })
      .then((res) => {
        this.setData({ list: res.list.map((o) => this.view(o)), loading: false });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  view(o) {
    return Object.assign({}, o, {
      statusLabel: C.ORDER_STATUS_LABEL[o.status],
      pill: C.orderStatusPill(o.status),
      fulfillmentLabel: C.FULFILLMENT_LABEL[o.fulfillment],
      createdText: fmt.formatTime(o.createdAt),
      itemEmojis: (o.items || []).slice(0, 4).map((i) => i.emoji).join(' '),
      itemCount: (o.items || []).reduce((s, i) => s + i.qty, 0),
      canPay: o.status === C.ORDER_STATUS.PENDING_PAYMENT,
      canCancel: o.status === C.ORDER_STATUS.PENDING_PAYMENT,
      canConfirm: o.status === C.ORDER_STATUS.SHIPPED
    });
  },

  onSwitchTab(e) {
    const k = e.currentTarget.dataset.key;
    if (k === this.data.activeTab) return;
    this.setData({ activeTab: k, loading: true });
    this.load();
  },

  onDetail(e) {
    wx.navigateTo({ url: '/pages/order-detail/index?id=' + e.currentTarget.dataset.id });
  },

  onPay(e) {
    const id = e.currentTarget.dataset.id;
    const order = this.data.list.find((o) => o.id === id);
    this.setData({ payOrder: order, showPay: true });
  },

  onPayClose() {
    this.setData({ showPay: false });
  },

  onPaySuccess() {
    this.setData({ showPay: false });
    this.load();
  },

  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消订单',
      content: '取消后将释放预占库存，确定取消吗？',
      confirmText: '取消订单',
      confirmColor: '#e86832',
      success: (r) => {
        if (!r.confirm) return;
        orderApi
          .cancel(id)
          .then(() => {
            wx.showToast({ title: '订单已取消', icon: 'success' });
            this.load();
          })
          .catch((err) => wx.showToast({ title: err.message || '取消失败', icon: 'none' }));
      }
    });
  },

  onConfirm(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认收货',
      content: '确认已收到商品？确认后订单完成，佣金进入可结算。',
      confirmText: '确认收货',
      success: (r) => {
        if (!r.confirm) return;
        orderApi
          .confirm(id)
          .then(() => {
            wx.showToast({ title: '已确认收货', icon: 'success' });
            this.load();
          })
          .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
      }
    });
  }
});
