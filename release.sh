#!/bin/bash
set -e

REGISTRY="registry.yurii.live"
PLATFORMS="linux/amd64,linux/arm64"

# Extract version from package.json
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
    echo "Error: Could not extract version from package.json"
    exit 1
fi

IMAGE="${REGISTRY}/gca"

# Ensure buildx builder exists and supports multi-platform
BUILDER_NAME="multiplatform"
if ! docker buildx inspect "$BUILDER_NAME" &>/dev/null; then
    echo "Creating buildx builder '${BUILDER_NAME}'..."
    docker buildx create --name "$BUILDER_NAME" --use
fi
docker buildx use "$BUILDER_NAME"

echo "=== GCA Release ==="
echo "Version: ${VERSION}"
echo "Platforms: ${PLATFORMS}"
echo ""

echo "Building and pushing ${IMAGE}:${VERSION}..."
docker buildx build \
    --platform "$PLATFORMS" \
    --tag "${IMAGE}:${VERSION}" \
    --tag "${IMAGE}:latest" \
    --push \
    .

echo ""
echo "=== Deploying to personal LXC ==="

DEPLOY_HOST="agent@192.168.10.40"
SSH_KEY="$HOME/.ssh/id_agent"
CONTAINER_NAME="gca"

ssh -i "$SSH_KEY" "$DEPLOY_HOST" bash -s <<EOF
  set -e
  docker pull ${IMAGE}:latest
  docker stop ${CONTAINER_NAME} 2>/dev/null || true
  docker rm ${CONTAINER_NAME} 2>/dev/null || true
  docker run -d \
    --name ${CONTAINER_NAME} \
    --restart unless-stopped \
    -p 6543:3000 \
    --env-file /home/agent/gca.env \
    -e GOOGLE_REDIRECT_URI=https://gca.yurii.live/api/auth/callback \
    ${IMAGE}:latest
  docker image prune -f
EOF

echo ""
echo "Release complete!"
echo "  - ${IMAGE}:${VERSION}"
echo "  - ${IMAGE}:latest"
echo "  - Platforms: ${PLATFORMS}"
echo "  - Deployed to ${DEPLOY_HOST}"
