# Deployment Guide - VPS with Cloudflare

This guide covers deploying Checkers Studio to a VPS (Virtual Private Server) with Cloudflare as a CDN/proxy.

## Prerequisites

- VPS with Ubuntu 20.04+ or similar Linux distribution
- Domain name configured with Cloudflare DNS
- SSH access to your VPS
- Node.js 18+ installed on VPS

## Initial VPS Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Node.js (if not installed)

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 3. Install PM2 (Process Manager)

```bash
sudo npm install -g pm2

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions it prints
```

## Application Deployment

### 1. Clone Repository

```bash
cd /var/www  # or your preferred directory
sudo mkdir -p checkers
sudo chown $USER:$USER checkers
cd checkers

# If using Git
git clone <your-repo-url> .

# Or upload files via SCP/SFTP
```

### 2. Install Dependencies & Build

```bash
npm install
npm run build
```

### 3. Create Environment File

Create `.env` in the project root:

```bash
nano .env
```

Add the following (replace with your values):

```env
# Server Configuration
PORT=8000
NODE_ENV=production

# Security - REQUIRED for production
SESSION_SECRET=<generate-long-random-string-here>
ADMIN_TOKEN=<generate-admin-token-here>

# Your production domain
SITE_URL=https://yourdomain.com
```

**Generate secrets:**

```bash
# Generate SESSION_SECRET (64 characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN (32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4. Create Data Directory

```bash
mkdir -p data
chmod 755 data
```

### 5. Start with PM2

```bash
# Start the application
pm2 start server.js --name checkers-studio

# Save PM2 configuration
pm2 save

# View logs
pm2 logs checkers-studio

# Check status
pm2 status
```

## Cloudflare Configuration

### 1. DNS Setup

In Cloudflare dashboard:

1. Go to **DNS** tab
2. Add an **A record**:
   - **Name**: `@` (or subdomain like `checkers`)
   - **IPv4 address**: Your VPS IP address
   - **Proxy status**: Proxied (orange cloud)
   - **TTL**: Auto

### 2. SSL/TLS Settings

1. Go to **SSL/TLS** tab
2. Set encryption mode to **Full** or **Full (strict)**
   - **Full**: Cloudflare to your server uses any certificate (even self-signed)
   - **Full (strict)**: Requires valid certificate on your server

### 3. Security Settings

**Recommended Cloudflare settings:**

1. **SSL/TLS > Edge Certificates**:
   - ✅ Always Use HTTPS: ON
   - ✅ Automatic HTTPS Rewrites: ON
   - Minimum TLS Version: 1.2

2. **Security > Settings**:
   - Security Level: Medium or High
   - Challenge Passage: 30 minutes
   - Browser Integrity Check: ON

3. **Speed > Optimization**:
   - Auto Minify: Enable CSS, JS, HTML
   - Brotli: ON

4. **Caching > Configuration**:
   - Caching Level: Standard
   - Browser Cache TTL: 4 hours

### 4. Page Rules (Optional)

Add page rules for better caching:

1. `yourdomain.com/dist/*`:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

2. `yourdomain.com/*.css`, `yourdomain.com/*.js`:
   - Cache Level: Cache Everything
   - Edge Cache TTL: 1 month

## Nginx Reverse Proxy (Recommended)

For better performance and security, use Nginx as a reverse proxy:

### 1. Install Nginx

```bash
sudo apt install -y nginx
```

### 2. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/checkers-studio
```

Add configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect to HTTPS is handled by Cloudflare
    # But we can also handle it here
    # return 301 https://$server_name$request_uri;

    # Or serve directly if using Cloudflare Flexible SSL
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers (additional to app's headers)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/checkers-access.log;
    error_log /var/log/nginx/checkers-error.log;
}
```

### 3. Enable Site

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/checkers-studio /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

### 4. Update Application Port (Optional)

If using Nginx, you can keep the app on port 8000 (not exposed) or change in `.env`:

```env
PORT=3000  # Internal port, not exposed to internet
```

Then restart PM2:

```bash
pm2 restart checkers-studio
```

## Firewall Configuration

### Using UFW (Ubuntu)

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If using Cloudflare only, restrict HTTP/HTTPS to Cloudflare IPs
# See: https://www.cloudflare.com/ips/

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Monitoring & Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs checkers-studio

# Nginx logs
sudo tail -f /var/log/nginx/checkers-access.log
sudo tail -f /var/log/nginx/checkers-error.log

# Telemetry data
ls -lh /var/www/checkers/data/
```

### Update Application

```bash
cd /var/www/checkers

# Pull latest code
git pull

# Install dependencies (if changed)
npm install

# Rebuild
npm run build

# Restart PM2
pm2 restart checkers-studio

# Or reload (zero-downtime)
pm2 reload checkers-studio
```

### Backup Data

```bash
# Backup leaderboard and telemetry
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# Or setup automatic backups
crontab -e
# Add:
# 0 2 * * * tar -czf /home/backups/checkers-$(date +\%Y\%m\%d).tar.gz /var/www/checkers/data/
```

## Performance Optimization

### 1. Enable Gzip in Nginx

In `/etc/nginx/nginx.conf`:

```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
gzip_min_length 1000;
```

### 2. PM2 Cluster Mode (Optional)

For better CPU utilization:

```bash
# Delete old process
pm2 delete checkers-studio

# Start in cluster mode (4 instances)
pm2 start server.js -i 4 --name checkers-studio

# Or use max CPUs
pm2 start server.js -i max --name checkers-studio

pm2 save
```

**Note**: Ensure session affinity in load balancing if using multiple instances.

### 3. Enable Cloudflare Caching

In your Cloudflare dashboard:
- Enable Argo Smart Routing (paid feature, improves speed)
- Configure Cache Everything page rules for static assets

## Security Checklist

- ✅ `SESSION_SECRET` set to strong random value
- ✅ `ADMIN_TOKEN` set for admin dashboard
- ✅ Cloudflare proxy enabled (orange cloud)
- ✅ Cloudflare SSL/TLS set to Full or Full (strict)
- ✅ Firewall configured (UFW)
- ✅ Node.js and system packages updated
- ✅ PM2 running as non-root user
- ✅ Security headers enabled in app
- ✅ Rate limiting active in app
- ✅ HTTPS redirect enabled (Cloudflare or Nginx)

## Accessing Admin Dashboard

With `ADMIN_TOKEN` set, access admin using header:

```bash
# Using curl
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" https://yourdomain.com/admin

# Or in browser
# Install a browser extension like "ModHeader" to add the header
```

Or use Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://yourdomain.com/admin
```

## Troubleshooting

### App not starting

```bash
# Check PM2 logs
pm2 logs checkers-studio --lines 100

# Check if port is in use
sudo lsof -i :8000

# Restart
pm2 restart checkers-studio
```

### Nginx errors

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/checkers-error.log

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Cloudflare issues

- Check DNS propagation: `dig yourdomain.com`
- Ensure origin IP is correct in Cloudflare DNS
- Verify SSL/TLS mode matches your server setup
- Check Cloudflare status page for outages

### Rate limiting too aggressive

If legitimate users are being rate limited, adjust in `server.js`:

```javascript
const RATE_LIMITS = {
  "/api/session/start": { max: 50, windowMs: 60000 },  // Increased from 30
  // ...
};
```

Then `pm2 restart checkers-studio`.

## Support

For issues with:
- **Application bugs**: Check SECURITY_AUDIT.md and logs
- **Deployment**: Review this guide and Nginx/PM2 documentation
- **Cloudflare**: Consult Cloudflare docs and support

---

**Production Checklist Summary:**

1. ✅ Environment variables configured
2. ✅ Application built (`npm run build`)
3. ✅ PM2 running application
4. ✅ Nginx reverse proxy configured (recommended)
5. ✅ Cloudflare DNS pointing to VPS
6. ✅ Cloudflare SSL/TLS configured
7. ✅ Firewall configured
8. ✅ Backups automated
9. ✅ Monitoring in place (PM2, logs)
10. ✅ Security audit reviewed
