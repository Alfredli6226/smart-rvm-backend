# RVM Merchant Platform — 系统架构

## 概览

```
用户 App (WeChat Mini Program)
        │
        ▼
   AutoGCM Vendor Cloud
  (api.autogcm.com)
        │
        ▼
┌──────────────────────────────────────────┐
│         RVM Merchant Platform            │
│                                          │
│  Dashboard (dashboard.mygreenplus.com)   │
│  + API Backend (Vercel Serverless)       │
│                                          │
│  ┌─────────┐   ┌────────────────────┐    │
│  │ Frontend │──▶│   API Layer        │    │
│  │ (Vue 3)  │   │  (11 Vercel Fn)    │    │
│  └─────────┘   └────────┬───────────┘    │
│                         │                 │
│          ┌──────────────┼──────────┐      │
│          ▼              ▼         ▼      │
│     ┌────────┐  ┌──────────┐ ┌──────┐    │
│     │Supabase│  │AutoGCM   │ │ Own  │    │
│     │(本地DB) │  │Vendor API│ │Mach. │    │
│     └────────┘  └──────────┘ └──────┘    │
└──────────────────────────────────────────┘
```

## 目录结构

```
rvm-merchant-platform-main/
│
├── api/                    ← Vercel Serverless Functions（上限12个）
│   │                         每个文件 = 一个独立 API 端点
│   │
│   ├── users.ts            ← /api/users — 用户列表（合并 vendor + Supabase）
│   ├── user-sync.js        ← /api/user-sync — 用户数据同步（积分、重量）
│   ├── data-sync.js        ← /api/data-sync — 多功能数据同步
│   │                         ├ sync-users      同步用户列表
│   │                         ├ sync-machines   同步设备
│   │                         ├ sync-submissions 同步积分记录
│   │                         ├ sync-refunds    同步退款记录
│   │                         ├ check-balance   检查 vendor 余额
│   │                         ├ order-list      查询订单
│   │                         ├ cleaning-records 查询清运记录
│   │                         └ full-sync      全量同步
│   │
│   ├── machines.js         ← /api/machines — 机器实时状态（含 bin 数据）
│   ├── proxy.js            ← /api/proxy — 万能代理（转发到 Vendor API）
│   │                         支持: GET / POST / PUT / DELETE
│   │
│   ├── health.js           ← 健康检查
│   ├── reports.js          ← 报表
│   ├── notifications.js    ← 通知
│   ├── supabase-proxy.js   ← Supabase 数据代理
│   ├── user-analytics.js   ← 用户分析
│   └── cs-whatsapp.js      ← WhatsApp 客服
│
├── lib/                    ← 共享工具库（不被 Vercel 视为 API）
│   └── vendor-live.js      ← AutoGCM Vendor API 公共函数
│       ├ fetchAllIntegralRecords()  拉取全部积分记录
│       ├ fetchRecentIntegralRecords() 最近记录
│       ├ fetchVendorDevices()       设备列表
│       └ 积分/重量转换函数
│
├── src/                    ← 前端 (Vue 3 + TypeScript + Vite)
│   ├── views/              ← 页面
│   │   ├ Users.vue         ← 用户管理（含 balance）
│   │   ├ MachineStatus.vue ← 机器状态（含 bin 实时数据）
│   │   ├ Withdrawal.vue    ← 提现管理
│   │   ├ Dashboard.vue     ← 总览
│   │   └ ...
│   ├── components/         ← 组件
│   │   ├ WithdrawalDetailsModal.vue  提现详情弹窗（含 vendor 余额审计）
│   │   └ ...
│   ├── composables/        ← 业务逻辑
│   │   ├ useUserList.ts    ← 用户列表（含 vendor 数据合并）
│   │   ├ useWithdrawals.ts ← 提现管理
│   │   └ ...
│   ├── stores/             ← Pinia 状态管理
│   │   ├ machines.ts       ← 机器状态（含公共/登录两种模式）
│   │   └ ...
│   └── services/           ← 服务
│       ├ autogcm.ts        ← AutoGCM API 前端调用
│       └ supabase.ts       ← Supabase 数据库
│
├── alicloud/               ← 阿里云部署
│   └── server.js           ← Node.js 服务（serve 前端 + 代理 API 到 Vercel）
│
├── public/                 ← 静态资源
└── Dockerfile              ← Docker 构建文件（阿里云用）
```

## 数据源

### 1. AutoGCM Vendor Cloud
- **认证**: MD5 (merchant-no + timestamp + sign)
- **域名**: `api.autogcm.com`
- **接入的 API**:
  ```
  GET  /system/user/list         用户列表（有 pointsBalance 字段）
  GET  /system/device/list       设备列表
  GET  /system/integral/list      积分明细
  PUT  /system/integral/set/{type}  加减积分（type=1加，type=2扣）
  GET  /refund/record/v2          退款记录
  GET  /system/order/v2/list      订单列表
  GET  /system/rubbish/clear      清运记录
  GET  /system/rubbish/put        投放记录
  POST /system/user              创建/修改用户
  POST /clean/openPopDoor        远程开锁
  ```

### 2. Supabase (PostgreSQL)
- 本地数据库，存储用户、机器配置、提现记录、提交审核等
- 通过 `VITE_SUPABASE_URL` + `service_role_key` 访问

### 3. 未来 —— 自有机器 / 其他 Vendor
新增 vendor 时：
1. 在 `lib/` 写 adapter（如 `vendor-b.js`）
2. 在 `api/` 相应 API 里增加 switch case
3. 数据统一映射到已有的 schema

## 提现审批流程

```
Admin 审批提现
  │
  1. "Run Live Audit" 按钮
  │   ├ GET /system/user/list?userId=XXX
  │   └ 显示 vendor pointsBalance vs 本地 balance
  │
  2. Admin 确认扣分
  │   └ ✅ 勾选 "I confirm points are deducted"
  │
  3. "Approve & Pay" 按钮
  │   ├ PUT /system/integral/set/2    ← 在 vendor 扣积分
  │   ├ 成功后 → UPDATE withdrawals SET status=APPROVED
  │   └ 失败 → 显示错误，不批准
  │
  4. 完成
```

## 用户数据 & Balance 计算

```
users 表 balance 优先级（由高到低）：
  1. Vendor API userInfo.pointsBalance     ← 最准确（已含所有收支）
  2. Supabase users.total_points            ← 历史同步数据
  3. 0                                      ← 无数据

user-sync 端点：
  /api/user-sync?action=list
  → 合并三个数据源：
    a. Vendor integral records（积分收入）
    b. Supabase users 表（total_weight, total_points）
    c. Vendor user list（pointsBalance）
  → 返回统一格式的 user list（含 balance）
```

## 部署

### Vercel（API）
```
vercel --prod            ← 部署 API 函数到 Vercel
```

### AliCloud（前端）
```
docker build -t rvm-platform .
docker run -d --name rvm-platform -p 3000:3000 rvm-platform
```
- nginx `dashboard.mygreenplus.com` → `localhost:3000`
- 前端文件：`dist/`
- API 请求：`/api/*` → proxy 到 `rvm-merchant-platform-main.vercel.app`

## 环境变量

```
MERCHANT_NO=20250902924787       # AutoGCM 商户编号
API_SECRET=xxx                   # AutoGCM API 密钥
SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Supabase 服务角色密钥
CRON_SECRET=xxx                  # 定时任务密钥
```

## GitHub

- **origin**: `github.com/HMADigital-Systems/rvm-merchant-platform`
- **alfred**: `github.com/Alfredli6226/smart-rvm-backend`
