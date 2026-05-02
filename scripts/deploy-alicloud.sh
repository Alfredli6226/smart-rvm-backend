#!/bin/bash
# Deploy to AliCloud Docker - run from project root
set -e

HOST="root@47.250.88.132"
KEY="$HOME/.ssh/aliyun_rvm"
TAR="/tmp/rvm-deploy-$(date +%s).tar.gz"

echo "🔨 Building..."
npx vite build 2>&1 | tail -2

echo "📦 Packaging..."
tar czf "$TAR" dist/ api/ package.json package-lock.json vite.config.ts tsconfig*.json postcss.config.js tailwind.config.js index.html src/ Dockerfile alicloud/ .gitignore 2>/dev/null

echo "📤 Uploading to AliCloud..."
scp -i "$KEY" "$TAR" "$HOST:/opt/rvm-platform/"

echo "🐳 Rebuilding Docker..."
ssh -i "$KEY" "$HOST" "
cd /opt/rvm-platform
rm -rf src/ api/ alicloud/ public/ dist/
find . -maxdepth 1 -name '*.json' -o -name '*.js' -o -name '*.ts' -o -name '*.css' -o -name '*.html' | grep -v '.env' | xargs rm -f 2>/dev/null
tar xzf $(basename "$TAR")
docker build --no-cache -t rvm-platform:latest . 2>&1 | tail -2
docker stop rvm-platform 2>/dev/null
docker rm rvm-platform 2>/dev/null
docker run -d --name rvm-platform --restart unless-stopped -p 3000:3000 rvm-platform:latest
sleep 3
echo '✅ Deploy complete'
curl -s -o /dev/null -w 'Status: %{http_code}\n' http://127.0.0.1:3000/
"

rm -f "$TAR"
echo "✨ Done!"
