const userApi = require('../../api/user');
const fmt = require('../../utils/format');
const C = require('../../config/constants');

Page({
  data: {
    tabs: [
      { key: 'ALL', label: '全部' },
      { key: 'RESERVE', label: '预占' },
      { key: 'RELEASE', label: '释放' },
      { key: 'OUTBOUND', label: '出库' },
      { key: 'CONSIGN', label: '寄存' },
      { key: 'STOCKTAKE', label: '盘点' }
    ],
    tab: 'ALL',
    all: [],
    list: [],
    total: 0,
    warehouse: '',
    loading: true,
    stocktaking: false
  },

  onLoad() {
    this.load();
  },

  load() {
    userApi
      .inventoryLedger()
      .then((res) => {
        const all = (res.list || []).map((x) =>
          Object.assign({}, x, {
            typeLabel: C.STOCK_LOG_TYPE_LABEL[x.type] || x.type,
            pill: C.STOCK_LOG_TYPE_PILL[x.type] || '',
            qtyText: x.qty === 0 ? '±0' : (x.qty > 0 ? '+' + x.qty : String(x.qty)),
            timeText: fmt.formatTime(x.at)
          })
        );
        this.setData({
          all,
          list: this.pick(all, this.data.tab),
          total: res.total,
          warehouse: res.warehouse,
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  pick(all, tab) {
    return tab === 'ALL' ? all : all.filter((x) => x.type === tab);
  },

  onTab(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ tab: key, list: this.pick(this.data.all, key) });
  },

  onStocktake() {
    if (this.data.stocktaking) return;
    wx.showModal({
      title: '发起现场盘点',
      content: '将抽查在售 SKU 生成盘点批次，记录操作人与盘点流水（后台操作），确定继续吗？',
      confirmText: '发起盘点',
      success: (r) => {
        if (!r.confirm) return;
        this.setData({ stocktaking: true });
        userApi
          .stocktake()
          .then((res) => {
            this.setData({ stocktaking: false });
            wx.showModal({
              title: '盘点完成',
              content:
                '盘点批次 ' +
                res.batchNo +
                '：抽查 ' +
                res.count +
                ' 个在售 SKU，账实一致，盘点流水已记录。',
              showCancel: false,
              confirmText: '知道了'
            });
            this.load();
          })
          .catch((e) => {
            this.setData({ stocktaking: false });
            wx.showToast({ title: e.message || '盘点失败', icon: 'none' });
          });
      }
    });
  }
});
