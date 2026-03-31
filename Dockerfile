FROM php:8.2-apache

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Install PDO MySQL extension
RUN docker-php-ext-install pdo pdo_mysql

# Copy all project files into the Apache web root
COPY . /var/www/html/

# Set correct permissions
RUN chown -R www-data:www-data /var/www/html/

# Apache config — allow .htaccess and rewrites
RUN echo '<Directory /var/www/html>\n\
    Options Indexes FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>' > /etc/apache2/conf-available/educore.conf \
    && a2enconf educore

EXPOSE 80