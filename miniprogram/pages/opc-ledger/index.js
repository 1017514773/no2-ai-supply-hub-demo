const userApi = require('../../api/user');
const fmt = require('../../utils/format');

Page({
  data: {
    subject: '',
    summary: null,
    list: [],
    loading: true,
    exporting: false
  },

  onLoad() {
    this.load();
  },

  load() {
    userApi
      .opcLedger()
      .then((res) => {
        this.setData({
          subject: res.subject,
          summary: res.summary,
          list: (res.list || []).map((x) =>
            Object.assign({}, x, {
              dateText: fmt.formatDate(x.date),
              positive: x.amountFen > 0,
              amountText: (x.amountFen > 0 ? '+' : '-') + '¥' + fmt.fenToYuan(Math.abs(x.amountFen))
            })
          ),
          loading: false
        });
      })
      .catch((e) => {
        this.setData({ loading: false });
        wx.showToast({ title: e.message || '加载失败', icon: 'none' });
      });
  },

  onExport() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    userApi
      .opcExport()
      .then((res) => {
        this.setData({ exporting: false });
        const preview = (res.csv || '').split('\n').slice(0, 6).join('\n');
        wx.showModal({
          title: '导出成功',
          content:
            '文件名：' +
            res.fileName +
            '\n共 ' +
            res.rowCount +
            ' 条记录\n\n预览（CSV 前 6 行）：\n' +
            preview +
            '\n\n正式版将生成 CSV/XLSX 文件并支持下载。',
          showCancel: false,
          confirmText: '知道了'
        });
      })
      .catch((e) => {
        this.setData({ exporting: false });
        wx.showToast({ title: e.message || '导出失败', icon: 'none' });
      });
  }
});
