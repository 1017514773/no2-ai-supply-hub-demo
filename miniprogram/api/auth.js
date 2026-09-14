/** API：登录与用户态（对应 API-接口规划.md） */

const { request } = require('../utils/request');

module.exports = {
  login: () => request({ url: '/auth/wechat/login', method: 'POST' }),
  me: () => request({ url: '/me' })
};
