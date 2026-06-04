#!/usr/bin/env bash
set -euo pipefail

# ── Cargar .env ───────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "❌  No se encontró .env — copia .env.example y llena los valores."
  exit 1
fi
set -a; source .env; set +a

# ── Verificar vars del registry ───────────────────────────────
if [[ -z "${REGISTRY_HOST:-}" || -z "${REGISTRY_USER:-}" || -z "${REGISTRY_PASS:-}" ]]; then
  echo "❌  Faltan variables del registry en .env:"
  echo "      REGISTRY_HOST, REGISTRY_USER, REGISTRY_PASS"
  exit 1
fi

# ── Parámetros ────────────────────────────────────────────────
TAG="${1:-${IMAGE_TAG:-latest}}"
IMAGE="${REGISTRY_HOST}/inmovisoft"
BUILDER="inmovisoft-builder"

echo ""
echo "  Registry : ${REGISTRY_HOST}"
echo "  Imagen   : ${IMAGE}"
echo "  Tag      : ${TAG}"
echo ""

# ── Login ─────────────────────────────────────────────────────
echo "→ docker login ${REGISTRY_HOST}..."
echo "${REGISTRY_PASS}" | docker login "${REGISTRY_HOST}" \
  --username "${REGISTRY_USER}" --password-stdin

# ── Buildx builder (crea solo si no existe) ───────────────────
if ! docker buildx inspect "${BUILDER}" &>/dev/null; then
  echo "→ Creando builder '${BUILDER}'..."
  docker buildx create --name "${BUILDER}" --driver docker-container --bootstrap
fi
docker buildx use "${BUILDER}"

# ── Build + push ──────────────────────────────────────────────
echo "→ Building y publicando ${IMAGE}:${TAG}..."
docker buildx build \
  --platform linux/amd64 \
  --push \
  --tag "${IMAGE}:${TAG}" \
  --tag "${IMAGE}:latest" \
  --cache-from "type=registry,ref=${IMAGE}:cache" \
  --cache-to   "type=registry,ref=${IMAGE}:cache,mode=max" \
  .

echo ""
echo "✅  Imagen publicada:"
echo "      ${IMAGE}:${TAG}"
echo "      ${IMAGE}:latest"
echo ""
echo "   Para desplegar:"
echo "      docker compose -f docker-compose.prod.yml pull && \\"
echo "      docker compose -f docker-compose.prod.yml up -d"
