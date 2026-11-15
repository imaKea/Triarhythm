FROM php:8.2-cli-alpine

# Install system packages & PHP extensions needed for Laravel & TiDB MySQL
RUN apk add --no-cache \
    ca-certificates \
    libzip-dev \
    oniguruma-dev \
    git \
    unzip \
    && update-ca-certificates \
    && docker-php-ext-install pdo pdo_mysql zip mbstring bcmath

RUN printf '%s\n' \
    'upload_max_filesize=100M' \
    'post_max_size=110M' \
    'max_execution_time=300' \
    'max_input_time=300' \
    > /usr/local/etc/php/conf.d/uploads.ini

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy project files
COPY . .

# Install PHP dependencies without dev packages
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Set up write permissions for Laravel cache and storage
RUN chmod -R 777 storage bootstrap/cache

# Render default port
EXPOSE 10000

# Entrypoint script
RUN chmod +x scripts/render-start.sh

CMD ["sh", "scripts/render-start.sh"]
