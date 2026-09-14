/** API：订单、支付、售后 */

const { request } = require('../utils/request');

module.exports = {
  preview: (data) => request({ url: '/orders/preview', method: 'POST', data }),
  create: (data, idempotencyKey) => request({ url: '/orders', method: 'POST', data, idempotencyKey }),
  list: (params) => request({ url: '/orders', data: params || {} }),
  detail: (id) => request({ url: '/orders/' + id }),
  cancel: (id) => request({ url: '/orders/' + id + '/cancel', method: 'POST' }),

  pay: (id) => request({ url: '/orders/' + id + '/pay', method: 'POST' }),
  /** 由收银台按钮触发支付回调（正式环境由服务端接收） */
  payCallback: (data) => request({ url: '/callbacks/wechat-pay', method: 'POST', data }),

  /** 以下为后台操作，代替仓库 / 客服后台 */
  ship: (id) => request({ url: '/orders/' + id + '/ship', method: 'POST' }),
  confirm: (id) => request({ url: '/orders/' + id + '/confirm', method: 'POST' }),
  verifyPickup: (id) => request({ url: '/orders/' + id + '/verify-pickup', method: 'POST' }),

  afterSales: (id, data) => request({ url: '/orders/' + id + '/after-sales', method: 'POST', data }),
  approveAfterSale: (id) => request({ url: '/after-sales/' + id + '/approve', method: 'POST' }),
  rejectAfterSale: (id) => request({ url: '/after-sales/' + id + '/reject', method: 'POST' })
};
