/** 自定义底部导航（纯 CSS 线性图标，五个栏目） */

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', icon: 'home', text: '首页' },
      { pagePath: '/pages/group-list/index', icon: 'bag', text: '团购' },
      { pagePath: '/pages/agent/index', icon: 'bars', text: '经营台' },
      { pagePath: '/pages/income/index', icon: 'coin', text: '收益' },
      { pagePath: '/pages/mine/index', icon: 'user', text: '我的' }
    ]
  },

  methods: {
    onTap(e) {
      const idx = e.currentTarget.dataset.index;
      const item = this.data.list[idx];
      if (!item || idx === this.data.selected) return;
      wx.switchTab({ url: item.pagePath });
    }
  }
});
