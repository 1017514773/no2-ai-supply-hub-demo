const auth = require('./api/auth');
const store = require('./utils/store');

App({
  globalData: {
    user: null,
    loginReadyCallback: null
  },

  onLaunch() {
    this.ensureLogin();
  },

  /**
   * 微信登录：无 token 时调用 /auth/wechat/login 换取登录态。
   * 真实环境由 wx.login 的 code 换取 session/JWT。
   */
  ensureLogin() {
    if (this._loginPromise) return this._loginPromise;
    const token = store.getToken();
    const user = store.getUser();
    if (token && user) {
      this.globalData.user = user;
      this._loginPromise = Promise.resolve(user);
      return this._loginPromise;
    }
    this._loginPromise = auth
      .login()
      .then((res) => {
        store.setToken(res.token);
        store.setUser(res.user);
        this.globalData.user = res.user;
        return res.user;
      })
      .catch(() => {
        this._loginPromise = null;
        return null;
      });
    return this._loginPromise;
  }
});
