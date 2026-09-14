const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const env = require('../../config/env');

Page({
  data: {
    totals: null,
    bars: [],
    recent: [],
    disclaimer: env.demoDisclaimer,
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.load();
  },

  load() {
    agentApi
      .earnings()
      .then((res) => {
        const weekly = res.weeklyFen || [];
        const max = Math.max.apply(null, weekly.concat([1]));
        this.setData({
          totals: res.totals,
          bars: weekly.map((v, i) => ({
            pct: Math.max(6, Math.round((v / max) * 100)),
            text: fmt.fenToYuan(v),
            label: ['一', '二', '三', '四', '五', '六', '日'][i] || ''
          })),
          recent: (res.recent || []).map((c) => this.viewOne(c)),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  viewOne(c) {
    const neg = c.amountFen < 0;
    return Object.assign({}, c, {
      typeLabel: C.COMMISSION_TYPE_LABEL[c.type] || c.type,
      statusLabel: C.COMMISSION_STATUS_LABEL[c.status] || c.status,
      negative: neg,
      amountText: (neg ? '-¥' : '+¥') + fmt.fenToYuan(Math.abs(c.amountFen)),
      timeText: fmt.formatTime(c.createdAt)
    });
  },

  onWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/index' });
  },

  onLedger() {
    wx.navigateTo({ url: '/pages/income-detail/index' });
  },

  onDetail() {
    wx.navigateTo({ url: '/pages/income-detail/index' });
  }
});
