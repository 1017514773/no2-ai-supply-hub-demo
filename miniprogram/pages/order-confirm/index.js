const orderApi = require('../../api/order');
const cartApi = require('../../api/cart');
const env = require('../../config/env');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

Page({
  data: {
    items: [],
    fulfillment: 'DELIVERY',
    fulfillments: [
      { key: 'PICKUP', label: '到仓自提', desc: '出示核销码提货' },
      { key: 'CONSIGN', label: '仓内寄存', desc: '登记寄存批次，货权 / 有效期 / 责任人可追溯' },
      { key: 'DELIVERY', label: '平台代发', desc: '快递到家，满 ¥99 免运费' }
    ],
    address: null,
    pickupPoint: null,
    remark: '',
    amounts: null,
    freeFreightYuan: env.freeFreightThresholdFen / 100,
    submitting: false,
    showPay: false,
    createdOrder: null,
    isGroup: false,
    isWholesale: true,
    minOrderLabel: C.WHOLESALE.MIN_LABEL,
    shortFen: 0
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '确认订单' });
    const payload = wx.getStorageSync('no2_checkout');
    if (!payload || !payload.items || !payload.items.length) {
      wx.showToast({ title: '结算信息已失效', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.checkout = payload;
    const isGroup = !!payload.groupId;
    this.setData({
      isGroup,
      isWholesale: !isGroup,
      // 批发订单默认登记仓内寄存（可随时申请提货）；团购参团维持原有默认
      fulfillment: isGroup ? 'DELIVERY' : 'CONSIGN'
    });
    this.preview();
  },

  onShow() {
    const addrId = wx.getStorageSync('no2_selected_addr_id');
    if (addrId) {
      wx.removeStorageSync('no2_selected_addr_id');
      this.addrId = addrId;
      this.preview();
    }
  },

  preview() {
    if (!this.checkout) return;
    orderApi
      .preview({
        items: this.checkout.items,
        fulfillment: this.data.fulfillment,
        addressId: this.addrId || ''
      })
      .then((res) => {
        const pickup = res.pickupPoint || this.data.pickupPoint;
        this.setData({
          items: res.items,
          amounts: {
            productAmountFen: res.productAmountFen,
            freightFen: res.freightFen,
            payableFen: res.payableFen
          },
          shortFen: Math.max(0, C.WHOLESALE.MIN_PRODUCT_AMOUNT_FEN - res.productAmountFen),
          address: res.address,
          pickupPoint: pickup,
          fulfillments: pickup
            ? this.data.fulfillments.map((f) =>
                f.key === 'PICKUP'
                  ? Object.assign({}, f, { desc: pickup.name + ' · 出示核销码提货' })
                  : f
              )
            : this.data.fulfillments
        });
      })
      .catch((e) => wx.showToast({ title: e.message || '加载失败', icon: 'none' }));
  },

  onFulfillment(e) {
    const key = e.currentTarget.dataset.key;
    if (key === this.data.fulfillment) return;
    this.setData({ fulfillment: key });
    this.preview();
  },

  onGoAddress() {
    wx.navigateTo({ url: '/pages/address-list/index?select=1' });
  },

  onRemark(e) {
    this.setData({ remark: e.detail.value });
  },

  onSubmit() {
    if (this.data.submitting || !this.checkout) return;
    if (
      this.data.isWholesale &&
      this.data.amounts &&
      this.data.amounts.productAmountFen < C.WHOLESALE.MIN_PRODUCT_AMOUNT_FEN
    ) {
      wx.showToast({
        title:
          '批发订单满 ' + C.WHOLESALE.MIN_LABEL + ' 起订，还差 ¥' +
          fmt.fenToYuan(C.WHOLESALE.MIN_PRODUCT_AMOUNT_FEN - this.data.amounts.productAmountFen),
        icon: 'none'
      });
      return;
    }
    if (this.data.fulfillment === 'DELIVERY' && !this.data.address) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    orderApi
      .create(
        {
          items: this.checkout.items,
          fulfillment: this.data.fulfillment,
          addressId: (this.data.address && this.data.address.id) || '',
          remark: this.data.remark,
          groupId: this.checkout.groupId || ''
        },
        fmt.genKey('order')
      )
      .then((order) => {
        this.setData({ submitting: false, createdOrder: order, showPay: true });
      })
      .catch((e) => {
        this.setData({ submitting: false });
        wx.showToast({ title: e.message || '下单失败', icon: 'none' });
      });
  },

  onPaySuccess(e) {
    const order = e.detail.order || this.data.createdOrder;
    if (this.checkout && this.checkout.source === 'cart' && this.checkout.cartItemIds.length) {
      cartApi.removeMany(this.checkout.cartItemIds).catch(() => {});
    }
    wx.removeStorageSync('no2_checkout');
    wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
  },

  onPayClose() {
    const order = this.data.createdOrder;
    wx.removeStorageSync('no2_checkout');
    if (order) {
      wx.redirectTo({ url: '/pages/order-detail/index?id=' + order.id });
    } else {
      this.setData({ showPay: false });
    }
  }
});
