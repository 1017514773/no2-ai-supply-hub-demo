/** 格式化工具（金额一律整数分） */

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

/**
 * 分 -> 元（字符串，最多两位小数，自动去掉冗余的 0）
 * 5990 -> '59.9'；6800 -> '68'；1234 -> '12.34'；-204 -> '-2.04'
 */
function fenToYuan(fen) {
  const v = Number(fen) || 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const yuan = Math.floor(abs / 100);
  const cent = abs % 100;
  let s;
  if (cent === 0) {
    s = '' + yuan;
  } else if (cent % 10 === 0) {
    s = yuan + '.' + cent / 10;
  } else {
    s = yuan + '.' + pad2(cent);
  }
  return neg ? '-' + s : s;
}

/** 分 -> '¥59.9' */
function money(fen) {
  return '¥' + fenToYuan(fen);
}

/** 时间戳 -> 'YYYY-MM-DD HH:mm' */
function formatTime(ts, withSecond) {
  if (!ts) return '';
  const d = new Date(ts);
  const base =
    d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
    ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  return withSecond ? base + ':' + pad2(d.getSeconds()) : base;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/**
 * 倒计时拆解
 * 返回 { over, d, h, m, s, text }
 */
function countdown(endAt) {
  const diff = endAt - Date.now();
  if (diff <= 0) {
    return { over: true, d: 0, h: '00', m: '00', s: '00', text: '已截团' };
  }
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return {
    over: false,
    d,
    h: pad2(h),
    m: pad2(m),
    s: pad2(s),
    text: (d > 0 ? d + '天 ' : '') + pad2(h) + ':' + pad2(m) + ':' + pad2(s)
  };
}

/** 生成幂等键（写接口使用） */
function genKey(prefix) {
  return (prefix || 'ik') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

module.exports = { pad2, fenToYuan, money, formatTime, formatDate, countdown, genKey };
