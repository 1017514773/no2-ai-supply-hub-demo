const productApi = require('../../api/product');
const cartApi = require('../../api/cart');

Page({
  data: {
    keyword: '',
    products: [],
    searched: false,
    loading: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '搜索' });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    const kw = this.data.keyword.trim();
    if (!kw) {
      wx.showToast({ title: '请输入关键词', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    productApi
      .products({ keyword: kw })
      .then((res) => this.setData({ products: res.list, searched: true, loading: false }))
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '搜索失败', icon: 'none' });
      });
  },

  onHotTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.kw }, () => this.onSearch());
  },

  onAddToCart(e) {
    const p = e.detail.product;
    cartApi
      .add({ productId: p.id, qty: 1 })
      .then(() => wx.showToast({ title: '已加入购物车', icon: 'success' }))
      .catch((err) => wx.showToast({ title: err.message || '加入失败', icon: 'none' }));
  }
});
