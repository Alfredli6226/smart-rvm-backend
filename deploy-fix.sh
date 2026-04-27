#!/bin/bash
echo "🚀 开始修复RVM后端系统部署..."

# 1. 检查当前目录
echo "📁 当前目录: $(pwd)"

# 2. 备份原始文件
echo "📦 备份原始文件..."
cp api/data-sync.js api/data-sync.js.backup
cp api/notifications.js api/notifications.js.backup
cp vercel.json vercel.json.backup

# 3. 替换为修复版本
echo "🔧 替换修复版本..."
cp api/data-sync-fixed.js api/data-sync.js
cp api/notifications-fixed.js api/notifications.js

# 4. 检查文件
echo "📋 检查文件..."
ls -la api/data-sync.js api/notifications.js

# 5. 测试修复
echo "🧪 测试修复..."
echo "测试健康检查:"
curl -s "https://rvm-merchant-platform-main.vercel.app/api/health" | head -1

echo -e "\n测试数据同步:"
curl -s "https://rvm-merchant-platform-main.vercel.app/api/data-sync?action=test" | head -1

echo -e "\n测试通知系统:"
curl -s "https://rvm-merchant-platform-main.vercel.app/api/notifications?action=get-alerts" | head -1

echo -e "\n✅ 修复完成！需要重新部署到Vercel。"

# 6. 部署指令
echo -e "\n🚀 部署指令:"
echo "1. 提交更改: git add . && git commit -m '修复API错误'"
echo "2. 推送到GitHub: git push origin main"
echo "3. Vercel会自动重新部署"
echo "4. 检查部署状态: https://vercel.com/dashboard"

echo -e "\n📞 测试URL:"
echo "- 健康检查: https://rvm-merchant-platform-main.vercel.app/api/health"
echo "- 数据同步: https://rvm-merchant-platform-main.vercel.app/api/data-sync?action=full-sync"
echo "- 通知系统: https://rvm-merchant-platform-main.vercel.app/api/notifications?action=get-alerts"
echo "- 用户数据: https://rvm-merchant-platform-main.vercel.app/api/users"
echo "- 主界面: https://rvm-merchant-platform-main.vercel.app"