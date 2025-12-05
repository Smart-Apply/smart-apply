#!/bin/bash

# Fix Test Imports Script
# This script corrects import paths in test files after migration to __tests__/unit/ structure

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Fixing Test Import Paths...${NC}"
echo ""

cd apps/api

# Counter for fixed files
fixed_count=0

# Fix imports in src/[module]/__tests__/unit/*.spec.ts files
# These need to reference ../../ instead of ./
echo -e "${GREEN}Phase 1: Fixing imports in module-level unit tests${NC}"
echo "----------------------------------------"

for test_file in $(find src -path "*/src/*/__tests__/unit/*.spec.ts" -not -path "*/parsers/*" -not -path "*/dto/*" -not -path "*/guards/*"); do
    if [ -f "$test_file" ]; then
        echo "  Processing: $test_file"
        
        # Replace relative imports that should go up 2 levels
        sed -i '' "s|from '\./\([^/]*\)\.service'|from '../../\1.service'|g" "$test_file"
        sed -i '' "s|from '\./\([^/]*\)\.interface'|from '../../\1.interface'|g" "$test_file"
        sed -i '' "s|from '\./\([^/]*\)\.util'|from '../../\1.util'|g" "$test_file"
        sed -i '' "s|from '\./\([^/]*\)\.schema'|from '../../\1.schema'|g" "$test_file"
        
        # Fix imports from sibling modules (../module/service -> ../../../module/service)
        sed -i '' "s|from '\.\./\([^/]*\)/\([^/]*\)\.service'|from '../../../\1/\2.service'|g" "$test_file"
        sed -i '' "s|from '\.\./\([^/]*\)/\([^/]*\)\.interface'|from '../../../\1/\2.interface'|g" "$test_file"
        
        # Fix nested imports (../jobs/interfaces -> ../../../jobs/interfaces)
        sed -i '' "s|from '\.\./\([^/]*\)/\([^/]*\)/\([^']*\)'|from '../../../\1/\2/\3'|g" "$test_file"
        
        fixed_count=$((fixed_count + 1))
    fi
done

echo ""
echo -e "${GREEN}Phase 2: Fixing imports in parser unit tests${NC}"
echo "----------------------------------------"

# Fix parsers (src/job-postings/__tests__/unit/parsers/*.spec.ts)
# These need ../../../parsers/ instead of ./
for test_file in $(find src -path "*/src/*/parsers/__tests__/unit/*.spec.ts"); do
    if [ -f "$test_file" ]; then
        echo "  Processing: $test_file"
        sed -i '' "s|from '\./\([^']*\)'|from '../../../\1'|g" "$test_file"
        fixed_count=$((fixed_count + 1))
    fi
done

# Alternative path for parsers in __tests__/unit/parsers/
for test_file in $(find src -path "*/__tests__/unit/parsers/*.spec.ts"); do
    if [ -f "$test_file" ]; then
        echo "  Processing: $test_file"
        sed -i '' "s|from '\./\([^']*\)\.parser'|from '../../../parsers/\1.parser'|g" "$test_file"
        fixed_count=$((fixed_count + 1))
    fi
done

echo ""
echo -e "${GREEN}Phase 3: Fixing imports in DTO unit tests${NC}"
echo "----------------------------------------"

# Fix DTOs (src/applications/__tests__/unit/dto/*.spec.ts)
# These need ../../../dto/ instead of ./
for test_file in $(find src -path "*/__tests__/unit/dto/*.spec.ts"); do
    if [ -f "$test_file" ]; then
        echo "  Processing: $test_file"
        sed -i '' "s|from '\./\([^']*\)\.dto'|from '../../../dto/\1.dto'|g" "$test_file"
        fixed_count=$((fixed_count + 1))
    fi
done

echo ""
echo -e "${GREEN}Phase 4: Fixing imports in guard unit tests${NC}"
echo "----------------------------------------"

# Fix guards (src/common/__tests__/unit/guards/*.spec.ts)
# These need ../../../guards/ instead of ./
for test_file in $(find src -path "*/__tests__/unit/guards/*.spec.ts"); do
    if [ -f "$test_file" ]; then
        echo "  Processing: $test_file"
        sed -i '' "s|from '\./\([^']*\)\.guard'|from '../../../guards/\1.guard'|g" "$test_file"
        sed -i '' "s|from '\.\./decorators/\([^']*\)'|from '../../../decorators/\1'|g" "$test_file"
        fixed_count=$((fixed_count + 1))
    fi
done

echo ""
echo -e "${GREEN}✅ Import fixes completed!${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  Fixed files: $fixed_count"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "  1. Run: npm run test:unit"
echo "  2. Check for remaining import errors"
echo "  3. Manually fix any complex import paths if needed"
echo ""
