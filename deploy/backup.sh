#!/usr/bin/env bash
# Повний бекап: БД + файли сайту + система → локально, далі у Google Drive (rclone) + сповіщення в Telegram.
# Cron (щодня о 3:30): 30 3 * * * /opt/sluhavkainfo/deploy/backup.sh
#
# Що входить:
#   db_*.sql.gz      — дамп Postgres
#   files_*.tar.gz   — завантажені файли (volume SeaweedFS) + проект (.env.production, secrets, compose; без node_modules/dist)
#   system_*.tar.gz  — /etc, crontab-и, список пакетів, стан docker (+ шляхи з EXTRA_PATHS)
set -uo pipefail
cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

get_env() { grep -E "^$1=" .env.production | head -n1 | cut -d= -f2- | tr -d "\r\"'" | xargs; }
TG_TOKEN=$(get_env TELEGRAM_BOT_TOKEN)
TG_CHAT=$(get_env TELEGRAM_CHAT_ID)
RCLONE_REMOTE=$(get_env RCLONE_REMOTE)        # напр. gdrive:sluhavkainfo-backups (порожньо = без вивантаження)
KEEP_DAYS=$(get_env BACKUP_KEEP_DAYS); KEEP_DAYS=${KEEP_DAYS:-14}
EXTRA_PATHS=$(get_env EXTRA_PATHS)            # додаткові шляхи в системний бекап через пробіл, напр. "/opt/bots"

notify() {
  if [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT" ]; then
    echo "Telegram: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID не задано, пропускаю" >&2; return 0
  fi
  local resp
  resp=$(curl -sS -m 20 "https://api.telegram.org/bot${TG_TOKEN}/sendMessage"     --data-urlencode "chat_id=${TG_CHAT}" --data-urlencode "text=$1" 2>&1)
  case "$resp" in
    *'"ok":true'*) ;;
    *) echo "Telegram: не вдалося надіслати повідомлення. Відповідь: $resp" >&2 ;;
  esac
}

DIR=${BACKUP_DIR:-/var/backups/sluhavkainfo}
STAMP=$(date +%F_%H%M)
mkdir -p "$DIR"
DC="docker compose -f docker-compose.prod.yml --env-file .env.production"
REPORT=""; FAIL=0
ok()  { REPORT+=$'\n'"✅ $1: $2"; }
bad() { REPORT+=$'\n'"❌ $1: ${2:-помилка}"; FAIL=1; }
size() { du -h "$1" | cut -f1; }

# 1. База даних
F="$DIR/db_$STAMP.sql.gz"
if $DC exec -T db pg_dump -U sinfo -d sinfo_db | gzip > "$F" && [ "${PIPESTATUS[0]}" -eq 0 ] && [ -s "$F" ]; then
  ok "БД" "$(size "$F")"
else rm -f "$F"; bad "БД"; fi

# 2. Файли сайту: завантажені файли (volume) + проект
F="$DIR/files_$STAMP.tar.gz"
VOL=$($DC config --volumes 2>/dev/null | grep -m1 storage || true)
VOL_NAME="sluhavkainfo_${VOL:-sinfo_storage_data}"
if docker run --rm -v "$VOL_NAME":/data:ro -v "$PROJECT_DIR":/project:ro -v "$DIR":/out alpine \
     tar czf "/out/files_$STAMP.tar.gz" \
       --exclude='project/**/node_modules' --exclude='project/**/dist' --exclude='project/.git' \
       -C / data project && [ -s "$F" ]; then
  ok "Файли сайту" "$(size "$F")"
else rm -f "$F"; bad "Файли сайту"; fi

# 3. Система
F="$DIR/system_$STAMP.tar.gz"
TMP=$(mktemp -d)
{ dpkg --get-selections; } > "$TMP/packages.txt" 2>/dev/null
{ docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}'; docker volume ls; } > "$TMP/docker-state.txt" 2>/dev/null
crontab -l > "$TMP/root-crontab.txt" 2>/dev/null
# shellcheck disable=SC2086
if tar czf "$F" --ignore-failed-read -C / etc var/spool/cron $EXTRA_PATHS -C "$TMP" . 2>/dev/null; [ -s "$F" ]; then
  ok "Система" "$(size "$F")"
else rm -f "$F"; bad "Система"; fi
rm -rf "$TMP"

# 4. Google Drive
if [ -n "$RCLONE_REMOTE" ]; then
  if rclone copy "$DIR" "$RCLONE_REMOTE" --include "*_${STAMP}.*" --transfers 2 \
     && rclone delete "$RCLONE_REMOTE" --min-age "${KEEP_DAYS}d"; then
    ok "Google Drive" "завантажено"
  else bad "Google Drive" "не вдалося вивантажити"; fi
else
  REPORT+=$'\n'"⚠️ Google Drive: RCLONE_REMOTE не задано"
fi

find "$DIR" -type f \( -name 'db_*' -o -name 'files_*' -o -name 'system_*' \) -mtime +"$KEEP_DAYS" -delete

if [ "$FAIL" -eq 0 ]; then notify "✅ Слухавка Інфо: бекап $STAMP$REPORT"
else notify "❌ Слухавка Інфо: бекап $STAMP з помилками$REPORT"; exit 1; fi
