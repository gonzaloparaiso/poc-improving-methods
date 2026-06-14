#!/usr/bin/env bash
# Conjunto de pruebas que debe pasar SIEMPRE antes de desplegar.
# Uso: ./scripts/pre-deploy-tests.sh
# (Mañana se ejecutará desde GitHub Actions antes del deploy.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "▶ 1/4  Pruebas de API (node:test)"
( cd "$ROOT/api" && npm test )

echo "▶ 2/4  Pruebas unitarias (Vitest)"
( cd "$ROOT/web" && npm run test:unit )

echo "▶ 3/4  Typecheck + build (web)"
( cd "$ROOT/web" && npm run build )

echo "▶ 4/4  Pruebas E2E (Playwright)"
( cd "$ROOT/web" && npm run test:e2e )

echo ""
echo "✅ Todas las pruebas pasaron — listo para desplegar"
