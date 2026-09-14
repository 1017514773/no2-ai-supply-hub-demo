/** API：对账中心（四账查询 + CSV 导出） */

const { request } = require('../utils/request');

module.exports = {
  summary: () => request({ url: '/reconcile/summary' }),
  exportCsv: () => request({ url: '/reconcile/export' })
};
