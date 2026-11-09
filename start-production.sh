#!/usr/bin/env sh
# ImageScreen — démarrage en production (Linux / macOS / NAS).
# Installe les dépendances manquantes, compile l'interface puis lance le serveur.
set -e
cd "$(dirname "$0")"

echo "==================================================="
echo "   ImageScreen — Affichage dynamique"
echo "==================================================="

[ -d node_modules ]          || { echo "[1/3] Installation des dépendances racine…";   npm install; }
[ -d backend/node_modules ]  || { echo "[2/3] Installation des dépendances backend…";  npm install --prefix backend; }
[ -d frontend/node_modules ] || { echo "[3/3] Installation des dépendances frontend…"; npm install --prefix frontend --legacy-peer-deps; }

echo "Compilation de l'interface…"
npm run build

echo
echo "Administration : http://localhost:5000"
echo "Lecteur TV     : http://[ADRESSE_IP_DE_CE_SERVEUR]:5000/tv"
echo "==================================================="
echo

exec npm run backend
