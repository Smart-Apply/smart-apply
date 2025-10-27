#!/bin/bash

# Smart Apply - Local Setup Script
# This script sets up the development environment

set -e

echo "🚀 Smart Apply - Local Setup"
echo "=============================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm"
    exit 1
fi

echo "✅ Prerequisites met"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Setup environment
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists"
fi
echo ""

# Start database
echo "🐘 Starting PostgreSQL..."
docker compose -f infra/docker-compose.yml up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Check if database is healthy
if docker compose -f infra/docker-compose.yml ps | grep -q "healthy"; then
    echo "✅ Database is ready"
else
    echo "⚠️  Database might still be starting up..."
    sleep 5
fi
echo ""

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate
echo "✅ Prisma client generated"
echo ""

# Run migrations
echo "🗄️  Running database migrations..."
npm run prisma:migrate
echo "✅ Migrations complete"
echo ""

# Seed database
echo "🌱 Seeding database with demo data..."
npm run prisma:seed
echo "✅ Database seeded"
echo ""

echo "=============================="
echo "✨ Setup Complete!"
echo "=============================="
echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Start the API:"
echo "   npm run start:dev"
echo ""
echo "2. Open Swagger UI:"
echo "   http://localhost:3000/docs"
echo ""
echo "3. Login with demo user:"
echo "   Email: demo@smartapply.com"
echo "   Password: Demo123!"
echo ""
echo "4. Run tests:"
echo "   npm run test:e2e"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Full documentation"
echo "   - QUICKSTART.md - Quick start guide"
echo "   - DELIVERY.md - What's implemented"
echo ""
echo "Happy coding! 🚀"
