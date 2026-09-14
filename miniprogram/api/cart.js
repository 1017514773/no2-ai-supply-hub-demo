/** API：购物车 */

const { request } = require('../utils/request');

module.exports = {
  list: () => request({ url: '/cart' }),
  add: (data) => request({ url: '/cart/items', method: 'POST', data }),
  update: (id, data) => request({ url: '/cart/items/' + id, method: 'PATCH', data }),
  remove: (id) => request({ url: '/cart/items/' + id, method: 'DELETE' }),
  removeMany: (ids) => request({ url: '/cart/items/remove', method: 'POST', data: { ids } })
};
