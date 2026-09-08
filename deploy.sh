#!/bin/bash
# Deployment script for atlasx.online
# ATLASX3 application with ERC-1155 support

set -e  # Exit on error

echo "🚀 Deploying ATLASX3 to atlasx.online"
echo "============================================================"

# Configuration
APP_DIR="/var/www/atlasx3"
APP_NAME="atlasx3"
NGINX_SITE="atlasx3"
DOMAIN="atlasx.online"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as sudo
if [[ $EUID -eq 0 ]]; then
   print_error "This script should NOT be run as root/sudo"
   exit 1
fi

echo ""
echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not installed. Please install Node.js 18+"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not installed"
    exit 1
fi

# Check PM2
if command -v pm2 &> /dev/null; then
    print_success "PM2 installed"
else
    print_warning "PM2 not installed. Installing..."
    sudo npm install -g pm2
fi

# Check Nginx
if command -v nginx &> /dev/null; then
    print_success "Nginx installed"
else
    print_error "Nginx not installed. Please install nginx"
    exit 1
fi

echo ""
echo "Step 2: Creating directories..."
echo "--------------------------------"

# Create directories
sudo mkdir -p $APP_DIR
sudo mkdir -p $APP_DIR/logs
sudo mkdir -p $APP_DIR/data
sudo mkdir -p $APP_DIR/data/backups
sudo chown -R $USER:$USER $APP_DIR
print_success "Directories created"

echo ""
echo "Step 3: Copying application files..."
echo "--------------------------------------"

# Copy files (modify source path as needed)
SOURCE_DIR="D:/crypto/atlasx3"
if [ -d "$SOURCE_DIR" ]; then
    # Using rsync for better copying
    rsync -av --exclude 'node_modules' --exclude '.git' \
          --exclude 'logs/*' --exclude 'data/*.db' \
          "$SOURCE_DIR/" "$APP_DIR/"
    print_success "Application files copied"
else
    print_warning "Source directory not found. Please copy files manually to $APP_DIR"
fi

echo ""
echo "Step 4: Installing dependencies..."
echo "-----------------------------------"

cd $APP_DIR
npm install --production
print_success "Dependencies installed"

echo ""
echo "Step 5: Configuring environment..."
echo "-----------------------------------"

# Check .env file
if [ -f "$APP_DIR/.env" ]; then
    print_success ".env file exists"
    
    # Update production settings
    sed -i 's/NODE_ENV=development/NODE_ENV=production/' $APP_DIR/.env
    print_success "Updated NODE_ENV to production"
else
    print_error ".env file not found. Please create it from .env.example"
    exit 1
fi

echo ""
echo "Step 6: Setting up SSL certificate..."
echo "---------------------------------------"

# Check if certificate exists
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    print_success "SSL certificate already exists"
else
    print_warning "SSL certificate not found"
    echo "Run: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

echo ""
echo "Step 7: Configuring Nginx..."
echo "------------------------------"

# Copy nginx configuration
if [ -f "$APP_DIR/nginx.conf" ]; then
    sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/$NGINX_SITE
    sudo ln -sf /etc/nginx/sites-available/$NGINX_SITE /etc/nginx/sites-enabled/$NGINX_SITE
    
    # Remove default site
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    if sudo nginx -t; then
        print_success "Nginx configuration valid"
        sudo systemctl reload nginx
        print_success "Nginx reloaded"
    else
        print_error "Nginx configuration invalid"
        exit 1
    fi
else
    print_error "nginx.conf not found"
    exit 1
fi

echo ""
echo "Step 8: Starting application with PM2..."
echo "------------------------------------------"

cd $APP_DIR

# Stop existing process
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# Start application
if [ -f "ecosystem.config.js" ]; then
    pm2 start ecosystem.config.js --env production
else
    pm2 start src/server.js --name $APP_NAME -i 2
fi

# Save PM2 configuration
pm2 save

# Setup PM2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

print_success "Application started with PM2"

echo ""
echo "Step 9: Configuring firewall..."
echo "--------------------------------"

# Configure UFW
if command -v ufw &> /dev/null; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw allow 22/tcp
    sudo ufw --force enable
    print_success "Firewall configured"
else
    print_warning "UFW not installed. Please configure firewall manually"
fi

echo ""
echo "Step 10: Final checks..."
echo "-------------------------"

# Check PM2 status
pm2 status

# Check Nginx status
sudo systemctl status nginx --no-pager

# Check application
sleep 3
if curl -f http://localhost:4000/api/health &>/dev/null; then
    print_success "Application is responding"
else
    print_warning "Application not responding on localhost:4000"
fi

echo ""
echo "============================================================"
echo "🎉 Deployment Complete!"
echo "============================================================"
echo ""
echo "Your application is now running at:"
echo "  • https://$DOMAIN"
echo "  • https://www.$DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Verify DNS points to your server IP"
echo "  2. Get SSL certificate: sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
echo "  3. Test application: https://$DOMAIN"
echo "  4. Monitor logs: pm2 logs $APP_NAME"
echo ""
echo "Useful commands:"
echo "  • View logs: pm2 logs $APP_NAME"
echo "  • Restart: pm2 restart $APP_NAME"
echo "  • Stop: pm2 stop $APP_NAME"
echo "  • Status: pm2 status"
echo "  • Nginx logs: sudo tail -f /var/log/nginx/atlasx3-error.log"
echo ""
print_success "Deployment successful! 🚀"
