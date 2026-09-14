/**
 * 统一请求层
 *
 * - useMock = true 时把请求分发给内置 Mock 路由（mock/index.js）；
 * - useMock = false 时调用 wx.request，请求真实后端；
 *   两种模式下页面代码完全一致，切换后端只需修改 config/env.js。
 *
 * 约定（对应《API-接口规划.md》）：
 * - 响应包裹 {code, message, data, requestId}，code === 'OK' 视为成功；
 * - 写接口支持 Idempotency-Key，支付/退款/提现必须提供；
 * - 失败时 reject {code, message}，页面统一 catch 后 toast 提示。
 */
const env = require('../config/env');
const mock = require('../mock/index');

function buildUrl(url) {
  return env.baseUrl + url;
}

function request(options) {
  const { url, method = 'GET', data = {}, idempotencyKey = '' } = options;

  if (env.useMock) {
    // 本地数据模式：走本地路由，注入网络延迟与幂等
    return mock.dispatch({ url, method, data, idempotencyKey });
  }

  return new Promise((resolve, reject) => {
    const header = { 'content-type': 'application/json' };
    const token = wx.getStorageSync('no2_token');
    if (token) header.Authorization = 'Bearer ' + token;
    if (idempotencyKey) header['Idempotency-Key'] = idempotencyKey;

    wx.request({
      url: buildUrl(url),
      method,
      data,
      header,
      success(res) {
        const body = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && body.code === 'OK') {
          resolve(body.data);
        } else {
          reject({
            code: body.code || 'HTTP_' + res.statusCode,
            message: body.message || '请求失败'
          });
        }
      },
      fail(err) {
        reject({ code: 'NETWORK_ERROR', message: err.errMsg || '网络异常' });
      }
    });
  });
}

module.exports = { request };
