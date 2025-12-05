#!/bin/bash
set -e

# Docker Build Script mit Optimierungen
# ==========================================================
# Dieses Skript baut optimierte Container-Images mit BuildKit
#
# Usage:
#   ./build-optimized.sh [api|web|all]
#
# Features:
# - Multi-stage builds mit Layer-Caching
# - BuildKit Optimierungen (parallel builds, cache mounts)
# - Automatisches Cleanup von dangling images
# - Build-Metriken (Größe, Build-Zeit)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${AZURE_CONTAINER_REGISTRY:-"smartapplydevacr.azurecr.io"}
API_IMAGE="${REGISTRY}/smart-apply-api"
WEB_IMAGE="${REGISTRY}/smart-apply-web"
TAG=${BUILD_TAG:-"latest"}

# Enable BuildKit
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

build_api() {
    print_header "Building API Image (Optimized)"
    
    start_time=$(date +%s)
    
    docker build \
        --target production \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "${API_IMAGE}:latest" \
        --tag "${API_IMAGE}:${TAG}" \
        --tag "${API_IMAGE}:latest" \
        --file infra/Dockerfile \
        --progress=plain \
        .
    
    end_time=$(date +%s)
    build_time=$((end_time - start_time))
    
    # Get image size
    size=$(docker images "${API_IMAGE}:${TAG}" --format "{{.Size}}")
    
    print_success "API Image built successfully!"
    echo -e "  ${BLUE}Image:${NC} ${API_IMAGE}:${TAG}"
    echo -e "  ${BLUE}Size:${NC} ${size}"
    echo -e "  ${BLUE}Build Time:${NC} ${build_time}s"
}

build_web() {
    print_header "Building Web Image (Optimized)"
    
    start_time=$(date +%s)
    
    docker build \
        --target runner \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        --cache-from "${WEB_IMAGE}:latest" \
        --tag "${WEB_IMAGE}:${TAG}" \
        --tag "${WEB_IMAGE}:latest" \
        --file infra/Dockerfile.web \
        --progress=plain \
        .
    
    end_time=$(date +%s)
    build_time=$((end_time - start_time))
    
    # Get image size
    size=$(docker images "${WEB_IMAGE}:${TAG}" --format "{{.Size}}")
    
    print_success "Web Image built successfully!"
    echo -e "  ${BLUE}Image:${NC} ${WEB_IMAGE}:${TAG}"
    echo -e "  ${BLUE}Size:${NC} ${size}"
    echo -e "  ${BLUE}Build Time:${NC} ${build_time}s"
}

cleanup() {
    print_header "Cleaning up dangling images"
    docker image prune -f
    print_success "Cleanup completed"
}

show_stats() {
    print_header "Image Size Comparison"
    
    echo -e "${BLUE}Current Images:${NC}"
    docker images | grep "smart-apply" | grep -v "<none>"
    
    echo ""
    echo -e "${BLUE}Expected Improvements:${NC}"
    echo -e "  ${GREEN}API:${NC}  3.51 GB → ~800 MB (77% reduction)"
    echo -e "  ${GREEN}Web:${NC}  238 MB → ~150 MB (37% reduction)"
}

push_images() {
    print_header "Pushing images to ACR"
    
    # Login to ACR
    if [ -n "${AZURE_CONTAINER_REGISTRY}" ]; then
        print_warning "Logging in to ACR..."
        az acr login --name "${AZURE_CONTAINER_REGISTRY}"
    fi
    
    if [ "$1" = "api" ] || [ "$1" = "all" ]; then
        echo "Pushing ${API_IMAGE}:${TAG}..."
        docker push "${API_IMAGE}:${TAG}"
        docker push "${API_IMAGE}:latest"
        print_success "API image pushed"
    fi
    
    if [ "$1" = "web" ] || [ "$1" = "all" ]; then
        echo "Pushing ${WEB_IMAGE}:${TAG}..."
        docker push "${WEB_IMAGE}:${TAG}"
        docker push "${WEB_IMAGE}:latest"
        print_success "Web image pushed"
    fi
}

# Main script
main() {
    local target=${1:-"all"}
    
    cd "$(dirname "$0")/.."
    
    print_header "Docker Image Optimization Build"
    echo -e "${BLUE}Target:${NC} ${target}"
    echo -e "${BLUE}Registry:${NC} ${REGISTRY}"
    echo -e "${BLUE}Tag:${NC} ${TAG}"
    echo ""
    
    case $target in
        api)
            build_api
            ;;
        web)
            build_web
            ;;
        all)
            build_api
            echo ""
            build_web
            ;;
        *)
            print_error "Invalid target: $target"
            echo "Usage: $0 [api|web|all]"
            exit 1
            ;;
    esac
    
    echo ""
    cleanup
    echo ""
    show_stats
    
    # Ask if user wants to push
    echo ""
    read -p "Push images to ACR? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        push_images "$target"
    fi
    
    print_success "All done! 🚀"
}

main "$@"
