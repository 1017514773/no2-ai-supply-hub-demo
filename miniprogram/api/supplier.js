/** API：供应商 / 品牌方协同门户 */

const { request } = require('../utils/request');

module.exports = {
  portal: () => request({ url: '/supplier/portal' }),
  partner: (id) => request({ url: '/supplier/partners/' + id }),
  /** 后台操作：代替供应商 / 品牌方确认对账（进入结算流程） */
  confirm: (id) => request({ url: '/supplier/partners/' + id + '/confirm', method: 'POST' })
};
