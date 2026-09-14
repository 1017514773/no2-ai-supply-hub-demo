const cartApi = require('../../api/cart');

Page({
  data: {
    items: [],
    allSelected: false,
    totalFen: 0,
    selectedCount: 0,
    loading: true
  },

  onShow() {
    this.load();
  },

  load() {
    cartApi
      .list()
      .then((res) => {
        this.setData({ items: res.items, loading: false });
        this.recalc(res.items);
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  recalc(items) {
    const list = items || this.data.items;
    const selected = list.filter((i) => i.selected);
    const totalFen = selected.reduce((s, i) => s + i.priceFen * i.qty, 0);
    this.setData({
      totalFen,
      selectedCount: selected.length,
      allSelected: list.length > 0 && selected.length === list.length
    });
  },

  onToggle(e) {
    const id = e.currentTarget.dataset.id;
    const it = this.data.items.find((x) => x.id === id);
    if (!it) return;
    cartApi
      .update(id, { selected: !it.selected })
      .then((res) => {
        this.setData({ items: res.items });
        this.recalc(res.items);
      })
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  onToggleAll() {
    const target = !this.data.allSelected;
    const tasks = this.data.items
      .filter((i) => i.selected !== target)
      .map((i) => cartApi.update(i.id, { selected: target }));
    Promise.all(tasks)
      .then(() => this.load())
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  onMinus(e) {
    const id = e.currentTarget.dataset.id;
    const it = this.data.items.find((x) => x.id === id);
    if (!it || it.qty <= 1) return;
    this.changeQty(id, it.qty - 1);
  },

  onPlus(e) {
    const id = e.currentTarget.dataset.id;
    const it = this.data.items.find((x) => x.id === id);
    if (!it) return;
    if (it.qty >= it.stock) {
      wx.showToast({ title: '已达库存上限', icon: 'none' });
      return;
    }
    this.changeQty(id, it.qty + 1);
  },

  changeQty(id, qty) {
    cartApi
      .update(id, { qty })
      .then((res) => {
        this.setData({ items: res.items });
        this.recalc(res.items);
      })
      .catch((err) => wx.showToast({ title: err.message || '操作失败', icon: 'none' }));
  },

  onRemove(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '删除商品',
      content: '确定从购物车移除该商品吗？',
      confirmText: '删除',
      confirmColor: '#e86832',
      success: (r) => {
        if (!r.confirm) return;
        cartApi
          .remove(id)
          .then((res) => {
            this.setData({ items: res.items });
            this.recalc(res.items);
          })
          .catch((err) => wx.showToast({ title: err.message || '删除失败', icon: 'none' }));
      }
    });
  },

  onCheckout() {
    const selected = this.data.items.filter((i) => i.selected);
    if (!selected.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' });
      return;
    }
    wx.setStorageSync('no2_checkout', {
      source: 'cart',
      groupId: '',
      items: selected.map((i) => ({ productId: i.productId, qty: i.qty, spec: i.spec })),
      cartItemIds: selected.map((i) => i.id)
    });
    wx.navigateTo({ url: '/pages/order-confirm/index' });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' });
  }
});
