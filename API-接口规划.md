# API 与系统接口规划（v0.1）

## 1. 系统边界

```text
微信小程序 ─┐
            ├─ API Gateway ─ 业务服务 ─ PostgreSQL/Redis/对象存储
PC 管理后台 ─┘                 ├─ 订单/库存/履约
                               ├─ 资格/社群/客户归属
                               ├─ 佣金/提现/对账
                               └─ 审计/报表
微信支付回调 ───────────────────────┘
物流/短信/AI/ERP：通过适配器接入，均可替换
```

## 2. 统一约定

- Base URL：`/api/v1`；JSON UTF-8；时间使用 ISO 8601 + `Asia/Shanghai`；金额使用整数分（`amountFen`）；
- 登录：微信 `code` 换取 session/JWT；后台使用企业账号 + MFA；
- 所有写接口支持 `Idempotency-Key`；支付、退款、提现必须提供；
- 响应格式：

```json
{"code":"OK","message":"","data":{},"requestId":"req_xxx"}
```

- 错误码：`AUTH_REQUIRED`、`FORBIDDEN`、`VALIDATION_ERROR`、`NOT_FOUND`、`CONFLICT`、`INSUFFICIENT_STOCK`、`PAYMENT_FAILED`、`SETTLEMENT_FROZEN`、`RISK_REVIEW_REQUIRED`；
- 分页：`page`、`pageSize`、`nextCursor`；列表默认按 `createdAt desc`。

## 3. 小程序端 API

### 用户与商品

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/auth/wechat/login` | code 换登录态 |
| GET | `/me` | 当前用户和角色 |
| GET | `/products` | 商品列表（分类、关键词、分页） |
| GET | `/products/{id}` | 商品详情、库存摘要 |
| GET | `/categories` | 分类 |
| POST | `/cart/items` | 加入购物车 |
| GET/PATCH/DELETE | `/cart` | 查询/修改/删除购物车 |

### 订单、支付、售后

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/orders/preview` | 校验价格、库存、履约方式 |
| POST | `/orders` | 创建待支付订单 |
| POST | `/orders/{id}/pay` | 创建微信支付参数 |
| GET | `/orders`、`/orders/{id}` | 订单查询 |
| POST | `/orders/{id}/cancel` | 取消并释放库存 |
| POST | `/orders/{id}/after-sales` | 售后申请 |
| POST | `/after-sales/{id}/refund` | 用户确认退款方案（权限控制） |

### 团购与分销

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/groups`、`/groups/{id}` | 团购列表/详情 |
| POST | `/groups` | 团长开团 |
| POST | `/groups/{id}/join` | 参团并生成订单 |
| POST | `/groups/{id}/close` | 截团（团长/系统） |
| POST | `/referrals/resolve` | 扫码解析推广归属 |
| GET | `/agent/status` | 资格状态与缺失条件 |
| POST | `/agent/course-proof` | 提交课程报名凭证 |
| POST | `/agent/community` | 提交社群资料和证明 |
| GET | `/agent/earnings` | 预估/可结算/已结算收益 |
| POST | `/withdrawals` | 提现申请 |

## 4. 管理后台 API

| 模块 | 示例路径 | 关键能力 |
|---|---|---|
| 商品 | `/admin/products` | CRUD、上下架、改价、批量导入 |
| 库存 | `/admin/inventories` | 公共/寄存库存、盘点、批次、流水 |
| 订单 | `/admin/orders` | 查询、拆单、发货、自提核销 |
| 售后 | `/admin/after-sales` | 审核、退款、仲裁备注 |
| 社群审核 | `/admin/communities` | 通过/驳回、凭证、客服管理员记录 |
| 资格 | `/admin/agent-applications` | 三重校验、冻结、解冻 |
| 佣金 | `/admin/settlements` | 试算、批次、冲销、复核、导出 |
| 提现 | `/admin/withdrawals` | 风控、审核、打款回写 |
| 报表 | `/admin/reports` | GMV、订单、退款、库存、佣金、复购 |
| 审计 | `/admin/audit-logs` | 操作人、前后值、时间、IP、原因 |

## 5. 第三方回调与事件

### 微信支付

`POST /callbacks/wechat-pay`：验签、按 `transactionId` 幂等处理；只将支付状态写入订单，不在回调内直接发佣金。

`POST /callbacks/wechat-refund`：按退款单号幂等；触发订单状态和佣金冲销事件。

### 物流/短信/AI

通过 `LogisticsAdapter`、`SmsAdapter`、`AiContentAdapter` 抽象；第三方不可用时，订单主流程不能被阻塞。AI 只返回草稿和审核状态，不直接发布。

### 内部事件

`order.paid`、`order.shipped`、`order.completed`、`order.refunded`、`inventory.reserved`、`inventory.released`、`agent.activated`、`settlement.ready`、`withdrawal.approved`。

事件字段统一包含：`eventId`、`eventType`、`occurredAt`、`aggregateId`、`operatorId`、`traceId`。消费者按 `eventId` 去重。

## 6. 权限与风控

- RBAC：`consumer`、`agent`、`leader`、`warehouse`、`cs`、`finance`、`admin`；
- 财务接口需要二次确认和操作原因；佣金批次封存后只能追加冲销，不能覆盖；
- 提现风控：实名、收款账户、异常频次、退款率和人工黑名单；
- 推广归属变更需人工审批并保留原关系；
- 文件上传使用临时凭证、病毒扫描和访问控制；
- 禁止客户端传入佣金金额、库存可用量和角色权限，以服务端计算为准。

## 7. 待确认的第三方接口

微信小程序/登录、微信支付/退款、物流查询、短信、对象存储、SaaS（有赞/微盟）开放 API、企业微信能力、ERP/WMS、AI 模型。每项在技术评审时记录：文档链接、认证方式、调用限额、费用、数据归属、失败补偿和沙箱账号。
