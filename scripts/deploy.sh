#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Load Node.js
export PATH="/home/azureuser/.local/share/fnm:$PATH"
eval "$(/home/azureuser/.local/share/fnm/fnm env)"

cd /home/azureuser/smart-apply

echo "📦 Pulling latest code..."
git fetch origin main
git reset --hard origin/main

echo "📥 Installing dependencies..."
npm ci

echo "🔨 Building..."
npm run build --workspace=@smart-apply/shared
npm run build --workspace=apps/api
npm run build --workspace=apps/web

echo "🗃️ Database migrations..."
cd apps/api
npx prisma generate
npx prisma db push --skip-generate
cd ../..

echo "🔄 Restarting services..."
pm2 restart all

echo "✅ Deployment complete!"
pm2 status
