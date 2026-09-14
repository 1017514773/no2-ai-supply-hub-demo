/** 商品卡片：点击进入详情，加号触发 add 事件（由页面决定加入购物车） */

Component({
  properties: {
    product: { type: Object, value: {} },
    showAdd: { type: Boolean, value: true }
  },

  methods: {
    onTap() {
      const p = this.properties.product;
      if (!p || !p.id) return;
      wx.navigateTo({ url: '/pages/product-detail/index?id=' + p.id });
    },
    onAdd() {
      this.triggerEvent('add', { product: this.properties.product });
    }
  }
});
