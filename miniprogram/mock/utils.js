/** Mock 内部工具 */

/** 构造业务错误：handler 抛出后由 mock/index.js 统一 reject */
function fail(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

function nowTs() {
  return Date.now();
}

const DAY = 24 * 60 * 60 * 1000;

/** 佣金试算比例（需客户书面确认后冻结） */
const COMMISSION_RATES = {
  SELF: 0.005,
  DIRECT: 0.003,
  INDIRECT: 0.0015,
  GROUP_DIRECT: 0.002
};

module.exports = { fail, nowTs, DAY, COMMISSION_RATES };
