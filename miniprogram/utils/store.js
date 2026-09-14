/** 本地存储封装：登录态、用户信息、待购买商品缓存等 */

const KEYS = {
  TOKEN: 'no2_token',
  USER: 'no2_user'
};

function getToken() {
  return wx.getStorageSync(KEYS.TOKEN) || '';
}

function setToken(token) {
  wx.setStorageSync(KEYS.TOKEN, token);
}

function getUser() {
  return wx.getStorageSync(KEYS.USER) || null;
}

function setUser(user) {
  wx.setStorageSync(KEYS.USER, user);
}

function clearLogin() {
  wx.removeStorageSync(KEYS.TOKEN);
  wx.removeStorageSync(KEYS.USER);
}

module.exports = { KEYS, getToken, setToken, getUser, setUser, clearLogin };
