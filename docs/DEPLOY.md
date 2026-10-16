# Деплой SluhaVka Info на Hetzner

Стара версія sinfo та боти лишаються як є (все лежить у `/opt`). Новий проект живе окремо в `/opt/sluhavkainfo` з власним compose-проектом `sluhavkainfo` (свої контейнери, мережа і volume, конфліктів зі старими немає). Стара версія на 80/443. Нова працює паралельно на портах **8081/8443** (за IP сервера), домен не чіпаємо.

## Архітектура
`caddy` (єдиний відкритий порт) → `/api/*` → `backend` (NestJS), решта → `frontend` (nginx зі статикою).
`db`, `redis`, `seaweedfs` назовні не публікуються.

## 1. Перший запуск
1. Через FileZilla залийте проект у `/opt/sluhavkainfo`. **Не заливайте**: `node_modules/` (у корені, `backend/`, `sinfo/`), `dist/`, `.git/`, локальний `.env`. Папка `secrets/` потрібна лише з `google-service-account.json`.
2. На сервері:
```bash
cd /opt/sluhavkainfo
cp .env.production.example .env.production   # заповнити; паролі БД і S3 — `openssl rand -hex 32` (без спецсимволів, інакше зламається DATABASE_URL), JWT-секрети — `openssl rand -base64 48`
chmod 600 .env.production
chmod +x deploy/*.sh
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production --profile tools run --rm tools npx prisma db seed
```
Міграції застосовуються автоматично при старті backend.
У `.env.production` вкажіть `CORS_ORIGINS=http://<IP>:8081`. Відкрийте порт 8081 у Hetzner Firewall / ufw.
Перевірка: `http://<IP>:8081` і `http://<IP>:8081/api`.

Додаткові сіди (`seed-sales.ts`, `seed-demo.ts`) запускайте так само через `tools` лише за потреби; demo-дані на проді не потрібні.

## 2. Оновлення
Залийте змінені файли через FileZilla, далі:
```bash
cd /opt/sluhavkainfo && ./deploy/deploy.sh
```

## 3. Бекапи (БД + файли сайту + система → Google Drive)
`deploy/backup.sh` щодня робить три архіви: `db_*.sql.gz` (Postgres), `files_*.tar.gz` (завантажені файли з SeaweedFS + проект: `.env.production`, `secrets`, compose) і `system_*.tar.gz` (`/etc`, crontab-и, список пакетів, стан docker; чужі проєкти додаються через `EXTRA_PATHS`). Далі вивантажує у Google Drive через rclone і надсилає звіт у Telegram. Локально лежить у `/var/backups/sluhavkainfo`, у Drive зберігається `BACKUP_KEEP_DAYS` (14) днів.
Повний образ сервера (разом зі старим sinfo і ботами) все одно варто періодично робити Hetzner Snapshot-ом.

### Налаштування rclone + Google Drive
```bash
curl https://rclone.org/install.sh | sudo bash
rclone config        # n → name: gdrive → storage: drive → scope: 1 (Full) або 3 (drive.file)
```
Сервер без браузера: на питання `Use web browser to automatically authenticate?` відповідайте **n**. rclone покаже команду `rclone authorize "drive" "..."` — виконайте її на своєму ПК (де є rclone і браузер), увійдіть в Google і вставте отриманий токен на сервер.
Бажано створити власний OAuth client_id у Google Cloud Console (інакше спільна квота rclone повільна): Drive API → OAuth consent screen → Credentials → OAuth client ID (Desktop).
Перевірка: `rclone mkdir gdrive:sluhavkainfo-backups && rclone lsd gdrive:`

### Запуск
У `.env.production`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `RCLONE_REMOTE=gdrive:sluhavkainfo-backups`. Скрипт має запускатися від root (cron root-а: `sudo crontab -e`), щоб rclone знайшов `/root/.config/rclone/rclone.conf`:
```
30 3 * * * /opt/sluhavkainfo/deploy/backup.sh >> /var/log/sluhavkainfo-backup.log 2>&1
```
Перший запуск вручну: `chmod +x deploy/backup.sh && sudo ./deploy/backup.sh`.

### Відновлення
- БД: `gunzip -c db_*.sql.gz | docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db psql -U sinfo -d sinfo_db`
- Файли: `docker run --rm -v sluhavkainfo_sinfo_storage_data:/data -v $PWD:/b alpine tar xzf /b/files_*.tar.gz -C / data` (папка `project/` в архіві — копія проекту для довідки/відновлення конфігів).

## 4. Перенесення домену (коли все наповнено)
1. Зробіть свіжий бекап. Зменшіть TTL DNS-запису заздалегідь.
2. Зупиніть/приберіть стару версію з 80/443 (`docker compose down` у папці старого sinfo, або зміна її портів; боти не чіпайте).
3. У `.env.production`: `SITE_ADDRESS=ваш.домен`, `HTTP_PORT=80`, `HTTPS_PORT=443`, `CORS_ORIGINS=https://ваш.домен`.
4. `./deploy/deploy.sh` — Caddy сам отримає сертифікат Let's Encrypt (DNS A-запис має вказувати на сервер).
5. Відкрийте 80/443 у firewall, закрийте 8081/8443.

Альтернатива без зупинки: якщо стара версія стоїть за nginx на хості, додайте для домену `proxy_pass http://127.0.0.1:8081` і лишіть `HTTP_PORT=127.0.0.1:8081`.

## Безпека
- Бекенд падає на старті зі слабкими/відсутніми секретами (`assertSecrets`).
- Не публікуйте Adminer на проді; для доступу до БД — SSH-тунель: `ssh -L 5433:localhost:5432` (потрібно тимчасово додати `ports: ["127.0.0.1:5433:5432"]` до `db`).
- Пароль `admin` (логін `admin`, Admin Adminov) задається в `SEED_ADMIN_PASSWORD` у `.env.production` на сервері — у git його не пишіть, репозиторій публічний. Змінити пароль: поправити змінну і повторно запустити seed (команда з розділу 1).
