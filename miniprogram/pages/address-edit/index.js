const userApi = require('../../api/user');

const TAG_OPTIONS = ['家', '公司', '学校', '父母家', '其他'];

Page({
  data: {
    id: '',
    editing: false,
    name: '',
    phone: '',
    region: '',
    regionArray: [],
    detail: '',
    tag: '',
    isDefault: false,
    tagOptions: TAG_OPTIONS,
    submitting: false
  },

  onLoad(options) {
    if (options.id) {
      const id = options.id;
      this.setData({ id, editing: true });
      wx.setNavigationBarTitle({ title: '编辑地址' });
      userApi
        .addresses()
        .then((list) => {
          const addr = list.find((a) => a.id === id);
          if (!addr) {
            wx.showToast({ title: '地址不存在', icon: 'none' });
            return;
          }
          this.setData({
            name: addr.name,
            phone: addr.phone,
            region: addr.region,
            regionArray: addr.region.split(' '),
            detail: addr.detail,
            tag: addr.tag || '',
            isDefault: !!addr.isDefault
          });
        })
        .catch((e) => wx.showToast({ title: e.message || '加载失败', icon: 'none' }));
    } else {
      wx.setNavigationBarTitle({ title: '新增地址' });
    }
  },

  onName(e) {
    this.setData({ name: e.detail.value });
  },

  onPhone(e) {
    this.setData({ phone: e.detail.value });
  },

  onRegion(e) {
    const arr = e.detail.value || [];
    this.setData({ regionArray: arr, region: arr.join(' ') });
  },

  onDetail(e) {
    this.setData({ detail: e.detail.value });
  },

  onTag(e) {
    const tag = e.currentTarget.dataset.tag;
    this.setData({ tag: this.data.tag === tag ? '' : tag });
  },

  onDefault(e) {
    this.setData({ isDefault: e.detail.value });
  },

  onSubmit() {
    const { id, editing, name, phone, region, detail, tag, isDefault, submitting } = this.data;
    if (submitting) return;
    if (!name.trim()) {
      wx.showToast({ title: '请填写收货人姓名', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请填写正确的 11 位手机号', icon: 'none' });
      return;
    }
    if (!region) {
      wx.showToast({ title: '请选择所在地区', icon: 'none' });
      return;
    }
    if (!detail.trim()) {
      wx.showToast({ title: '请填写详细地址', icon: 'none' });
      return;
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim(),
      region,
      detail: detail.trim(),
      tag,
      isDefault
    };
    this.setData({ submitting: true });
    const promise = editing ? userApi.updateAddress(id, payload) : userApi.addAddress(payload);
    promise
      .then(() => {
        wx.showToast({ title: editing ? '已保存' : '已新增', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 700);
      })
      .catch((e) => {
        this.setData({ submitting: false });
        wx.showToast({ title: e.message || '保存失败', icon: 'none' });
      });
  }
});
