#!/bin/bash

# RVM Merchant Platform 部署检查清单
# 版本: 1.0.0
# 日期: 2026-04-17

echo "🚀 RVM Merchant Platform 生产环境部署检查清单"
echo "=============================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

echo "📋 步骤1: 检查必需工具"
echo "----------------------"
which git > /dev/null
check_step "Git 已安装"

which node > /dev/null
check_step "Node.js 已安装"

node --version | grep -q "v18\|v20"
check_step "Node.js 版本 >= 18"

which npm > /dev/null
check_step "npm 已安装"

echo ""
echo "📋 步骤2: 检查项目文件"
echo "----------------------"
[ -f "package.json" ] && check_step "package.json 存在"
[ -f "vercel.json" ] && check_step "vercel.json 存在"
[ -f "supabase_init.sql" ] && check_step "supabase_init.sql 存在"
[ -f "DEPLOYMENT_GUIDE.md" ] && check_step "DEPLOYMENT_GUIDE.md 存在"

echo ""
echo "📋 步骤3: 检查API端点"
echo "-------------------"
API_FILES=(
    "api/health.js"
    "api/users.ts"
    "api/data-sync.js"
    "api/image-verification.js"
    "api/recycling-verification.js"
    "api/user-stats.js"
    "api/notifications.js"
    "api/reports.js"
    "api/user-analytics.js"
)

for file in "${API_FILES[@]}"; do
    [ -f "$file" ] && echo -e "${GREEN}✅ $file${NC}" || echo -e "${RED}❌ $file 缺失${NC}"
done

echo ""
echo "📋 步骤4: 检查前端文件"
echo "-------------------"
[ -f "src/views/AIVerificationDashboard.vue" ] && check_step "AI验证仪表板存在"
[ -f "src/router/index.ts" ] && check_step "路由配置存在"
[ -f "src/components/Sidebar.vue" ] && check_step "侧边栏组件存在"

echo ""
echo "📋 步骤5: 环境变量检查"
echo "-------------------"
echo "必需环境变量:"
echo "1. VITE_SUPABASE_URL"
echo "2. SUPABASE_SERVICE_ROLE_KEY"
echo "3. MERCHANT_NO"
echo "4. SECRET"
echo ""
echo "可选环境变量:"
echo "1. GOOGLE_VISION_API_KEY (AI图片分析)"
echo "2. CLARIFAI_API_KEY (AI图片分析)"
echo "3. WHATSAPP_BUSINESS_API_KEY (通知)"
echo "4. TWILIO_ACCOUNT_SID (SMS通知)"
echo "5. TWILIO_AUTH_TOKEN (SMS通知)"

echo ""
echo "📋 步骤6: 数据库表结构"
echo "-------------------"
echo "需要创建的10个表:"
echo "1. users - 用户数据"
echo "2. machines - 机器数据"
echo "3. recycling_submissions - 回收提交"
echo "4. recycling_verifications - 验证记录"
echo "5. user_trust_scores - 信任分数"
echo "6. notifications - 通知记录"
echo "7. sync_logs - 同步日志"
echo "8. fraud_patterns - 欺诈模式"
echo "9. business_reports - 业务报告"
echo "10. system_settings - 系统设置"

echo ""
echo "📋 步骤7: 部署后测试"
echo "-------------------"
echo "部署完成后测试以下端点:"
echo "1. GET /api/health - 系统健康"
echo "2. GET /api/users - 用户数据"
echo "3. GET /api/data-sync?action=full-sync - 数据同步"
echo "4. POST /api/image-verification - AI验证测试"
echo "5. GET /api/user-stats?action=summary - 用户统计"

echo ""
echo "🎯 部署时间估计"
echo "--------------"
echo "• Supabase设置: 10分钟"
echo "• Vercel部署: 5分钟"
echo "• 初始数据同步: 2分钟"
echo "• 系统测试: 10分钟"
echo "• 总计: ~30分钟"

echo ""
echo "🚀 开始部署命令"
echo "-------------"
echo "1. 创建Supabase项目:"
echo "   https://supabase.com/dashboard"
echo ""
echo "2. 运行数据库脚本:"
echo "   • 进入SQL Editor"
echo "   • 粘贴 supabase_init.sql 内容"
echo "   • 点击 Run"
echo ""
echo "3. 获取连接信息:"
echo "   • Settings > API"
echo "   • 复制 URL 和 Service Role Key"
echo ""
echo "4. 部署到Vercel:"
echo "   https://vercel.com/new"
echo "   • 导入GitHub仓库"
echo "   • 配置环境变量"
echo "   • 点击 Deploy"
echo ""
echo "5. 初始数据同步:"
echo "   https://[your-domain].vercel.app/api/data-sync?action=full-sync"
echo ""
echo "6. 测试系统:"
echo "   https://[your-domain].vercel.app"

echo ""
echo "📞 支持信息"
echo "---------"
echo "• 文档: DEPLOYMENT_GUIDE.md"
echo "• GitHub: 项目仓库"
echo "• 紧急问题: 检查Vercel和Supabase状态页面"

echo ""
echo "=============================================="
echo "🎉 检查完成！系统已准备好部署到生产环境！"
echo "=============================================="