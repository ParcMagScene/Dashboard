#!/bin/bash
# ===============================================
#  Lanceur Desktop pour Calendar Dashboard
#  Double-cliquez pour démarrer le dashboard
# ===============================================

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/Users/reunion/Calendar/calendar-dashboard"
LOG_FILE="$PROJECT_DIR/server.log"

echo -e "${BLUE}╔═══════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        🗓️  CALENDAR DASHBOARD        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════╝${NC}"
echo ""

# Fonction pour vérifier si le serveur tourne déjà
check_server_status() {
    if lsof -i:3001 > /dev/null 2>&1; then
        return 0  # Serveur en cours
    fi
    return 1  # Serveur arrêté
}

# Fonction pour arrêter le serveur
stop_server() {
    echo -e "${YELLOW}🛑 Arrêt du dashboard...${NC}"
    pkill -f "node server/index.js"
    sleep 1
    if check_server_status; then
        pkill -9 -f "node server/index.js"
        sleep 1
    fi
    echo -e "${GREEN}✅ Dashboard arrêté !${NC}"
}

# Fonction pour nettoyer à la fermeture
cleanup() {
    echo ""
    stop_server
    echo -e "${YELLOW}👋 Vous pouvez fermer cette fenêtre${NC}"
    exit 0
}

# Capturer Ctrl+C pour nettoyer proprement
trap cleanup INT

# Vérifier que le projet existe
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}❌ Projet non trouvé: $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Appuyez sur Entrée pour fermer...${NC}"
    read
    exit 1
fi

# Se déplacer dans le répertoire du projet
cd "$PROJECT_DIR"

# Vérifier si le serveur tourne déjà
if check_server_status; then
    echo -e "${GREEN}✅ Le dashboard est déjà en cours d'exécution !${NC}"
    echo ""
    echo -e "${BLUE}📍 Accès Web:${NC}"
    echo -e "   🏠 Local:        ${YELLOW}http://localhost:3001${NC}"
    echo -e "   🌐 Réseau:       ${YELLOW}http://192.168.205.75:3001${NC}"
    echo -e "   ⚙️  Admin:        ${YELLOW}http://localhost:3001/admin.html${NC}"
    echo ""
    echo -e "${BLUE}🎮 Options:${NC}"
    echo -e "   ${YELLOW}1${NC} → Redémarrer le dashboard"  
    echo -e "   ${YELLOW}2${NC} → Arrêter le dashboard"
    echo -e "   ${YELLOW}q${NC} → Quitter sans rien faire"
    echo ""
    echo -n -e "${BLUE}Votre choix: ${NC}"
    read choice
    
    case $choice in
        1)
            echo -e "${YELLOW}🔄 Redémarrage du dashboard...${NC}"
            stop_server
            ;;
        2)
            stop_server
            exit 0
            ;;
        *)
            echo -e "${GREEN}👋 À bientôt !${NC}"
            exit 0
            ;;
    esac
fi

# Proposer le mode de fonctionnement
echo -e "${BLUE}🎯 Mode de fonctionnement:${NC}"
echo -e "   ${YELLOW}1${NC} → Mode Normal (interactif, s'arrête à la fermeture)"
echo -e "   ${YELLOW}2${NC} → Mode Daemon (continue après fermeture du terminal)"
echo ""
echo -n -e "${BLUE}Votre choix (1-2): ${NC}"
read -t 10 mode_choice

if [ "$mode_choice" = "2" ]; then
    # Mode Daemon
    echo -e "${YELLOW}🚀 Démarrage en mode daemon...${NC}"
    cd "$PROJECT_DIR"
    nohup node server/index.js > "$LOG_FILE" 2>&1 &
    sleep 3
    
    if check_server_status; then
        echo -e "${GREEN}🎉 Dashboard démarré en mode daemon !${NC}"
        echo ""
        echo -e "${BLUE}📍 Accès Web:${NC}"
        echo -e "   🏠 Local:        ${YELLOW}http://localhost:3001${NC}"
        echo -e "   🌐 Réseau:       ${YELLOW}http://192.168.205.75:3001${NC}"
        echo -e "   ⚙️  Admin:        ${YELLOW}http://localhost:3001/admin.html${NC}"
        echo ""
        echo -e "${GREEN}✨ Le dashboard continuera à tourner après fermeture !${NC}"
        echo -e "${YELLOW}📝 Logs disponibles dans: ${LOG_FILE}${NC}"
        echo ""
        echo -e "${GREEN}👋 Fermeture automatique du terminal dans 3 secondes...${NC}"
        sleep 3
        osascript -e 'tell application "Terminal" to close first window' & exit 0
    else
        echo -e "${RED}❌ Échec du démarrage en mode daemon${NC}"
        exit 1
    fi
else
    # Mode Normal (interactif)
    echo -e "${YELLOW}🚀 Démarrage en mode normal...${NC}"
    
    # Arrêter toute instance précédente
    echo -e "${YELLOW}🧹 Nettoyage des processus précédents...${NC}"
    pkill -f "node server/index.js" > /dev/null 2>&1
    sleep 1
    
    # Démarrer le dashboard
    cd "$PROJECT_DIR"
    node server/index.js > "$LOG_FILE" 2>&1 &
    sleep 3
fi

# Vérifier si le démarrage a réussi
if check_server_status; then
    echo ""
    echo -e "${GREEN}🎉 Dashboard démarré avec succès !${NC}"
    echo ""
    echo -e "${BLUE}📍 Accès Web:${NC}"
    echo -e "   🏠 Local:        ${YELLOW}http://localhost:3001${NC}"
    echo -e "   🌐 Réseau:       ${YELLOW}http://192.168.205.75:3001${NC}"
    echo -e "   ⚙️  Admin:        ${YELLOW}http://localhost:3001/admin.html${NC}"
    echo ""
    echo -e "${BLUE}🎮 Contrôles:${NC}"
    echo -e "   ${YELLOW}Ctrl+C${NC} → Arrêter le dashboard"
    echo ""
    echo -e "${YELLOW}💡 Le dashboard tourne en arrière-plan...${NC}"
    echo -e "${YELLOW}🔄 Vous pouvez utiliser le navigateur maintenant${NC}"
    echo ""
    echo -e "${GREEN}✨ Dashboard prêt ! Appuyez sur Ctrl+C pour arrêter${NC}"
    
    # Maintenir le script ouvert et surveiller le serveur
    while true; do
        if ! check_server_status; then
            echo -e "${RED}⚠️  Serveur arrêté de manière inattendue !${NC}"
            break
        fi
        sleep 5
    done
    
else
    echo -e "${RED}❌ Échec du démarrage du dashboard${NC}"
    echo -e "${YELLOW}Vérifiez les logs: $LOG_FILE${NC}"
    echo -e "${YELLOW}Appuyez sur Entrée pour fermer...${NC}"
    read
    exit 1
fi

# Boucle d'attente jusqu'à interruption
while true; do
    sleep 1
done