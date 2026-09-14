const userApi = require('../../api/user');
const fmt = require('../../utils/format');

const DAY_MS = 24 * 3600 * 1000;

Page({
  data: {
    loading: true,
    list: [],
    totalRemain: 0,
    warehouse: '',
    lotCount: 0
  },

  onShow() {
    this.load();
  },

  load() {
    userApi
      .inventoryLots()
      .then((res) => {
        const list = (res.list || []).map((l) => {
          const remainDays = Math.max(0, Math.ceil((l.expireAt - Date.now()) / DAY_MS));
          return Object.assign({}, l, {
            createdText: fmt.formatTime(l.createdAt),
            expireText: fmt.formatDate(l.expireAt),
            remainDays,
            expiring: remainDays <= 14,
            statusLabel: l.status === 'IN_STOCK' ? '在库' : l.status
          });
        });
        this.setData({
          list,
          totalRemain: res.totalRemain || 0,
          warehouse: res.warehouse || '',
          lotCount: list.length,
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onShipApply(e) {
    const lot = this.data.list.find((l) => l.lotNo === e.currentTarget.dataset.lot);
    if (!lot) return;
    wx.showModal({
      title: '申请发货',
      content:
        '批次 ' +
        lot.lotNo +
        '（' +
        lot.name +
        ' x' +
        lot.remain +
        '）\n提交后将生成发货单、扣减批次余量并同步物流。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onResetHint() {
    wx.showModal({
      title: '仓内寄存说明',
      content:
        '寄存货物货权归用户所有，批次号 / 有效期 / 责任人可追溯，支持按需分批提货；数据可在「我的 → 重置数据」恢复。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onStockLedger() {
    wx.navigateTo({ url: '/pages/stock-ledger/index' });
  }
});
