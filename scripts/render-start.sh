#!/bin/sh
set -e

echo "=== Starting Triarhythm Backend on Render ==="

# Run database migrations against TiDB Cloud
echo "Running database migrations..."
php artisan migrate --force || true

# Cache configs and routes
php artisan config:cache || true
php artisan route:cache || true

# Start Laravel built-in server on Render's assigned port
PORT=${PORT:-10000}
echo "Triarhythm API listening on 0.0.0.0:$PORT"
exec php artisan serve --host 0.0.0.0 --port "$PORT"
