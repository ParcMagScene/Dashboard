#!/bin/bash

echo "🔍 Vérification des services Dashboard..."
echo ""

# Vérifier AdGuard Home
echo "📡 AdGuard Home (DNS):"
if sudo launchctl list | grep -q AdGuardHome; then
    echo "   ✅ En cours d'exécution"
    curl -s http://localhost:8080/control/status > /dev/null && echo "   ✅ Interface web accessible (port 8080)"
else
    echo "   ❌ Non démarré"
fi
echo ""

# Vérifier Caddy
echo "🔀 Caddy (Reverse Proxy):"
if launchctl list | grep -q homebrew.mxcl.caddy; then
    echo "   ✅ En cours d'exécution"
    curl -s http://localhost:80 > /dev/null 2>&1 && echo "   ✅ Port 80 accessible"
else
    echo "   ❌ Non démarré"
fi
echo ""

# Vérifier Dashboard
echo "📊 Dashboard Node.js:"
if launchctl list | grep -q com.dashboard.server; then
    echo "   ✅ En cours d'exécution"
    curl -s http://localhost:3001 > /dev/null && echo "   ✅ API accessible (port 3001)"
else
    echo "   ❌ Non démarré"
fi
echo ""

# Vérifier DNS
echo "🌐 Résolution DNS:"
if ping -c 1 dashboard.mag > /dev/null 2>&1; then
    echo "   ✅ dashboard.mag résolu correctement"
else
    echo "   ❌ Impossible de résoudre dashboard.mag"
fi

if ping -c 1 adguard.mag > /dev/null 2>&1; then
    echo "   ✅ adguard.mag résolu correctement"
else
    echo "   ❌ Impossible de résoudre adguard.mag"
fi
echo ""

# Vérifier l'accès HTTP
echo "🌍 Accès HTTP:"
if curl -s http://dashboard.mag > /dev/null 2>&1; then
    echo "   ✅ http://dashboard.mag accessible"
else
    echo "   ❌ http://dashboard.mag non accessible"
fi

if curl -s http://adguard.mag > /dev/null 2>&1; then
    echo "   ✅ http://adguard.mag accessible"
else
    echo "   ❌ http://adguard.mag non accessible"
fi

echo ""
echo "✨ Vérification terminée !"
