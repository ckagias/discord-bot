#!/bin/bash
set -e

# Restores the mongodb container's discordbot database from a backup.sh archive.

usage() {
    echo "Usage: ./restore.sh <path-to-archive.gz>"
    echo ""
    echo "  Restores the discordbot database from a backup.sh archive."
    echo "  WARNING: this drops and replaces existing collections in the database."
}

if [ -z "$1" ]; then
    usage
    exit 1
fi

ARCHIVE_PATH="$1"

if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "Archive not found: $ARCHIVE_PATH"
    exit 1
fi

read -p "This will overwrite the current discordbot database. Continue? [y/N] " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Aborted."
    exit 1
fi

echo "Restoring mongodb database 'discordbot' from $ARCHIVE_PATH..."
docker compose exec -T mongodb mongorestore --db=discordbot --archive --gzip --drop < "$ARCHIVE_PATH"

echo "Done!"
