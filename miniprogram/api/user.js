/** API：用户、地址、寄存库存、OPC 台账 */

const { request } = require('../utils/request');

module.exports = {
  me: () => request({ url: '/me' }),

  addresses: () => request({ url: '/addresses' }),
  addAddress: (data) => request({ url: '/addresses', method: 'POST', data }),
  updateAddress: (id, data) => request({ url: '/addresses/' + id, method: 'PUT', data }),
  removeAddress: (id) => request({ url: '/addresses/' + id, method: 'DELETE' }),
  setDefaultAddress: (id) => request({ url: '/addresses/' + id + '/default', method: 'POST' }),

  inventoryLots: () => request({ url: '/inventory/lots' }),
  inventoryLedger: () => request({ url: '/inventory/ledger' }),
  /** 后台操作：发起现场盘点 */
  stocktake: (data) => request({ url: '/inventory/stocktake', method: 'POST', data: data || {} }),

  /** 重置本地数据为初始种子 */
  resetDemo: () => request({ url: '/demo/reset', method: 'POST' }),

  opcLedger: () => request({ url: '/opc/ledger' }),
  opcExport: () => request({ url: '/opc/export' })
};
