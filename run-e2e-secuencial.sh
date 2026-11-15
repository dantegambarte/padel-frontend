#!/usr/bin/env bash
# Corre los 3 proyectos de a uno. Cada invocación levanta sus propios servers
# (reuseExistingServer: false) y el webServer del backend corre
# `migration:run && seed` antes de arrancar, así que la base se resiembra sola
# entre proyecto y proyecto.
#
# Los artefactos de cada proyecto quedan en test-results/<proyecto> y el script
# sale con código 1 si algún proyecto falló.
cd "$(dirname "$0")" || exit 1

rm -rf test-results
FAILED=()

for P in "Desktop Full HD" "Notebook" "Mobile"; do
  echo "########## INICIO PROYECTO: ${P} ##########"
  OUT="test-results/${P// /-}"
  if ! pnpm exec playwright test --project="${P}" --reporter=line --output="${OUT}" 2>&1; then
    FAILED+=("${P}")
  fi
  echo "########## FIN PROYECTO: ${P} ##########"
  sleep 8
done

echo "########## SECUENCIA COMPLETA ##########"
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "Proyectos con fallos: ${FAILED[*]}"
  exit 1
fi
