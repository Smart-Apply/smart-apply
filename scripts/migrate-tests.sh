#!/bin/bash

# Test Migration Script
# Reorganisiert Tests nach Best Practices Struktur

set -e

echo "🚀 Starting Test Migration..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to API directory
cd "$(dirname "$0")/../apps/api"

echo "📁 Current directory: $(pwd)"
echo ""

# Phase 1: Create new directory structure
echo "${GREEN}Phase 1: Creating new directory structure${NC}"
echo "----------------------------------------"

modules=(
  "auth"
  "profile"
  "applications"
  "llm"
  "pdf"
  "storage"
  "jobs"
  "keywords"
  "job-postings"
  "uploads"
  "common"
  "config"
  "prisma"
  "templates"
)

for module in "${modules[@]}"; do
  if [ -d "src/$module" ]; then
    echo "  Creating __tests__ structure for $module..."
    mkdir -p "src/$module/__tests__/unit"
    mkdir -p "src/$module/__tests__/integration"
  fi
done

echo "✅ Directory structure created"
echo ""

# Phase 2: Move existing unit tests
echo "${GREEN}Phase 2: Moving and renaming unit tests${NC}"
echo "----------------------------------------"

# Auth tests (currently no unit tests, only e2e)
# Will need to create new unit tests

# Applications tests
if [ -f "src/applications/applications.service.spec.ts" ]; then
  echo "  Moving applications.service.spec.ts → auth/__tests__/unit/applications.service.unit.spec.ts"
  mv "src/applications/applications.service.spec.ts" \
     "src/applications/__tests__/unit/applications.service.unit.spec.ts"
fi

if [ -f "src/applications/language-detection.spec.ts" ]; then
  echo "  Moving language-detection.spec.ts → applications/__tests__/unit/language-detection.unit.spec.ts"
  mv "src/applications/language-detection.spec.ts" \
     "src/applications/__tests__/unit/language-detection.unit.spec.ts"
fi

if [ -f "src/applications/resume-template-description.spec.ts" ]; then
  echo "  Moving resume-template-description.spec.ts → applications/__tests__/unit/resume-template-description.unit.spec.ts"
  mv "src/applications/resume-template-description.spec.ts" \
     "src/applications/__tests__/unit/resume-template-description.unit.spec.ts"
fi

# Jobs tests
if [ -f "src/jobs/jobs.service.spec.ts" ]; then
  echo "  Moving jobs.service.spec.ts → jobs/__tests__/unit/jobs.service.unit.spec.ts"
  mv "src/jobs/jobs.service.spec.ts" \
     "src/jobs/__tests__/unit/jobs.service.unit.spec.ts"
fi

if [ -f "src/jobs/providers/in-memory-queue.provider.spec.ts" ]; then
  echo "  Moving in-memory-queue.provider.spec.ts → jobs/__tests__/unit/in-memory-queue.provider.unit.spec.ts"
  mkdir -p "src/jobs/__tests__/unit/providers"
  mv "src/jobs/providers/in-memory-queue.provider.spec.ts" \
     "src/jobs/__tests__/unit/providers/in-memory-queue.provider.unit.spec.ts"
fi

# Job Postings tests
if [ -f "src/job-postings/job-postings.service.spec.ts" ]; then
  echo "  Moving job-postings.service.spec.ts → job-postings/__tests__/unit/job-postings.service.unit.spec.ts"
  mv "src/job-postings/job-postings.service.spec.ts" \
     "src/job-postings/__tests__/unit/job-postings.service.unit.spec.ts"
fi

if [ -f "src/job-postings/parsers/text.parser.spec.ts" ]; then
  echo "  Moving text.parser.spec.ts → job-postings/__tests__/unit/parsers/text.parser.unit.spec.ts"
  mkdir -p "src/job-postings/__tests__/unit/parsers"
  mv "src/job-postings/parsers/text.parser.spec.ts" \
     "src/job-postings/__tests__/unit/parsers/text.parser.unit.spec.ts"
fi

if [ -f "src/job-postings/parsers/url.parser.spec.ts" ]; then
  echo "  Moving url.parser.spec.ts → job-postings/__tests__/unit/parsers/url.parser.unit.spec.ts"
  mv "src/job-postings/parsers/url.parser.spec.ts" \
     "src/job-postings/__tests__/unit/parsers/url.parser.unit.spec.ts"
fi

if [ -f "src/job-postings/parsers/docx.parser.spec.ts" ]; then
  echo "  Moving docx.parser.spec.ts → job-postings/__tests__/unit/parsers/docx.parser.unit.spec.ts"
  mv "src/job-postings/parsers/docx.parser.spec.ts" \
     "src/job-postings/__tests__/unit/parsers/docx.parser.unit.spec.ts"
fi

# Keywords tests
if [ -f "src/keywords/keywords.service.spec.ts" ]; then
  echo "  Moving keywords.service.spec.ts → keywords/__tests__/unit/keywords.service.unit.spec.ts"
  mv "src/keywords/keywords.service.spec.ts" \
     "src/keywords/__tests__/unit/keywords.service.unit.spec.ts"
fi

if [ -f "src/keywords/weighted-score.spec.ts" ]; then
  echo "  Moving weighted-score.spec.ts → keywords/__tests__/unit/weighted-score.unit.spec.ts"
  mv "src/keywords/weighted-score.spec.ts" \
     "src/keywords/__tests__/unit/weighted-score.unit.spec.ts"
fi

# PDF tests
if [ -f "src/pdf/pdf.service.spec.ts" ]; then
  echo "  Moving pdf.service.spec.ts → pdf/__tests__/unit/pdf.service.unit.spec.ts"
  mv "src/pdf/pdf.service.spec.ts" \
     "src/pdf/__tests__/unit/pdf.service.unit.spec.ts"
fi

if [ -f "src/pdf/ats-validator.service.spec.ts" ]; then
  echo "  Moving ats-validator.service.spec.ts → pdf/__tests__/unit/ats-validator.service.unit.spec.ts"
  mv "src/pdf/ats-validator.service.spec.ts" \
     "src/pdf/__tests__/unit/ats-validator.service.unit.spec.ts"
fi

if [ -f "src/pdf/template-renderer.service.spec.ts" ]; then
  echo "  Moving template-renderer.service.spec.ts → pdf/__tests__/unit/template-renderer.service.unit.spec.ts"
  mv "src/pdf/template-renderer.service.spec.ts" \
     "src/pdf/__tests__/unit/template-renderer.service.unit.spec.ts"
fi

if [ -f "src/pdf/experience-description.spec.ts" ]; then
  echo "  Moving experience-description.spec.ts → pdf/__tests__/unit/experience-description.unit.spec.ts"
  mv "src/pdf/experience-description.spec.ts" \
     "src/pdf/__tests__/unit/experience-description.unit.spec.ts"
fi

if [ -f "src/pdf/multilingual-templates.spec.ts" ]; then
  echo "  Moving multilingual-templates.spec.ts → pdf/__tests__/unit/multilingual-templates.unit.spec.ts"
  mv "src/pdf/multilingual-templates.spec.ts" \
     "src/pdf/__tests__/unit/multilingual-templates.unit.spec.ts"
fi

# LLM tests
if [ -f "src/llm/llm.service.ats.spec.ts" ]; then
  echo "  Moving llm.service.ats.spec.ts → llm/__tests__/unit/llm.service.ats.unit.spec.ts"
  mv "src/llm/llm.service.ats.spec.ts" \
     "src/llm/__tests__/unit/llm.service.ats.unit.spec.ts"
fi

if [ -f "src/llm/llm-translation.spec.ts" ]; then
  echo "  Moving llm-translation.spec.ts → llm/__tests__/unit/llm-translation.unit.spec.ts"
  mv "src/llm/llm-translation.spec.ts" \
     "src/llm/__tests__/unit/llm-translation.unit.spec.ts"
fi

# Common/Guards tests
if [ -f "src/common/guards/custom-throttler.guard.spec.ts" ]; then
  echo "  Moving custom-throttler.guard.spec.ts → common/__tests__/unit/guards/custom-throttler.guard.unit.spec.ts"
  mkdir -p "src/common/__tests__/unit/guards"
  mv "src/common/guards/custom-throttler.guard.spec.ts" \
     "src/common/__tests__/unit/guards/custom-throttler.guard.unit.spec.ts"
fi

# Config tests
if [ -f "src/config/env.schema.spec.ts" ]; then
  echo "  Moving env.schema.spec.ts → config/__tests__/unit/env.schema.unit.spec.ts"
  mv "src/config/env.schema.spec.ts" \
     "src/config/__tests__/unit/env.schema.unit.spec.ts"
fi

# Applications DTO tests
if [ -f "src/applications/dto/update-resume-validation.spec.ts" ]; then
  echo "  Moving update-resume-validation.spec.ts → applications/__tests__/unit/dto/update-resume-validation.unit.spec.ts"
  mkdir -p "src/applications/__tests__/unit/dto"
  mv "src/applications/dto/update-resume-validation.spec.ts" \
     "src/applications/__tests__/unit/dto/update-resume-validation.unit.spec.ts"
fi

echo "✅ Unit tests moved and renamed"
echo ""

# Phase 3: Move integration tests
echo "${GREEN}Phase 3: Moving integration tests${NC}"
echo "----------------------------------------"

if [ -f "src/applications/summary-translation.integration.spec.ts" ]; then
  echo "  Moving summary-translation.integration.spec.ts → applications/__tests__/integration/"
  mv "src/applications/summary-translation.integration.spec.ts" \
     "src/applications/__tests__/integration/summary-translation.integration.spec.ts"
fi

if [ -f "src/pdf/pdf.integration.spec.ts" ]; then
  echo "  Moving pdf.integration.spec.ts → pdf/__tests__/integration/"
  mv "src/pdf/pdf.integration.spec.ts" \
     "src/pdf/__tests__/integration/pdf.integration.spec.ts"
fi

if [ -f "src/pdf/pdf-ats.integration.spec.ts" ]; then
  echo "  Moving pdf-ats.integration.spec.ts → pdf/__tests__/integration/"
  mv "src/pdf/pdf-ats.integration.spec.ts" \
     "src/pdf/__tests__/integration/pdf-ats.integration.spec.ts"
fi

echo "✅ Integration tests moved"
echo ""

# Phase 4: Summary
echo "${GREEN}Phase 4: Migration Summary${NC}"
echo "----------------------------------------"

echo ""
echo "📊 Test Structure:"
echo "  - Unit Tests: src/[module]/__tests__/unit/"
echo "  - Integration Tests: src/[module]/__tests__/integration/"
echo "  - E2E Tests: test/e2e/ (unchanged)"
echo ""

echo "🎯 Next Steps:"
echo "  1. Run: npm run test:unit to verify unit tests"
echo "  2. Run: npm run test:integration to verify integration tests"
echo "  3. Run: npm run test:e2e to verify e2e tests"
echo "  4. Fix any broken tests (missing mocks, wrong imports)"
echo "  5. Write missing tests for uncovered modules"
echo "  6. Run: npm run test:all:cov to see full coverage report"
echo ""

echo "${GREEN}✅ Migration completed successfully!${NC}"
echo ""
echo "📝 See TESTING_STRATEGY.md for detailed testing guidelines"
