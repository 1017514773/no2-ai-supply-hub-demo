const productApi = require('../../api/product');
const cartApi = require('../../api/cart');
const platformApi = require('../../api/platform');
const loc = require('../../utils/warehouse-location');
const env = require('../../config/env');

Page({
  data: {
    brandMark: env.brandMark,
    appName: env.appName,
    appSubName: env.appSubName,
    categories: [],
    activeCategory: '',
    products: [],
    loading: true,
    cartCount: 0,
    overview: { todayOrders: 0, todayGmvFen: 0, cities: 0 },
    heroEyebrow: ''
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 导航标头：显示当前仓地区（如「上海宝山」），仓信息就绪前沿用上次缓存的地区
    if (this.navTitle) {
      wx.setNavigationBarTitle({ title: this.navTitle });
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadCartCount();
    // 每次显示刷新：多仓网络切换默认仓后返回首页时，Hero 定位行与统计联动更新
    this.loadOverview();
    this.loadWarehouseLine();
  },

  loadData() {
    const params = this.data.activeCategory ? { categoryId: this.data.activeCategory } : {};
    Promise.all([productApi.categories(), productApi.products(params)])
      .then((res) => {
        this.setData({
          categories: res[0],
          products: res[1].list,
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  loadCartCount() {
    cartApi
      .list()
      .then((res) => {
        const count = (res.items || []).reduce((s, i) => s + i.qty, 0);
        this.setData({ cartCount: count });
      })
      .catch(() => {});
  },

  loadOverview() {
    platformApi
      .overview()
      .then((res) => this.setData({ overview: res }))
      .catch(() => {});
  },

  /** Hero 定位行 + 导航标头：随默认仓联动（城市 + 仓角色；中心仓保留「全国样板仓」表述） */
  loadWarehouseLine() {
    platformApi
      .warehouses()
      .then((res) => {
        const list = res.list || [];
        const def = list.find((w) => w.isDefault) || list[0];
        if (!def) return;
        const area = loc.areaOf(def);
        const role = def.role === 'HUB' ? '全国样板仓' : def.roleLabel;
        this.setData({ heroEyebrow: area + ' · ' + role });
        // 标头与分享：当前仓地区（如「上海宝山」「苏州昆山」）
        this.navTitle = area;
        this.areaLabel = area;
        wx.setNavigationBarTitle({ title: area });
      })
      .catch(() => {});
  },

  onCategory(e) {
    const id = e.currentTarget.dataset.id || '';
    this.setData({ activeCategory: id, loading: true });
    const params = id ? { categoryId: id } : {};
    productApi
      .products(params)
      .then((res) => this.setData({ products: res.list, loading: false }))
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onSearchTap() {
    wx.navigateTo({ url: '/pages/search/index' });
  },

  onAddToCart(e) {
    const p = e.detail.product;
    cartApi
      .add({ productId: p.id, qty: 1 })
      .then((res) => {
        this.setData({ cartCount: res.count });
        wx.showToast({ title: '已加入购物车', icon: 'success' });
      })
      .catch((err) => wx.showToast({ title: err.message || '加入失败', icon: 'none' }));
  },

  onGoCart() {
    wx.navigateTo({ url: '/pages/cart/index' });
  },

  onQuick(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'group') wx.switchTab({ url: '/pages/group-list/index' });
    else if (key === 'agent') wx.switchTab({ url: '/pages/agent/index' });
    else if (key === 'consign') wx.navigateTo({ url: '/pages/consign/index' });
    else if (key === 'share') wx.navigateTo({ url: '/pages/agent-share/index' });
  },

  onShareAppMessage() {
    return {
      title: (this.areaLabel ? this.areaLabel + ' · ' : '') + '源头好货 全民共享经营',
      path: '/pages/home/index'
    };
  }
});
