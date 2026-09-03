#!/usr/bin/env bash
# Corre los 3 proyectos de a uno. Cada invocación levanta sus propios servers
# (reuseExistingServer: false) y el webServer del backend corre
# `migration:run && seed` antes de arrancar, así que la base se resiembra sola
# entre proyecto y proyecto.
cd "$(dirname "$0")" || exit 1

for P in "Desktop Full HD" "Notebook" "Mobile"; do
  echo "########## INICIO PROYECTO: ${P} ##########"
  rm -rf test-results
  npx playwright test --project="${P}" --reporter=line 2>&1
  echo "########## FIN PROYECTO: ${P} ##########"
  sleep 8
done

echo "########## SECUENCIA COMPLETA ##########"
