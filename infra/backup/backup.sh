#!/bin/sh
# Daily Postgres backup: custom-format dump, pruned after RETENTION_DAYS, optional copy to R2.
set -eu

RETENTION_DAYS="${RETENTION_DAYS:-14}"
if [ -n "${RCLONE_REMOTE:-}" ]; then
  apk add --no-cache rclone >/dev/null
fi

while true; do
  stamp="$(date -u +%Y%m%d-%H%M)"
  file="/backups/quad-${stamp}.dump"
  if pg_dump --format=custom --file="$file"; then
    echo "backup ok: $file ($(du -h "$file" | cut -f1))"
  else
    echo "backup FAILED at $stamp" >&2
    rm -f "$file"
  fi
  find /backups -name 'quad-*.dump' -mtime "+$((RETENTION_DAYS - 1))" -delete

  if [ -n "${RCLONE_REMOTE:-}" ]; then
    rclone copy /backups "$RCLONE_REMOTE" \
      && rclone delete --min-age "${RETENTION_DAYS}d" "$RCLONE_REMOTE" \
      || echo "offsite copy FAILED" >&2
  fi
  sleep 86400
done
