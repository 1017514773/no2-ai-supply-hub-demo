/**
 * Mock 路由：把请求按「METHOD /path/:param」分发到对应处理器。
 * 响应语义与真实后端一致：成功 resolve(data)，失败 reject({code, message})。
 * 注入 120–300ms 网络延迟；写接口的幂等在 db.idempotent 中实现。
 */

const routes = [];

function on(method, pattern, handler) {
  routes.push({
    method: String(method).toUpperCase(),
    segs: pattern.split('/').filter(Boolean),
    handler
  });
}

require('./handlers/catalog')(on);
require('./handlers/account')(on);
require('./handlers/trade')(on);
require('./handlers/social')(on);
require('./handlers/platform')(on);
require('./handlers/reconcile')(on);
require('./handlers/wecom')(on);
require('./handlers/ai')(on);
require('./handlers/supplier')(on);

function match(method, path) {
  const segs = path.split('/').filter(Boolean);
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    if (r.method !== method || r.segs.length !== segs.length) continue;
    const params = {};
    let ok = true;
    for (let j = 0; j < r.segs.length; j++) {
      const s = r.segs[j];
      if (s.charAt(0) === ':') {
        params[s.slice(1)] = decodeURIComponent(segs[j]);
      } else if (s !== segs[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

function dispatch(options) {
  const { url, method = 'GET', data = {}, idempotencyKey = '' } = options;
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const path = String(url).split('?')[0];
      const m = match(String(method).toUpperCase(), path);
      if (!m) {
        reject({ code: 'NOT_FOUND', message: 'Mock 未实现该接口：' + method + ' ' + url });
        return;
      }
      try {
        resolve(m.handler({ data, params: m.params, idempotencyKey }));
      } catch (e) {
        reject({ code: e.code || 'INTERNAL_ERROR', message: e.message || '服务异常' });
      }
    }, 120 + Math.floor(Math.random() * 180));
  });
}

module.exports = { dispatch };
