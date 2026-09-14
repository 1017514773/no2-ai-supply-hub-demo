/**
 * Mock 数据库：优先从本地 Storage 读取，首次运行或版本升级时用种子数据初始化。
 * 本地数据仅用于流程展示；可在「我的」页重置。
 */

// 必须写全 './seed/index'：小程序打包器不支持 Node 式"目录→index.js"解析
const buildSeed = require('./seed/index');
const STORAGE_KEY = 'no2_hub_mock_db';

let db = null;

function load() {
  if (db) return db;
  const cached = wx.getStorageSync(STORAGE_KEY);
  if (cached && cached.__version === buildSeed.VERSION) {
    db = cached;
  } else {
    db = buildSeed();
    wx.setStorageSync(STORAGE_KEY, db);
  }
  return db;
}

function save() {
  if (db) wx.setStorageSync(STORAGE_KEY, db);
}

/** 重置本地数据 */
function reset() {
  db = buildSeed();
  wx.setStorageSync(STORAGE_KEY, db);
  return db;
}

function clone(obj) {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

function nextSeq() {
  const d = load();
  d.seq += 1;
  save();
  return d.seq;
}

/**
 * 写接口幂等：同一 idempotencyKey 重复请求返回首次结果快照。
 * 对应 API 规划「所有写接口支持 Idempotency-Key」。
 */
function idempotent(key, fn) {
  const d = load();
  if (key && d.idempotency[key] !== undefined) {
    return clone(d.idempotency[key]);
  }
  const result = fn();
  if (key) {
    d.idempotency[key] = clone(result);
    save();
  }
  return result;
}

module.exports = { load, save, reset, clone, nextSeq, idempotent };
