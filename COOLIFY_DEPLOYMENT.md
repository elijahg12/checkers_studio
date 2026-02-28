# Coolify Deployment Guide

This guide covers deploying Checkers Studio to Coolify, a self-hosted PaaS platform.

## Prerequisites

- Coolify instance running and accessible
- GitHub repository with your code (already done: `elijahg12/checkers_studio`)
- Domain configured in Cloudflare (optional but recommended)

## Step 1: Create New Project in Coolify

1. **Login to Coolify** panel
2. Click **"+ New"** or **"Add Resource"**
3. Select **"Application"**
4. Choose **"Public Repository"** (or Private if your repo is private)

## Step 2: Configure Application

### Basic Settings

1. **Repository URL**:
   ```
   https://github.com/elijahg12/checkers_studio
   ```
   Or use the Git URL:
   ```
   git@github.com:elijahg12/checkers_studio.git
   ```

2. **Branch**: `main`

3. **Build Pack**: Select **"Node.js"** or **"Nixpacks"** (auto-detect)

4. **Project Name**: `checkers-studio` (or your preferred name)

### Port Configuration

**IMPORTANT**: Set the port configuration

1. **Port**: `8000`
2. **Exposed Port**: `8000` or let Coolify auto-assign

Or in **Port Mappings**:
- Container Port: `8000`
- Public Port: `80` or `443` (handled by Coolify's proxy)

## Step 3: Environment Variables

Add these environment variables in Coolify's **Environment Variables** section:

### Required Variables

```bash
# Server Port (Coolify will inject this, but you can override)
PORT=8000

# Node Environment
NODE_ENV=production

# Session Secret (REQUIRED - generate random string)
SESSION_SECRET=your-generated-secret-here

# Admin Token (REQUIRED for admin access)
ADMIN_TOKEN=your-admin-token-here

# Your Domain (set after domain is configured)
SITE_URL=https://yourdomain.com
```

### Generate Secrets

You can generate secrets locally and paste them:

```bash
# Generate SESSION_SECRET (64 char hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate ADMIN_TOKEN (32 char hex)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Example**:
```
SESSION_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
ADMIN_TOKEN=9876543210fedcba9876543210fedcba
SITE_URL=https://checkers.yourdomain.com
```

## Step 4: Build Configuration

### Build Command (if needed)

Coolify should auto-detect from `package.json`, but you can specify:

**Build Command**:
```bash
npm install && npm run build
```

**Start Command** (if auto-detect fails):
```bash
npm start
```

Or directly:
```bash
node server.js
```

### Dockerfile (Alternative - Not Required)

If you prefer Docker, create `Dockerfile` in your repo:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Create data directory
RUN mkdir -p data && chmod 755 data

# Expose port
EXPOSE 8000

# Start server
CMD ["node", "server.js"]
```

Then in Coolify, select **"Dockerfile"** as build pack.

## Step 5: Domain Configuration

### Option A: Coolify Subdomain (Easiest)

Coolify provides a subdomain automatically:
- Your app will be available at: `https://your-app.coolify-instance.com`
- No additional DNS configuration needed

### Option B: Custom Domain with Cloudflare

1. **In Coolify**:
   - Go to **Domains** section
   - Add your custom domain: `checkers.yourdomain.com`
   - Enable **"Generate SSL Certificate"** (Coolify uses Let's Encrypt)

2. **In Cloudflare DNS**:
   - Add **A Record** or **CNAME**:
     - **Name**: `checkers` (or `@` for root domain)
     - **Target**: Your Coolify server IP
     - **Proxy status**: Can be **Proxied** (orange) or **DNS only** (gray)

   **Recommended**: Use **DNS only** (gray cloud) to let Coolify handle SSL directly

3. **In Cloudflare SSL/TLS**:
   - Set encryption mode to **Full** or **Full (strict)**

4. **Update Environment Variable**:
   ```
   SITE_URL=https://checkers.yourdomain.com
   ```

## Step 6: Persistent Storage (Data Directory)

**IMPORTANT**: Configure persistent storage for leaderboard and telemetry data.

1. In Coolify, go to **"Persistent Storage"** or **"Volumes"**
2. Add a volume:
   - **Source Path** (on host): `/var/coolify/data/checkers-studio`
   - **Destination Path** (in container): `/app/data`
   - **Mount Type**: Bind or Volume

This ensures your `data/leaderboard.json` and `data/telemetry.ndjson` persist across deployments.

## Step 7: Deploy

1. Click **"Deploy"** or **"Save & Deploy"**
2. Coolify will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build TypeScript (`npm run build`)
   - Start the server (`node server.js`)

3. **Monitor Deployment**:
   - Watch the build logs in real-time
   - Check for any errors

## Step 8: Verify Deployment

### Check Application

1. Visit your domain: `https://checkers.yourdomain.com`
2. Verify the game loads correctly
3. Test game functionality

### Check Admin Dashboard

Access admin dashboard with your token:

**Using Browser Extension** (e.g., ModHeader):
- Add header: `x-admin-token: YOUR_ADMIN_TOKEN`
- Visit: `https://checkers.yourdomain.com/admin`

**Using curl**:
```bash
curl -H "x-admin-token: YOUR_ADMIN_TOKEN" https://checkers.yourdomain.com/admin
```

Or with Bearer token:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://checkers.yourdomain.com/admin
```

## Step 9: Enable Auto-Deploy (Optional)

### Webhook Auto-Deploy

1. In Coolify, go to **"Webhooks"** or **"Git"** settings
2. Enable **"Auto Deploy on Push"**
3. Copy the webhook URL
4. In GitHub repository settings:
   - Go to **Settings → Webhooks → Add webhook**
   - Paste Coolify webhook URL
   - Content type: `application/json`
   - Events: **"Just the push event"**
   - Save

Now every `git push` will automatically deploy to Coolify!

## Troubleshooting

### Build Fails

**Check logs** in Coolify deployment logs:

Common issues:
- Missing `package-lock.json` → Run `npm install` locally and commit
- TypeScript errors → Run `npm run build` locally first
- Wrong Node version → Specify in `package.json`:
  ```json
  "engines": {
    "node": ">=18.0.0"
  }
  ```

### Application Won't Start

Check Coolify runtime logs:

- **Port mismatch**: Ensure `PORT=8000` in env vars
- **Missing dependencies**: Verify `npm install` completed
- **File permissions**: Check data directory exists and is writable

### Cannot Access Application

1. **Check Coolify proxy**:
   - Verify application is running in Coolify dashboard
   - Check port mapping is correct

2. **DNS not propagated**:
   ```bash
   dig checkers.yourdomain.com
   ```
   Wait for DNS propagation (up to 24 hours, usually minutes)

3. **SSL certificate issues**:
   - Check Coolify SSL certificate generation logs
   - Verify domain is accessible via HTTP first
   - Try regenerating certificate in Coolify

### Data Not Persisting

1. Verify persistent storage is mounted
2. Check volume path: `/app/data`
3. Restart application to test persistence

## Cloudflare Configuration (If Using Proxied)

If using Cloudflare proxy (orange cloud):

### 1. SSL/TLS Settings
- **Encryption Mode**: Full (strict)
- **Always Use HTTPS**: ON
- **Automatic HTTPS Rewrites**: ON

### 2. Caching Rules
Create page rules for static assets:

**Rule 1**: `yourdomain.com/dist/*`
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month

**Rule 2**: `yourdomain.com/*.css`, `yourdomain.com/*.js`, `yourdomain.com/favicon.svg`
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month

### 3. Firewall (Optional)
- Security Level: Medium
- Rate limiting: Already handled by application

## Updating Your Application

### Manual Update

1. Push changes to GitHub
2. In Coolify, click **"Redeploy"** or **"Deploy Latest"**
3. Coolify will pull latest code and rebuild

### Automatic Updates

With webhook configured (Step 9):
```bash
git add .
git commit -m "Your changes"
git push
```

Coolify will automatically:
- Pull changes
- Rebuild application
- Zero-downtime deployment

## Monitoring

### View Logs

In Coolify dashboard:
- **Build Logs**: See compilation and build process
- **Runtime Logs**: See application logs (like `console.log`)
- **Server Logs**: See system-level logs

### Check Metrics

Coolify provides:
- CPU usage
- Memory usage
- Network traffic
- Uptime

### Application Monitoring

Check telemetry:
- Visit `/admin` with admin token
- View game statistics and usage

## Backup Strategy

### Automated Backups

Coolify can backup volumes automatically:
1. Go to **Backups** section
2. Configure backup schedule
3. Choose destination (S3, local, etc.)

### Manual Backup

SSH into Coolify server:
```bash
# Find container data
docker exec <container-id> tar -czf - /app/data > backup-$(date +%Y%m%d).tar.gz
```

Or access the persistent volume directly on the host.

## Cost Optimization

### Resource Limits

Set appropriate limits in Coolify:
- **Memory**: 512MB - 1GB (sufficient for this app)
- **CPU**: 0.5 - 1 CPU core
- **Replicas**: 1 (can scale later)

### Enable Caching

Use Cloudflare caching to reduce server load on static assets.

## Security Checklist

Before going live:

- ✅ `SESSION_SECRET` set to strong random value
- ✅ `ADMIN_TOKEN` set and secure
- ✅ `SITE_URL` configured correctly
- ✅ SSL/HTTPS enabled (via Coolify or Cloudflare)
- ✅ Persistent storage configured for data
- ✅ Backups enabled
- ✅ Firewall rules configured (if needed)
- ✅ Rate limiting active (built into app)
- ✅ Admin dashboard accessible only with token

## Quick Deployment Checklist

1. ✅ Create new application in Coolify
2. ✅ Set repository URL: `https://github.com/elijahg12/checkers_studio`
3. ✅ Configure environment variables (SESSION_SECRET, ADMIN_TOKEN, SITE_URL)
4. ✅ Set port to 8000
5. ✅ Configure persistent storage: `/app/data`
6. ✅ Add custom domain (optional)
7. ✅ Deploy and monitor logs
8. ✅ Verify application works
9. ✅ Enable auto-deploy webhook
10. ✅ Configure Cloudflare (if using)

---

**You're ready to deploy! 🚀**

If you encounter any issues, check the Coolify logs first and refer to the Troubleshooting section above.
