/** API：平台概况统计、多仓网络 */

const { request } = require('../utils/request');

module.exports = {
  overview: () => request({ url: '/platform/overview' }),
  dashboard: () => request({ url: '/platform/dashboard' }),

  // 多仓网络与组织权限
  warehouses: () => request({ url: '/platform/warehouses' }),
  /** 自提点：当前默认仓展示口径 */
  pickupPoint: () => request({ url: '/platform/pickup-point' }),
  /** 后台操作：切换默认仓（影响后续新订单自提点与寄存批次归属） */
  switchWarehouse: (id) => request({ url: '/platform/warehouses/switch', method: 'POST', data: { id } })
};
