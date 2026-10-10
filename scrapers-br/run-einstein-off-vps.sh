#!/usr/bin/env bash
# Compat: redirecciona para o script unificado Einstein + Fleury.
ROOT="$(cd "$(dirname "$0")" && pwd)"
exec "$ROOT/run-vagas-com-off-vps.sh" einstein "$@"
