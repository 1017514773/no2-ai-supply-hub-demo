const agentApi = require('../../api/agent');
const C = require('../../config/constants');
const fmt = require('../../utils/format');

Page({
  data: {
    tabs: [
      { key: 'ALL', label: '全部' },
      { key: 'ESTIMATED', label: '预计' },
      { key: 'FROZEN', label: '冻结' },
      { key: 'READY', label: '可结算' },
      { key: 'SETTLED', label: '已结算' },
      { key: 'REVERSED', label: '已冲销' }
    ],
    activeTab: 'ALL',
    list: [],
    totals: null,
    loading: true,
    acting: false
  },

  onLoad(options) {
    if (options.status) this.setData({ activeTab: options.status });
    this.load();
  },

  load() {
    agentApi
      .ledger({ status: this.data.activeTab })
      .then((res) => {
        this.setData({
          list: (res.list || []).map((c) => this.viewOne(c)),
          totals: res.totals,
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
      pill:
        c.status === 'READY' || c.status === 'SETTLED'
          ? 'ok'
          : c.status === 'REVERSED'
          ? 'warn'
          : 'gray',
      negative: neg,
      amountText: (neg ? '-¥' : '+¥') + fmt.fenToYuan(Math.abs(c.amountFen)),
      timeText: fmt.formatTime(c.createdAt),
      settledText: c.settledAt ? fmt.formatTime(c.settledAt) : '',
      reversedText: c.reversedAt ? fmt.formatTime(c.reversedAt) : '',
      canFreeze: c.status === 'READY' && !c.reversedAt,
      canUnfreeze: c.status === 'FROZEN' && !c.reversedAt,
      frozenText: c.frozenAt ? fmt.formatTime(c.frozenAt) : ''
    });
  },

  onFreeze(e) {
    this.act(e.currentTarget.dataset.id, 'freeze');
  },

  onUnfreeze(e) {
    this.act(e.currentTarget.dataset.id, 'unfreeze');
  },

  /** 后台操作：佣金冻结 / 解冻（风控复核，写入审计日志） */
  act(id, kind) {
    const c = this.data.list.find((x) => x.id === id);
    if (!c || this.data.acting) return;
    const freeze = kind === 'freeze';
    wx.showModal({
      title: freeze ? '佣金冻结' : '佣金解冻',
      content: freeze
        ? '将流水 ' +
          c.id +
          '（' +
          c.amountText +
          '）冻结（后台操作：风控复核期间暂缓结算），确定继续吗？'
        : '将流水 ' +
          c.id +
          '（' +
          c.amountText +
          '）解冻并转回可结算（后台操作），确定继续吗？',
      confirmText: freeze ? '冻结' : '解冻',
      confirmColor: freeze ? '#e86832' : '#155c45',
      success: (m) => {
        if (!m.confirm) return;
        this.setData({ acting: true });
        const req = freeze
          ? agentApi.freezeCommission(id)
          : agentApi.unfreezeCommission(id);
        req
          .then(() => {
            this.setData({ acting: false });
            wx.showToast({ title: freeze ? '已冻结' : '已解冻', icon: 'success' });
            this.load();
          })
          .catch((err) => {
            this.setData({ acting: false });
            wx.showToast({ title: err.message || '操作失败', icon: 'none' });
          });
      }
    });
  },

  onSwitchTab(e) {
    const k = e.currentTarget.dataset.key;
    if (k === this.data.activeTab) return;
    this.setData({ activeTab: k, loading: true });
    this.load();
  }
});
