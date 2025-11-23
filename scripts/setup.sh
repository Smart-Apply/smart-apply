#!/bin/bash

# Smart Apply - Local Setup Script
# This script sets up the development environment for Backend + Frontend

set -e

echo "🚀 Smart Apply - Full-Stack Setup"
echo "=================================="
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

# Install Backend dependencies
echo "📦 Installing backend dependencies..."
cd apps/api
npm install
cd ../..
echo "✅ Backend dependencies installed"
echo ""

# Install Frontend dependencies
echo "📦 Installing frontend dependencies..."
cd apps/web
npm install
cd ../..
echo "✅ Frontend dependencies installed (450 packages)"
echo ""

# Setup Backend environment
if [ ! -f apps/api/.env ]; then
    echo "📝 Creating backend .env file..."
    cp apps/api/.env.example apps/api/.env
    echo "✅ Backend .env file created"
else
    echo "ℹ️  Backend .env file already exists"
fi
echo ""

# Setup Frontend environment
if [ ! -f apps/web/.env.local ]; then
    echo "📝 Creating frontend .env.local file..."
    echo "NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1" > apps/web/.env.local
    echo "✅ Frontend .env.local file created"
else
    echo "ℹ️  Frontend .env.local file already exists"
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
cd apps/api
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

# Setup test database
echo "🧪 Setting up test database..."
cd ../..

# Create test database
if docker exec smartapply-db psql -U postgres -lqt | cut -d \| -f 1 | grep -qw smartapply_test; then
    echo "ℹ️  Test database already exists"
else
    docker exec smartapply-db psql -U postgres -c "CREATE DATABASE smartapply_test;"
    echo "✅ Test database created"
fi

# Apply migrations to test database
echo "🗄️  Running migrations on test database..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/smartapply_test" npx prisma migrate deploy --schema=./apps/api/prisma/schema.prisma
echo "✅ Test database ready"
echo ""

echo "=================================="
echo "✨ Setup Complete!"
echo "=================================="
echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Start the Backend API (Terminal 1):"
echo "   cd apps/api && npm run start:dev"
echo "   → http://localhost:3000"
echo "   → Swagger UI: http://localhost:3000/docs"
echo ""
echo "2. Start the Frontend (Terminal 2):"
echo "   cd apps/web && npm run dev"
echo "   → http://localhost:3001"
echo ""
echo "3. Login with demo user:"
echo "   Email: demo@smartapply.com"
echo "   Password: Demo123!"
echo ""
echo "4. Run tests:"
echo "   Backend E2E: cd apps/api && npm run test:e2e"
echo "   Auth Refresh: cd apps/api && npm run test:e2e -- auth-refresh.e2e-spec.ts"
echo "   Frontend Lint: cd apps/web && npm run lint"
echo ""
echo "   Note: E2E tests use separate 'smartapply_test' database"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Full documentation"
echo "   - .github/agents/my-agents.md - Agent instructions"
echo "   - MVP_FEATURES.md - Feature tracking & security todos"
echo ""
echo "🔒 Security Note:"
echo "   Current security score: 6/10"
echo "   See MVP_FEATURES.md for critical security todos before production!"
echo ""
echo "Happy coding! 🚀"
