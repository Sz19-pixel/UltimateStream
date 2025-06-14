# Deployment Guide

This guide covers various deployment options for the Stremio Scraper Addon.

## Local Development

### Prerequisites
- Node.js 14.0.0 or higher
- npm or yarn
- Git (optional)

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd stremio-scraper-addon

# Install dependencies
npm install

# Start in development mode
npm run dev
```

The addon will be available at `http://localhost:3000`

## Production Deployment

### Option 1: VPS/Dedicated Server

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2
```

#### 2. Deploy Application
```bash
# Clone repository
git clone <repository-url>
cd stremio-scraper-addon

# Install dependencies
npm install --production

# Start with PM2
pm2 start index.js --name "stremio-addon"

# Save PM2 configuration
pm2 save
pm2 startup
```

#### 3. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["node", "index.js"]
```

#### 2. Build and Run
```bash
# Build image
docker build -t stremio-scraper-addon .

# Run container
docker run -d \
  --name stremio-addon \
  -p 3000:3000 \
  -e NODE_ENV=production \
  stremio-scraper-addon
```

#### 3. Docker Compose
```yaml
version: '3.8'

services:
  stremio-addon:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - CACHE_ENABLED=true
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
```

### Option 3: Cloud Platforms

#### Heroku
```bash
# Install Heroku CLI
# Create Heroku app
heroku create your-addon-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Deploy
git push heroku main
```

#### Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

#### Vercel
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.js"
    }
  ]
}
```

## Environment Configuration

### Production Environment Variables
```bash
# Server
NODE_ENV=production
PORT=3000

# Performance
MAX_CONCURRENT=10
TIMEOUT=45000

# Caching
CACHE_ENABLED=true
CACHE_CATALOG_TTL=7200
CACHE_META_TTL=172800
CACHE_STREAMS_TTL=3600

# Logging
LOG_LEVEL=warn
LOG_FILE=true
LOG_FILE_PATH=/app/logs/addon.log

# Security
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=200
```

## SSL/HTTPS Setup

### Let's Encrypt with Certbot
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Monitoring and Logging

### PM2 Monitoring
```bash
# View logs
pm2 logs stremio-addon

# Monitor resources
pm2 monit

# Restart application
pm2 restart stremio-addon
```

### Log Rotation
```bash
# Install logrotate configuration
sudo tee /etc/logrotate.d/stremio-addon << EOF
/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        pm2 reload stremio-addon
    endscript
}
EOF
```

## Performance Optimization

### 1. Caching Strategy
- Enable Redis for distributed caching
- Set appropriate TTL values
- Implement cache warming

### 2. Load Balancing
```nginx
upstream stremio_backend {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    location / {
        proxy_pass http://stremio_backend;
    }
}
```

### 3. Database Integration
Consider using a database for:
- Persistent caching
- User preferences
- Analytics
- Rate limiting

## Security Hardening

### 1. Firewall Configuration
```bash
# UFW setup
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Application Security
- Implement input validation
- Use HTTPS only
- Set security headers
- Regular dependency updates

### 3. Rate Limiting
```javascript
// Express rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

## Backup and Recovery

### 1. Configuration Backup
```bash
# Backup configuration
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  package.json \
  src/utils/Config.js \
  .env

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups/stremio-addon"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/backup-$DATE.tar.gz \
  /app/package.json \
  /app/src/ \
  /app/.env
```

### 2. Database Backup (if applicable)
```bash
# MongoDB backup
mongodump --db stremio_addon --out /backups/mongo/

# PostgreSQL backup
pg_dump stremio_addon > /backups/postgres/backup.sql
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find process using port
   sudo lsof -i :3000
   
   # Kill process
   sudo kill -9 <PID>
   ```

2. **Memory Issues**
   ```bash
   # Monitor memory usage
   free -h
   
   # Check Node.js memory
   node --max-old-space-size=4096 index.js
   ```

3. **Puppeteer Issues**
   ```bash
   # Install dependencies
   sudo apt-get install -y \
     gconf-service libasound2 libatk1.0-0 \
     libcairo-gobject2 libgtk-3-0 libgdk-pixbuf2.0-0
   ```

### Health Checks
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancers
- Implement session affinity if needed
- Share cache between instances

### Vertical Scaling
- Increase server resources
- Optimize memory usage
- Use clustering

### Microservices Architecture
Consider splitting into:
- Scraper service
- Torrent service
- Cache service
- API gateway

## Maintenance

### Regular Tasks
1. Update dependencies
2. Monitor logs
3. Check performance metrics
4. Backup configurations
5. Security updates

### Automated Maintenance
```bash
#!/bin/bash
# maintenance.sh

# Update dependencies
npm update

# Restart application
pm2 restart stremio-addon

# Clean old logs
find /app/logs -name "*.log" -mtime +30 -delete

# Health check
curl -f http://localhost:3000/health || exit 1
```

## Support and Monitoring

### Monitoring Tools
- PM2 monitoring
- New Relic
- DataDog
- Custom health checks

### Alerting
Set up alerts for:
- High error rates
- Memory usage
- Response times
- Service downtime

---

This deployment guide provides comprehensive instructions for deploying the Stremio Scraper Addon in various environments. Choose the deployment method that best fits your needs and infrastructure.

