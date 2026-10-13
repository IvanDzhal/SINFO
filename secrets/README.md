# Secrets

Сюди кладуться секретні файли для локального запуску. **Вміст теки не потрапляє в git**
(див. `.gitignore`), у репозиторії лише цей README.

## Google service account (Data Sync)

1. Збережіть ключ service account як `google-service-account.json` у цій теці.
2. У Google Sheets надайте email із цього ключа (`client_email`) доступ **«Переглядач»**
   до таблиць магазинів.
3. Перезапустіть backend: `docker compose up -d backend`.

Шлях до файлу в контейнері: `/run/secrets/google-service-account.json`
(змінна `GOOGLE_CREDENTIALS_PATH` у `docker-compose.yml`).
Права ключа лише на читання таблиць (`spreadsheets.readonly`).

Для продакшену замість файлу можна передати JSON змінною середовища `GOOGLE_SERVICE_ACCOUNT_JSON`.
