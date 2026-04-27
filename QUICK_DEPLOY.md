# 🚀 RVM Merchant Platform - 快速部署指南

## ⏱️ 30分钟完成部署！

### 第1步: 创建Supabase数据库 (10分钟)

#### A. 注册/登录Supabase
1. 访问: https://supabase.com/dashboard
2. 登录或注册免费账户

#### B. 创建新项目
1. 点击 **"New Project"**
2. 填写项目信息:
   - **Name**: `rvm-merchant-platform`
   - **Database Password**: 设置安全密码 (记住它!)
   - **Region**: **Singapore** (亚太-东南1)
   - **Pricing Plan**: Free (足够初期使用)

3. 点击 **"Create new project"**
4. 等待2-3分钟项目创建完成

#### C. 初始化数据库
1. 进入 **SQL Editor** (左侧菜单)
2. 点击 **"New query"**
3. 复制以下SQL脚本内容:
   ```
   [打开 supabase_init.sql 文件，复制全部内容]
   ```
4. 粘贴到SQL编辑器中
5. 点击 **"Run"** (右上角)
6. 等待执行完成 (约30秒)

#### D. 获取连接信息
1. 进入 **Settings > API** (左侧菜单)
2. 复制以下信息:
   - **URL**: `https://[project-ref].supabase.co`
   - **Service Role Key**: 以 `eyJ...` 开头 (点击"Reveal"显示)

### 第2步: 部署到Vercel (5分钟)

#### A. 访问Vercel
1. 访问: https://vercel.com/new
2. 使用GitHub登录

#### B. 导入项目
1. 点击 **"Import Git Repository"**
2. 选择: `rvm-merchant-platform-main`
3. 点击 **"Import"**

#### C. 配置项目
1. **Project Name**: `rvm-merchant-platform` (自动填充)
2. **Framework Preset**: Vercel (自动检测)
3. **Root Directory**: `.` (默认)

#### D. 配置环境变量
点击 **"Environment Variables"**，添加:

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `VITE_SUPABASE_URL` | 你的Supabase URL | 从步骤1-D获取 |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的Service Role Key | 从步骤1-D获取 |
| `MERCHANT_NO` | `20250902924787` | 固定值 |
| `SECRET` | `99368df20fd10d5322f203435ddc9984` | 固定值 |
| `NODE_ENV` | `production` | 固定值 |

#### E. 部署
1. 点击 **"Deploy"**
2. 等待2-3分钟部署完成
3. 获取部署URL: `https://rvm-merchant-platform.vercel.app`

### 第3步: 初始设置 (2分钟)

#### A. 数据同步
访问以下URL进行初始数据同步:
```
https://rvm-merchant-platform.vercel.app/api/data-sync?action=full-sync
```

#### B. 验证部署
访问以下URL验证系统健康:
```
https://rvm-merchant-platform.vercel.app/api/health
```
应该返回: `{"status":"healthy","timestamp":"...","services":[...]}`

### 第4步: 系统测试 (10分钟)

#### A. 测试API端点
1. **用户数据**: `GET /api/users`
2. **机器数据**: `GET /api/data-sync?action=sync-machines`
3. **AI验证**: `POST /api/image-verification` (测试用)
4. **用户统计**: `GET /api/user-stats?action=summary`

#### B. 访问管理界面
1. 打开: `https://rvm-merchant-platform.vercel.app`
2. 使用默认登录:
   - 用户名: `admin`
   - 密码: `admin123` (首次登录后请修改)

#### C. 验证功能
1. 查看 **1,128个真实用户**
2. 查看 **8台机器状态**
3. 测试 **AI验证仪表板**
4. 查看 **业务报告**

### 第5步: 生产环境优化 (3分钟)

#### A. 安全设置
1. **修改管理员密码**
2. **设置API访问限制** (如果需要)
3. **启用HTTPS强制** (Vercel自动)

#### B. 监控设置
1. 访问Vercel Analytics查看流量
2. 设置Supabase监控警报
3. 定期检查系统日志

## 🎯 部署完成！

### 系统URL
- **主界面**: `https://rvm-merchant-platform.vercel.app`
- **API文档**: 同一URL + `/api/health`
- **管理后台**: 同一URL + 登录

### 功能验证清单
- [ ] 用户数据同步正常 (1,128用户)
- [ ] 机器数据同步正常 (8台机器)
- [ ] AI验证系统工作
- [ ] 欺诈检测系统工作
- [ ] 积分计算正确
- [ ] 管理界面可访问

### 支持信息
- **文档**: 本项目README和部署指南
- **问题报告**: GitHub Issues
- **紧急支持**: 检查Vercel/Supabase状态页面

## 🔧 故障排除

### 问题1: 数据库连接失败
```bash
# 检查环境变量
echo $VITE_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

### 问题2: 用户数据无法同步
访问: `https://rvm-merchant-platform.vercel.app/api/data-sync?action=full-sync`
检查返回的错误信息

### 问题3: 管理界面无法访问
1. 检查Vercel部署状态
2. 查看浏览器控制台错误
3. 清除浏览器缓存

## 📞 需要帮助？

### 立即支持
1. **部署问题**: 重新阅读本指南
2. **技术问题**: 检查错误日志
3. **功能问题**: 测试API端点

### 长期支持
- **系统维护**: 每月检查更新
- **数据备份**: Supabase自动备份
- **性能监控**: Vercel Analytics

---

**🎉 恭喜！RVM Merchant Platform 已成功部署到生产环境！**

**开始享受自动化回收管理系统的便利吧！** 🚀