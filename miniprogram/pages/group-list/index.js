const groupApi = require('../../api/group');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const loc = require('../../utils/warehouse-location');

Page({
  data: {
    tabs: [
      { key: 'OPEN', label: '进行中' },
      { key: 'ENDED', label: '已结束' }
    ],
    activeTab: 'OPEN',
    list: [],
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.load();
    loc.refresh();
  },

  load() {
    groupApi
      .list({ status: this.data.activeTab })
      .then((res) => {
        this.setData({ list: res.list.map((g) => this.view(g)), loading: false });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  view(g) {
    const pct = Math.min(100, Math.round((g.joinedCount / Math.max(1, g.targetCount)) * 100));
    const p = g.product || {};
    return Object.assign({}, g, {
      statusLabel: C.GROUP_STATUS_LABEL[g.status],
      pill: g.status === 'SUCCESS' ? 'ok' : g.status === 'OPEN' ? '' : 'gray',
      progressPct: pct,
      priceText: fmt.fenToYuan(g.priceFen),
      unit: p.unit || '件',
      isOpen: g.status === 'OPEN',
      actionText:
        g.status === 'OPEN' ? '去参团' : g.status === 'SUCCESS' ? '已成团' : '已结束'
    });
  },

  onSwitchTab(e) {
    const k = e.currentTarget.dataset.key;
    if (k === this.data.activeTab) return;
    this.setData({ activeTab: k, loading: true });
    this.load();
  },

  onDetail(e) {
    wx.navigateTo({ url: '/pages/group-detail/index?id=' + e.currentTarget.dataset.id });
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/group-create/index' });
  },

  onEnd() {
    if (this._ending) return;
    this._ending = true;
    setTimeout(() => {
      this._ending = false;
      this.load();
    }, 300);
  },

  onShareAppMessage() {
    const area = loc.get();
    return {
      title: (area ? area + ' · ' : '') + '社群团购 集采更省',
      path: '/pages/group-list/index'
    };
  }
});
