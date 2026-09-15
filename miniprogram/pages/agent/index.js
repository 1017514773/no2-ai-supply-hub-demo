const agentApi = require('../../api/agent');
const userApi = require('../../api/user');
const C = require('../../config/constants');
const fmt = require('../../utils/format');
const loc = require('../../utils/warehouse-location');
const env = require('../../config/env');

Page({
  data: {
    user: null,
    qual: null,
    checks: [],
    statusLabel: '',
    statusPill: '',
    bars: [],
    team: null,
    monthPct: 0,
    totals: null,
    weekSumText: '',
    rewards: [
      { label: '本人进货', value: '每日推广奖励费 ¥0.34' },
      { label: '分享成交', value: '推广奖励费 ¥2.04' },
      { label: '社群开团成交', value: '团购推广奖励费 ¥0.12' }
    ],
    disclaimer: env.demoDisclaimer,
    loading: true
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.load();
    loc.refresh();
  },

  load() {
    Promise.all([userApi.me(), agentApi.status(), agentApi.team(), agentApi.earnings()])
      .then((res) => {
        const me = res[0];
        const qual = res[1];
        const team = res[2];
        const earnings = res[3];

        const checks = [
          { key: 'course', label: 'AI 课程凭证', passed: qual.checks.course },
          { key: 'purchase', label: '集采金额达标', passed: qual.checks.purchase },
          { key: 'community', label: '社群资料', passed: qual.checks.community }
        ];
        const passedCount = checks.filter((c) => c.passed).length;

        const weekly = earnings.weeklyFen || [];
        const max = Math.max.apply(null, weekly.concat([1]));
        const bars = weekly.map((v, i) => ({
          pct: Math.max(6, Math.round((v / max) * 100)),
          text: fmt.fenToYuan(v),
          label: ['一', '二', '三', '四', '五', '六', '日'][i] || ''
        }));
        const weekSum = weekly.reduce((s, v) => s + v, 0);

        this.setData({
          user: me.user,
          qual,
          checks,
          passedCount,
          statusLabel: C.AGENT_STATUS_LABEL[qual.status],
          statusPill: C.agentStatusPill(qual.status),
          bars,
          weekSumText: fmt.fenToYuan(weekSum),
          team: Object.assign({}, team, { customerCount: team.directCount + team.indirectCount }),
          monthPct: Math.min(100, Math.round((team.monthVolumeFen / team.monthTargetFen) * 100)),
          totals: earnings.totals,
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onQualify() {
    wx.navigateTo({ url: '/pages/agent-qualify/index' });
  },

  onShare() {
    wx.navigateTo({ url: '/pages/agent-share/index' });
  },

  onIncome() {
    wx.switchTab({ url: '/pages/income/index' });
  },

  onLedger() {
    wx.navigateTo({ url: '/pages/income-detail/index' });
  },

  onWithdraw() {
    wx.navigateTo({ url: '/pages/withdraw/index' });
  },

  onConsign() {
    wx.navigateTo({ url: '/pages/consign/index' });
  },

  onDashboard() {
    wx.navigateTo({ url: '/pages/dashboard/index' });
  },

  onOrders() {
    wx.navigateTo({ url: '/pages/order-list/index' });
  },

  onShareAppMessage() {
    const area = loc.get();
    return {
      title: (area ? area + ' · ' : '') + '全民共享经营，一起把源头好货带进社区',
      path: '/pages/home/index'
    };
  }
});
