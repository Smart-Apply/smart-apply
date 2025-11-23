#!/bin/bash

# Script to delete all local Git branches except main, dev, master, and int
# Usage: ./cleanup-branches.sh

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧹 Git Branch Cleanup Script${NC}"
echo "================================================"
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Not a git repository${NC}"
    exit 1
fi

# Fetch latest changes from remote and prune stale references
echo -e "${YELLOW}📡 Fetching latest changes from remote...${NC}"
if git fetch --all --prune; then
    echo -e "${GREEN}✅ Successfully synced with remote${NC}"
else
    echo -e "${RED}⚠️  Warning: Failed to fetch from remote${NC}"
fi
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${GREEN}${CURRENT_BRANCH}${NC}"
echo ""

# Protected branches that should not be deleted
PROTECTED_BRANCHES=("main" "dev" "master" "int")

# Check if current branch is protected
is_protected() {
    local branch=$1
    for protected in "${PROTECTED_BRANCHES[@]}"; do
        if [[ "$branch" == "$protected" ]]; then
            return 0
        fi
    done
    return 1
}

# If current branch is not protected, switch to main (or first available protected branch)
if ! is_protected "$CURRENT_BRANCH"; then
    echo -e "${YELLOW}⚠️  Current branch '${CURRENT_BRANCH}' will be deleted.${NC}"
    
    # Try to switch to main, dev, master, or int (in that order)
    SWITCHED=false
    for branch in "${PROTECTED_BRANCHES[@]}"; do
        if git show-ref --verify --quiet "refs/heads/$branch"; then
            echo -e "Switching to '${GREEN}${branch}${NC}'..."
            git checkout "$branch" > /dev/null 2>&1
            SWITCHED=true
            break
        fi
    done
    
    if [ "$SWITCHED" = false ]; then
        echo -e "${RED}❌ Error: No protected branch found to switch to${NC}"
        exit 1
    fi
    
    echo ""
fi

# Get list of all local branches except protected ones
echo -e "${YELLOW}📋 Finding branches to delete...${NC}"
BRANCHES_TO_DELETE=$(git branch | grep -v "^\*" | grep -vE "^\s*(main|dev|master|int)\s*$" | sed 's/^[* ]*//')

# Check if there are branches to delete
if [ -z "$BRANCHES_TO_DELETE" ]; then
    echo -e "${GREEN}✅ No branches to delete. Only protected branches exist.${NC}"
    exit 0
fi

# Show branches that will be deleted
echo ""
echo -e "${YELLOW}The following branches will be deleted:${NC}"
echo "$BRANCHES_TO_DELETE" | while read -r branch; do
    echo -e "  ${RED}• $branch${NC}"
done
echo ""

# Ask for confirmation
read -p "Do you want to continue? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Cancelled by user${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🗑️  Deleting branches...${NC}"

# Delete branches
DELETED_COUNT=0
FAILED_COUNT=0

echo "$BRANCHES_TO_DELETE" | while read -r branch; do
    if [ -n "$branch" ]; then
        if git branch -D "$branch" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Deleted: $branch"
            ((DELETED_COUNT++))
        else
            echo -e "${RED}✗${NC} Failed to delete: $branch"
            ((FAILED_COUNT++))
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
git branch | while read -r branch; do
    echo -e "  ${GREEN}• $branch${NC}"
done
echo ""
