const productApi = require('../../api/product');
const cartApi = require('../../api/cart');
const platformApi = require('../../api/platform');
const loc = require('../../utils/warehouse-location');
const env = require('../../config/env');

Page({
  data: {
    product: null,
    specIndex: 0,
    qty: 1,
    fulfillmentRows: [
      { key: 'PICKUP', label: '到仓自提', desc: '凭核销码到仓提货' },
      { key: 'CONSIGN', label: '仓内寄存', desc: '登记寄存批次，货权 / 有效期可追溯' },
      { key: 'DELIVERY', label: '平台代发', desc: '快递到家，满 ¥99 免运费' }
    ],
    freeFreightThreshold: env.freeFreightThresholdFen / 100
  },

  onLoad(options) {
    this.productId = options.id;
    this.load();
  },

  /** 每次显示刷新：默认仓切换后返回时自提说明与分享地区联动更新 */
  onShow() {
    this.loadPickup();
    loc.refresh();
  },

  /** 自提说明：随默认仓联动 */
  loadPickup() {
    platformApi
      .pickupPoint()
      .then((wh) => {
        if (!wh || !wh.name) return;
        this.setData({
          fulfillmentRows: this.data.fulfillmentRows.map((f) =>
            f.key === 'PICKUP' ? Object.assign({}, f, { desc: wh.name + '，凭核销码提货' }) : f
          )
        });
      })
      .catch(() => {});
  },

  load() {
    productApi
      .detail(this.productId)
      .then((p) => this.setData({ product: p }))
      .catch((e) => {
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 800);
      });
  },

  onSpec(e) {
    this.setData({ specIndex: Number(e.currentTarget.dataset.index) });
  },

  onMinus() {
    if (this.data.qty > 1) this.setData({ qty: this.data.qty - 1 });
  },

  onPlus() {
    const p = this.data.product;
    if (!p) return;
    const stock = p.stock || 0;
    const max = p.limitPerUser ? Math.min(stock, p.limitPerUser) : stock;
    if (this.data.qty >= max) {
      wx.showToast({
        title: p.limitPerUser && max === p.limitPerUser ? '每账号限购 ' + p.limitPerUser + ' 件' : '已达库存上限',
        icon: 'none'
      });
      return;
    }
    this.setData({ qty: this.data.qty + 1 });
  },

  currentSpec() {
    const p = this.data.product;
    if (!p || !p.specOptions || !p.specOptions.length) return '';
    return p.specOptions[this.data.specIndex];
  },

  onAddCart() {
    const p = this.data.product;
    if (!p) return;
    cartApi
      .add({ productId: p.id, qty: this.data.qty, spec: this.currentSpec() })
      .then(() => wx.showToast({ title: '已加入购物车', icon: 'success' }))
      .catch((e) => wx.showToast({ title: e.message || '加入失败', icon: 'none' }));
  },

  onBuyNow() {
    const p = this.data.product;
    if (!p) return;
    wx.setStorageSync('no2_checkout', {
      source: 'buy',
      groupId: '',
      items: [{ productId: p.id, qty: this.data.qty, spec: this.currentSpec() }],
      cartItemIds: []
    });
    wx.navigateTo({ url: '/pages/order-confirm/index' });
  },

  onGoCart() {
    wx.navigateTo({ url: '/pages/cart/index' });
  },

  onShareAppMessage() {
    const p = this.data.product || {};
    const area = loc.get();
    return {
      title: p.name
        ? p.name + (area ? ' · ' + area : '')
        : area
          ? area + ' · 源头好货'
          : '源头好货 全民共享经营',
      path: '/pages/product-detail/index?id=' + this.productId
    };
  }
});
