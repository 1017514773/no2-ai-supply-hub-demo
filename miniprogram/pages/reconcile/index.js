const reconcileApi = require('../../api/reconcile');
const fmt = require('../../utils/format');

Page({
  data: {
    tab: 'orders',
    tabs: [
      { key: 'orders', label: '订单账' },
      { key: 'refunds', label: '退款账' },
      { key: 'commissions', label: '佣金账' },
      { key: 'inventory', label: '库存账' }
    ],
    res: null,
    loading: true,
    exporting: false
  },

  onLoad() {
    this.load();
  },

  load() {
    reconcileApi
      .summary()
      .then((res) => {
        this.setData({
          res: {
            orders: Object.assign({}, res.orders, {
              rows: res.orders.rows.map((r) =>
                Object.assign({}, r, { paidText: fmt.formatTime(r.paidAt) })
              )
            }),
            refunds: Object.assign({}, res.refunds, {
              rows: res.refunds.rows.map((r) =>
                Object.assign({}, r, { reviewedText: fmt.formatTime(r.reviewedAt) })
              )
            }),
            commissions: Object.assign({}, res.commissions, {
              rows: res.commissions.rows.map((r) =>
                Object.assign({}, r, {
                  createdText: fmt.formatTime(r.createdAt),
                  negative: r.amountFen < 0,
                  amountText:
                    (r.amountFen < 0 ? '-' : '') + '¥' + fmt.fenToYuan(Math.abs(r.amountFen))
                })
              )
            }),
            inventory: Object.assign({}, res.inventory, {
              rows: res.inventory.rows.map((r, i) =>
                Object.assign({}, r, { rid: r.name + r.spec + i })
              )
            }),
            generatedText: fmt.formatTime(res.generatedAt)
          },
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key });
  },

  onExport() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    reconcileApi
      .exportCsv()
      .then((res) => {
        this.setData({ exporting: false });
        const preview = (res.csv || '').split('\n').slice(0, 8).join('\n');
        wx.showModal({
          title: 'CSV 导出成功',
          content:
            '文件名：' +
            res.fileName +
            '\n明细共 ' +
            res.rowCount +
            ' 条，与页面汇总同源\n\n预览（前 8 行）：\n' +
            preview +
            '\n\n正式版将生成 CSV/XLSX 文件并支持下载。',
          confirmText: '复制 CSV',
          success: (r) => {
            if (r.confirm) wx.setClipboardData({ data: res.csv });
          }
        });
      })
      .catch((e) => {
        this.setData({ exporting: false });
        wx.showToast({ title: e.message || '导出失败', icon: 'none' });
      });
  }
});
