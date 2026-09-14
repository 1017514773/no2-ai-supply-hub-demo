/** API：商品与分类 */

const { request } = require('../utils/request');

module.exports = {
  categories: () => request({ url: '/categories' }),
  products: (params) => request({ url: '/products', data: params || {} }),
  detail: (id) => request({ url: '/products/' + id })
};
