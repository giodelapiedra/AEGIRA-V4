# AEGIRA Backend - VPS Deployment Guide

> **Target**: Ubuntu 22.04 LTS (or newer)
> **Stack**: Node.js 20+ | PostgreSQL 15+ | PM2 | Nginx | Certbot
> **Last Updated**: 2026-02-05

---

## Table of Contents

1. [Server Requirements](#1-server-requirements)
2. [Initial Server Setup](#2-initial-server-setup)
3. [Install Dependencies](#3-install-dependencies)
4. [PostgreSQL Setup](#4-postgresql-setup)
5. [Clone & Build Application](#5-clone--build-application)
6. [Environment Configuration](#6-environment-configuration)
7. [Database Migration](#7-database-migration)
8. [PM2 Process Manager](#8-pm2-process-manager)
9. [Nginx Reverse Proxy](#9-nginx-reverse-proxy)
10. [SSL Certificate (Let's Encrypt)](#10-ssl-certificate-lets-encrypt)
11. [Firewall Configuration](#11-firewall-configuration)
12. [Monitoring & Logs](#12-monitoring--logs)
13. [Deployment Updates](#13-deployment-updates)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 20 GB SSD | 40 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04/24.04 LTS |

### Required Ports
| Port | Service |
|------|---------|
| 22 | SSH |
| 80 | HTTP (redirect to HTTPS) |
| 443 | HTTPS |
| 5432 | PostgreSQL (internal only) |

---

## 2. Initial Server Setup

### 2.1 Connect to VPS as root
```bash
ssh root@your-server-ip
```

### 2.2 Update system FIRST (as root)
```bash
apt update && apt upgrade -y
```

### 2.3 Create non-root user with sudo access
```bash
# Create user (will prompt for password)
adduser aegira

# Add to sudo group - IMPORTANT!
usermod -aG sudo aegira

# Verify user is in sudo group
groups aegira
# Should show: aegira : aegira sudo

# IMPORTANT: Logout and login as aegira to apply group changes
exit
```

### 2.4 Login as aegira user
```bash
ssh aegira@your-server-ip

# Verify sudo works
sudo whoami
# Should output: root
```

> **Troubleshooting**: If you get "aegira is not in the sudoers file":
> ```bash
> # Login as root again
> ssh root@your-server-ip
>
> # Re-add to sudo group
> usermod -aG sudo aegira
>
> # Or manually edit sudoers (safer method)
> visudo
> # Add this line at the bottom:
> # aegira ALL=(ALL:ALL) ALL
>
> # Then logout and login as aegira again
> ```

### 2.5 Set timezone to UTC (recommended)
```bash
# Set to UTC for consistent logs and cron jobs
sudo timedatectl set-timezone UTC

# Verify
timedatectl
# Should show: Time zone: UTC (UTC, +0000)

# Check current time
date
```

> **Note**: Application timezone is handled by Luxon per-company.
> VPS timezone only affects server logs and cron jobs.

---

## 3. Install Dependencies

### 3.1 Node.js 20 (via NodeSource)
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### 3.2 PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### 3.3 Nginx
```bash
sudo apt install -y nginx
```

### 3.4 Certbot (SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 3.5 Git
```bash
sudo apt install -y git
```

### 3.6 Build essentials (for bcrypt)
```bash
sudo apt install -y build-essential python3
```

---

## 4. PostgreSQL Setup

### Option A: Local PostgreSQL (on same VPS)

```bash
# Install PostgreSQL 15
sudo apt install -y postgresql postgresql-contrib

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql
```

```sql
-- In PostgreSQL shell:
CREATE USER aegira WITH PASSWORD 'your-secure-password';
CREATE DATABASE aegira_production OWNER aegira;
GRANT ALL PRIVILEGES ON DATABASE aegira_production TO aegira;
\q
```

**Connection string:**
```
DATABASE_URL=postgresql://aegira:your-secure-password@localhost:5432/aegira_production
```

### Option B: External PostgreSQL (Supabase, Neon, etc.)

Use the connection string from your provider:
```
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

> **Note**: For Supabase, you may need both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) for migrations.

---

## 5. Clone & Build Application

### 5.1 Create app directory
```bash
sudo mkdir -p /var/www/aegira
sudo chown aegira:aegira /var/www/aegira
cd /var/www/aegira
```

### 5.2 Clone repository
```bash
# Using HTTPS
git clone https://github.com/your-org/aegira-backend.git backend

# Or using SSH (if configured)
git clone git@github.com:your-org/aegira-backend.git backend

cd backend
```

### 5.3 Install dependencies
```bash
npm ci --production=false
```

### 5.4 Generate Prisma client
```bash
npx prisma generate
```

### 5.5 Build application
```bash
npm run build
```

---

## 6. Environment Configuration

### 6.1 Create .env file
```bash
nano /var/www/aegira/backend/.env
```

### 6.2 Production .env template
```env
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://aegira:your-secure-password@localhost:5432/aegira_production
# For Supabase, also add:
# DIRECT_URL=postgresql://user:password@host:5432/database

# JWT - CHANGE THIS! Generate with: openssl rand -base64 64
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-for-security
JWT_EXPIRES_IN=7d

# CORS - your frontend domain(s)
CORS_ORIGINS=https://aegira.health,https://www.aegira.health,https://sample.aegira.health,http://localhost:5173,http://localhost:3000

# Cloudflare R2 Storage (for avatar uploads)
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=aegira-profiles
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

### 6.3 Generate secure JWT secret
```bash
openssl rand -base64 64
```

### 6.4 Secure the .env file
```bash
chmod 600 /var/www/aegira/backend/.env
```

---

## 7. Database Migration

### 7.1 Run migrations
```bash
cd /var/www/aegira/backend
npx prisma migrate deploy
```

### 7.2 Seed initial data (optional)
```bash
npm run db:seed
```

### 7.3 Verify database
```bash
npx prisma studio
# Opens browser at localhost:5555 (use SSH tunnel for remote access)
```

---

## 8. PM2 Process Manager

### 8.1 Create ecosystem file
```bash
nano /var/www/aegira/backend/ecosystem.config.cjs
```

```javascript
module.exports = {
  apps: [
    {
      name: 'aegira-api',
      script: 'dist/index.js',
      cwd: '/var/www/aegira/backend',
      instances: 'max',  // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/aegira/error.log',
      out_file: '/var/log/aegira/out.log',
      merge_logs: true,
      // Restart policy
      max_restarts: 10,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,
      // Memory limit
      max_memory_restart: '500M',
    },
  ],
};
```

### 8.2 Create log directory
```bash
sudo mkdir -p /var/log/aegira
sudo chown aegira:aegira /var/log/aegira
```

### 8.3 Start application
```bash
cd /var/www/aegira/backend
pm2 start ecosystem.config.cjs
```

### 8.4 Save PM2 configuration
```bash
pm2 save
```

### 8.5 Setup PM2 startup script
```bash
pm2 startup systemd -u aegira --hp /home/aegira
# Run the command it outputs
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u aegira --hp /home/aegira
```

### 8.6 Verify process
```bash
pm2 status
pm2 logs aegira-api
```

---

## 9. Nginx Reverse Proxy

### 9.1 Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/aegira-api
```

```nginx
# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

server {
    listen 80;
    server_name api.aegira.yourdomain.com;

    # Redirect HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.aegira.yourdomain.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/api.aegira.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.aegira.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/json text/plain application/javascript;

    # Max upload size (for avatar uploads)
    client_max_body_size 10M;

    location / {
        # Rate limiting
        limit_req zone=api_limit burst=20 nodelay;

        # Proxy to Node.js
        proxy_pass http://127.0.0.1:3000;
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

    # Health check endpoint (no rate limit)
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 9.2 Enable site
```bash
sudo ln -s /etc/nginx/sites-available/aegira-api /etc/nginx/sites-enabled/
```

### 9.3 Test and reload Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 10. SSL Certificate (Let's Encrypt)

### 10.1 Obtain certificate
```bash
sudo certbot --nginx -d api.aegira.yourdomain.com
```

### 10.2 Auto-renewal test
```bash
sudo certbot renew --dry-run
```

### 10.3 Verify auto-renewal timer
```bash
sudo systemctl status certbot.timer
```

---

## 11. Firewall Configuration

### 11.1 Setup UFW
```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow OpenSSH

# Allow HTTP and HTTPS
sudo ufw allow 'Nginx Full'

# Check status
sudo ufw status
```

### 11.2 Expected output
```
Status: active

To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx Full                 ALLOW       Anywhere
OpenSSH (v6)               ALLOW       Anywhere (v6)
Nginx Full (v6)            ALLOW       Anywhere (v6)
```

---

## 12. Monitoring & Logs

### 12.1 PM2 Monitoring
```bash
# Real-time logs
pm2 logs aegira-api

# Monit (built-in monitoring)
pm2 monit

# Status
pm2 status
```

### 12.2 Log locations
| Log | Location |
|-----|----------|
| Application stdout | `/var/log/aegira/out.log` |
| Application errors | `/var/log/aegira/error.log` |
| Nginx access | `/var/log/nginx/access.log` |
| Nginx errors | `/var/log/nginx/error.log` |
| PostgreSQL | `/var/log/postgresql/` |

### 12.3 Log rotation
```bash
sudo nano /etc/logrotate.d/aegira
```

```
/var/log/aegira/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 aegira aegira
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 12.4 System resources
```bash
# Memory usage
free -h

# Disk usage
df -h

# CPU load
htop
```

---

## 13. Deployment Updates

### 13.1 Quick deploy script
```bash
nano /var/www/aegira/backend/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /var/www/aegira/backend

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm ci --production=false

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🏗️ Building application..."
npm run build

echo "🗄️ Running migrations..."
npx prisma migrate deploy

echo "♻️ Reloading PM2..."
pm2 reload aegira-api

echo "✅ Deployment complete!"
pm2 status
```

```bash
chmod +x /var/www/aegira/backend/deploy.sh
```

### 13.2 Run deployment
```bash
cd /var/www/aegira/backend
./deploy.sh
```

### 13.3 Rollback (if needed)
```bash
# Revert to previous commit
git checkout HEAD~1

# Rebuild and restart
npm run build
pm2 reload aegira-api
```

---

## 14. Troubleshooting

### 14.1 Application won't start
```bash
# Check PM2 logs
pm2 logs aegira-api --lines 100

# Check environment variables
cat /var/www/aegira/backend/.env

# Test manually
cd /var/www/aegira/backend
node dist/index.js
```

### 14.2 Database connection issues
```bash
# Test PostgreSQL connection
psql -U aegira -d aegira_production -h localhost

# Check PostgreSQL status
sudo systemctl status postgresql

# View PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### 14.3 Nginx issues
```bash
# Test config
sudo nginx -t

# Check error log
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### 14.4 SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check certificate expiry
openssl s_client -connect api.aegira.yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 14.5 Memory issues
```bash
# Check memory usage
free -h

# Check PM2 memory
pm2 monit

# Restart PM2 if memory is high
pm2 restart aegira-api
```

### 14.6 Common error codes
| Error | Cause | Solution |
|-------|-------|----------|
| `ECONNREFUSED` | Database not running | `sudo systemctl start postgresql` |
| `EACCES` | Permission denied | Check file ownership with `ls -la` |
| `EADDRINUSE` | Port already in use | `sudo lsof -i :3000` then kill process |
| `ENOMEM` | Out of memory | Add swap or upgrade VPS |

---

## Quick Reference

### Essential Commands
```bash
# Application
pm2 status                    # Check app status
pm2 logs aegira-api           # View logs
pm2 restart aegira-api        # Restart app
pm2 reload aegira-api         # Zero-downtime reload

# Database
npx prisma migrate deploy     # Run migrations
npx prisma studio             # Database GUI

# Nginx
sudo nginx -t                 # Test config
sudo systemctl reload nginx   # Reload config

# SSL
sudo certbot renew            # Renew certificates

# Deployment
./deploy.sh                   # Run deployment
```

### Health Check
```bash
curl https://api.aegira.yourdomain.com/health
# Expected: {"success":true,"data":{"status":"ok"}}
```

---

## Security Checklist

- [ ] SSH key authentication enabled
- [ ] Root login disabled
- [ ] UFW firewall enabled
- [ ] SSL certificate installed
- [ ] `.env` file permissions set to 600
- [ ] PostgreSQL password is strong
- [ ] JWT_SECRET is 64+ characters
- [ ] CORS_ORIGINS set to actual domains
- [ ] Rate limiting enabled in Nginx
- [ ] Regular backups configured

---

## Backup Strategy

### Database backup script
```bash
nano /var/www/aegira/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/aegira"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U aegira aegira_production | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

### Add to crontab
```bash
crontab -e
# Add this line for daily backup at 2 AM:
0 2 * * * /var/www/aegira/backup.sh >> /var/log/aegira/backup.log 2>&1
```
