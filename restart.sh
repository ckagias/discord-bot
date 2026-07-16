#!/bin/bash
set -e

usage() {
    echo "Usage: ./restart.sh [--commands] [--bot] [--dashboard] [--lavalink|--music]"
    echo ""
    echo "  (no flag)             Restart lavalink, rebuild bot, re-register slash commands, then rebuild dashboard"
    echo "  --commands            Re-register slash commands only (no image rebuild)"
    echo "  --bot                 Rebuild and restart the bot container only"
    echo "  --dashboard           Rebuild and restart the dashboard container only"
    echo "  --lavalink, --music   Restart the lavalink container only"
}

case "$1" in
    --commands)
        echo "Registering slash commands..."
        docker compose run --rm bot node dist/src/cmd.js
        echo "Done!"
        ;;
    --bot)
        echo "Rebuilding and restarting bot..."
        docker compose up --build -d bot
        echo "Bot is running!"
        ;;
    --dashboard)
        echo "Rebuilding and restarting dashboard..."
        docker compose up --build -d dashboard
        echo "Dashboard is running!"
        ;;
    --lavalink|--music)
        echo "Restarting lavalink..."
        docker compose up -d lavalink
        echo "Lavalink is running!"
        ;;
    "")
        echo "Restarting lavalink..."
        docker compose up -d lavalink
        echo "Rebuilding and restarting bot..."
        docker compose up --build -d bot
        echo "Registering slash commands..."
        docker compose run --rm bot node dist/src/cmd.js
        echo "Rebuilding and restarting dashboard..."
        docker compose up --build -d dashboard
        echo "All services are running!"
        ;;
    --help)
        usage
        ;;
    *)
        echo "Unknown flag: $1"
        echo ""
        usage
        exit 1
        ;;
esac
