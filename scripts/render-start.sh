#!/bin/sh
set -e

echo "=== Starting Triarhythm Backend on Render ==="

# Run database migrations against TiDB Cloud and seed default data
echo "Running database migrations..."
php artisan migrate --force
php artisan db:seed --force || true
if [ ! -L public/storage ]; then
    php artisan storage:link
fi

# Cache configs and routes
php artisan config:cache || true
php artisan route:cache || true

# Start Laravel built-in server on Render's assigned port
PORT=${PORT:-10000}
echo "Triarhythm API listening on 0.0.0.0:$PORT"
exec php artisan serve --host 0.0.0.0 --port "$PORT"
