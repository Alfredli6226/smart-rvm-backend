# RVM Merchant Platform - 生产环境部署指南

## 🚀 快速开始

### 1. 数据库设置 (Supabase)
1. 访问 [Supabase Dashboard](https://supabase.com/dashboard)
2. 创建新项目: `rvm-merchant-platform`
3. 进入 **SQL Editor**
4. 运行 `supabase_init.sql` 脚本
5. 获取连接信息:
   - **URL**: `https://[project-ref].supabase.co`
   - **Anon Key**: 在 Settings > API 中获取
   - **Service Role Key**: 在 Settings > API 中获取

### 2. Vercel 部署
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 导入 GitHub 仓库: `rvm-merchant-platform-main`
3. 配置环境变量 (见下方)
4. 部署项目

### 3. 环境变量配置

#### 必需环境变量:
```env
# Supabase
VITE_SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Vendor API (autogcm)
MERCHANT_NO=20250902924787
SECRET=99368df20fd10d5322f203435ddc9984

# 可选: AI 服务 (未来集成)
GOOGLE_VISION_API_KEY=your_google_vision_key
CLARIFAI_API_KEY=your_clarifai_key

# 可选: 通知服务
WHATSAPP_BUSINESS_API_KEY=your_whatsapp_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### 4. 初始数据同步
部署完成后，访问以下URL进行初始数据同步:
```
https://[your-vercel-domain].vercel.app/api/data-sync?action=full-sync
```

## 📊 系统架构

### API 端点列表
```
GET    /api/health                    # 系统健康检查
GET    /api/users                     # 用户列表 (真实数据)
GET    /api/users/filter              # 用户筛选
GET    /api/users/stats               # 用户统计
GET    /api/user-analytics            # 用户分析仪表板
GET    /api/notifications             # 通知系统
GET    /api/reports                   # 业务报告
POST   /api/data-sync                 # 数据同步
POST   /api/image-verification        # AI图片验证
POST   /api/recycling-verification    # 回收活动验证
GET    /api/user-stats                # 用户统计API
```

### 数据库表结构
- `users` - 用户数据 (从vendor API同步)
- `machines` - 机器数据
- `recycling_submissions` - 回收提交记录
- `recycling_verifications` - AI验证记录
- `user_trust_scores` - 用户信任分数
- `notifications` - 通知记录
- `sync_logs` - 数据同步日志
- `fraud_patterns` - 欺诈模式
- `business_reports` - 业务报告
- `system_settings` - 系统设置

## 🔧 维护指南

### 日常维护任务
1. **自动数据同步** (每6小时)
   ```
   GET /api/data-sync?action=incremental-sync
   ```

2. **每日报告生成** (每天9:00 AM)
   ```
   GET /api/reports?type=daily
   ```

3. **用户信任分数更新** (实时)
   - 每次验证后自动更新

### 监控指标
1. **系统健康**: `/api/health`
2. **用户增长**: 每日新增用户数
3. **回收活动**: 提交数量、验证通过率
4. **欺诈检测**: 欺诈尝试次数、检测准确率
5. **API性能**: 响应时间、错误率

### 故障排除

#### 问题1: 用户数据无法同步
```bash
# 检查vendor API连接
curl -X GET "https://api.autogcm.com/system/device/list" \
  -H "merchant-no: 20250902924787" \
  -H "timestamp: $(date +%s%3N)" \
  -H "sign: [计算签名]"
```

#### 问题2: AI验证失败
1. 检查环境变量 `GOOGLE_VISION_API_KEY` 或 `CLARIFAI_API_KEY`
2. 检查图片URL可访问性
3. 查看API日志: `/api/image-verification` 错误信息

#### 问题3: 数据库连接失败
1. 检查 `VITE_SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`
2. 验证Supabase项目状态
3. 检查网络连接和防火墙设置

## 🚀 生产环境优化

### 性能优化
1. **启用CDN缓存** (Vercel自动)
2. **数据库索引优化** (已包含在SQL脚本)
3. **API响应压缩** (Vercel自动)
4. **图片优化** (使用WebP格式)

### 安全建议
1. **定期轮换API密钥**
2. **启用Supabase行级安全(RLS)**
3. **实施API速率限制**
4. **启用HTTPS强制**
5. **定期安全审计**

### 备份策略
1. **数据库备份**: Supabase自动每日备份
2. **代码备份**: GitHub仓库
3. **环境变量备份**: 导出到安全位置
4. **用户数据导出**: 每月导出CSV报告

## 📈 扩展计划

### 阶段1: 基础功能 (当前)
- ✅ 用户数据管理
- ✅ 机器数据管理
- ✅ AI图片验证
- ✅ 欺诈检测
- ✅ 积分系统

### 阶段2: 高级功能 (未来)
- WhatsApp通知集成
- 移动应用API
- 实时仪表板
- 机器学习模型训练
- 多商户支持

### 阶段3: 商业智能
- 预测分析
- 用户行为分析
- 收入预测
- 运营优化建议

## 📞 支持与联系

### 紧急问题
1. **系统宕机**: 检查Vercel状态页面
2. **数据丢失**: 从Supabase备份恢复
3. **安全漏洞**: 立即轮换所有API密钥

### 常规支持
- **文档**: 本项目README和本指南
- **GitHub Issues**: 报告bug和功能请求
- **供应商支持**: autogcm API相关问题

### 监控仪表板
访问生产环境仪表板:
```
https://[your-vercel-domain].vercel.app
```

## 🎯 上线检查清单

### 部署前检查
- [ ] 数据库表结构已创建
- [ ] 环境变量已配置
- [ ] API端点测试通过
- [ ] 数据同步工作正常
- [ ] AI验证系统测试通过

### 上线后监控
- [ ] 系统健康检查正常
- [ ] 用户数据实时同步
- [ ] 欺诈检测系统工作
- [ ] 通知系统测试通过
- [ ] 性能指标在正常范围

### 用户培训
- [ ] 管理员培训完成
- [ ] 用户手册准备就绪
- [ ] 支持渠道建立
- [ ] 应急计划制定

---

**部署完成时间**: 预计30-60分钟  
**系统就绪时间**: 部署后立即  
**用户影响**: 无停机时间部署  

**祝您部署顺利！** 🚀