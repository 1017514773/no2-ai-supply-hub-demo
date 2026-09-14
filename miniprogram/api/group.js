/** API：团购 */

const { request } = require('../utils/request');

module.exports = {
  list: (params) => request({ url: '/groups', data: params || {} }),
  detail: (id) => request({ url: '/groups/' + id }),
  create: (data) => request({ url: '/groups', method: 'POST', data }),
  join: (id, data, idempotencyKey) =>
    request({ url: '/groups/' + id + '/join', method: 'POST', data, idempotencyKey }),
  close: (id) => request({ url: '/groups/' + id + '/close', method: 'POST' })
};
