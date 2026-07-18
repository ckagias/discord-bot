#!/bin/bash
set -e

# Dumps the mongodb container's discordbot database to a gzipped archive, then prunes old ones.

BACKUP_DIR="${BACKUP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="discordbot-$TIMESTAMP.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up mongodb database 'discordbot'..."
docker compose exec -T mongodb mongodump --db=discordbot --archive --gzip > "$BACKUP_DIR/$ARCHIVE_NAME"

echo "Wrote $BACKUP_DIR/$ARCHIVE_NAME ($(du -h "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1))"

echo "Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'discordbot-*.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "Done!"
