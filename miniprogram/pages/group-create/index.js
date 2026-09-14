const groupApi = require('../../api/group');
const productApi = require('../../api/product');
const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

Page({
  data: {
    loading: true,
    qualified: false,
    agentStatusLabel: '',
    products: [],
    productId: '',
    targetOptions: [50, 100, 200, 300],
    targetCount: 100,
    durationOptions: [
      { hours: 24, label: '24 小时' },
      { hours: 48, label: '48 小时' },
      { hours: 72, label: '72 小时' }
    ],
    durationHours: 24,
    note: '',
    submitting: false
  },

  onLoad() {
    this.load();
  },

  load() {
    Promise.all([agentApi.status(), productApi.products({})])
      .then((res) => {
        const qual = res[0];
        const products = res[1].list.map((p) => Object.assign({}, p, { priceText: fmt.fenToYuan(p.priceFen) }));
        this.setData({
          qualified: qual.status === C.AGENT_STATUS.ACTIVE,
          agentStatusLabel: C.AGENT_STATUS_LABEL[qual.status],
          products,
          productId: this.data.productId || (products[0] ? products[0].id : ''),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onSelectProduct(e) {
    this.setData({ productId: e.currentTarget.dataset.id });
  },

  onTarget(e) {
    this.setData({ targetCount: Number(e.currentTarget.dataset.value) });
  },

  onDuration(e) {
    this.setData({ durationHours: Number(e.currentTarget.dataset.hours) });
  },

  onNote(e) {
    this.setData({ note: e.detail.value });
  },

  onGoQualify() {
    wx.navigateTo({ url: '/pages/agent-qualify/index' });
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.qualified) {
      wx.showToast({ title: '请先完成三重资格校验', icon: 'none' });
      return;
    }
    if (!this.data.productId) {
      wx.showToast({ title: '请选择开团商品', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    groupApi
      .create({
        productId: this.data.productId,
        targetCount: this.data.targetCount,
        durationHours: this.data.durationHours,
        note: this.data.note
      })
      .then((g) => {
        this.setData({ submitting: false });
        wx.showToast({ title: '开团成功', icon: 'success' });
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/group-detail/index?id=' + g.id });
        }, 700);
      })
      .catch((e) => {
        this.setData({ submitting: false });
        if (e.code === 'FORBIDDEN') this.setData({ qualified: false });
        wx.showToast({ title: e.message || '开团失败', icon: 'none' });
      });
  }
});
