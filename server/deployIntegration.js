const fs = require('fs').promises;
const path = require('path');

/**
 * Script để deploy integration server lên VM
 */
class IntegrationDeployment {
  constructor() {
    this.vmIP = '34.142.175.163';
    this.deployPath = '/var/www/video-call-integration';
    this.requiredFiles = [
      'integrationServer.js',
      'package.json',
      '.env.example',
      'middleware/authMiddleware.js',
      'controllers/integrationController.js',
      'adapters/DatabaseAdapter.js',
      'routes/integrationRoutes.js',
      'websocket/integrationSocketHandlers.js',
      'public/video-call.html'
    ];
  }

  /**
   * Tạo deployment package
   */
  async createDeploymentPackage() {
    try {
      console.log('📦 Creating deployment package...');

      const deployDir = path.join(__dirname, 'deploy');
      await this.ensureDirectory(deployDir);

      // Copy required files
      for (const file of this.requiredFiles) {
        const sourcePath = path.join(__dirname, file);
        const targetPath = path.join(deployDir, file);
        
        await this.ensureDirectory(path.dirname(targetPath));
        
        try {
          await fs.copyFile(sourcePath, targetPath);
          console.log(`✓ Copied ${file}`);
        } catch (error) {
          console.log(`⚠️  ${file} not found, skipping...`);
        }
      }

      // Create package.json for deployment
      const deployPackageJson = {
        name: 'video-call-integration-server',
        version: '1.0.0',
        description: 'Integration server for video call translation',
        main: 'integrationServer.js',
        scripts: {
          start: 'node integrationServer.js',
          install: 'npm install --production',
          setup: 'node setupDatabase.js'
        },
        dependencies: {
          'express': '^4.18.2',
          'socket.io': '^4.7.2',
          'mysql2': '^3.6.0',
          'bcrypt': '^5.1.0',
          'jsonwebtoken': '^9.0.2',
          'cors': '^2.8.5',
          'uuid': '^9.0.0',
          'dotenv': '^16.3.1',
          'helmet': '^7.0.0',
          'compression': '^1.7.4'
        }
      };

      await fs.writeFile(
        path.join(deployDir, 'package.json'),
        JSON.stringify(deployPackageJson, null, 2)
      );

      // Create .env template
      const envTemplate = `# Video Call Translation Integration Server Configuration
# Copy this to .env and fill in your values

# Server Configuration
PORT=3001
HOST=0.0.0.0
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=hommy_database

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key-here

# CORS Origins (comma-separated)
ALLOWED_ORIGINS=https://your-website.com,https://another-domain.com

# URLs
VIDEO_CALL_SERVER_URL=https://34.142.175.163
SOCKET_SERVER_URL=https://34.142.175.163

# PM2 Configuration
PM2_APP_NAME=video-call-integration
`;

      await fs.writeFile(path.join(deployDir, '.env.example'), envTemplate);

      // Create deployment script
      await this.createDeploymentScript(deployDir);

      // Create PM2 ecosystem file
      await this.createPM2Config(deployDir);

      // Create nginx configuration
      await this.createNginxConfig(deployDir);

      console.log('✅ Deployment package created successfully!');
      console.log(`📁 Package location: ${deployDir}`);
      
      await this.showDeploymentInstructions();

    } catch (error) {
      console.error('❌ Error creating deployment package:', error);
      throw error;
    }
  }

  /**
   * Tạo directory nếu chưa tồn tại
   */
  async ensureDirectory(dir) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Tạo script deployment
   */
  async createDeploymentScript(deployDir) {
    const deployScript = `#!/bin/bash
# Video Call Integration Server Deployment Script

set -e

echo "🚀 Starting Video Call Integration Server Deployment..."

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m' # No Color

# Configuration
DEPLOY_PATH="/var/www/video-call-integration"
SERVICE_NAME="video-call-integration"
BACKUP_PATH="/var/backups/video-call-integration"

# Create backup of existing installation
if [ -d "$DEPLOY_PATH" ]; then
    echo -e "\${YELLOW}📋 Creating backup...\${NC}"
    sudo mkdir -p "$BACKUP_PATH"
    sudo cp -r "$DEPLOY_PATH" "$BACKUP_PATH/$(date +%Y%m%d_%H%M%S)"
    echo -e "\${GREEN}✓ Backup created\${NC}"
fi

# Create deployment directory
echo -e "\${BLUE}📁 Creating deployment directory...\${NC}"
sudo mkdir -p "$DEPLOY_PATH"

# Copy files
echo -e "\${BLUE}📦 Copying files...\${NC}"
sudo cp -r ./* "$DEPLOY_PATH/"
sudo chown -R www-data:www-data "$DEPLOY_PATH"

# Install dependencies
echo -e "\${BLUE}📚 Installing dependencies...\${NC}"
cd "$DEPLOY_PATH"
sudo -u www-data npm install --production

# Setup environment file
if [ ! -f "$DEPLOY_PATH/.env" ]; then
    echo -e "\${YELLOW}⚙️  Setting up environment file...\${NC}"
    sudo cp "$DEPLOY_PATH/.env.example" "$DEPLOY_PATH/.env"
    echo -e "\${RED}⚠️  Please edit $DEPLOY_PATH/.env with your configuration\${NC}"
fi

# Setup database tables
echo -e "\${BLUE}🗄️  Setting up database...\${NC}"
sudo -u www-data node setupDatabase.js

# Install PM2 globally if not exists
if ! command -v pm2 &> /dev/null; then
    echo -e "\${BLUE}📦 Installing PM2...\${NC}"
    sudo npm install -g pm2
fi

# Stop existing service
echo -e "\${YELLOW}🛑 Stopping existing service...\${NC}"
sudo -u www-data pm2 stop "$SERVICE_NAME" 2>/dev/null || true

# Start service with PM2
echo -e "\${BLUE}🚀 Starting service...\${NC}"
sudo -u www-data pm2 start ecosystem.config.js
sudo -u www-data pm2 save

# Setup PM2 startup
echo -e "\${BLUE}⚙️  Setting up PM2 startup...\${NC}"
sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u www-data --hp /var/www

# Setup Nginx (if config file exists)
if [ -f "nginx.conf" ]; then
    echo -e "\${BLUE}🌐 Setting up Nginx...\${NC}"
    sudo cp nginx.conf /etc/nginx/sites-available/video-call-integration
    sudo ln -sf /etc/nginx/sites-available/video-call-integration /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
fi

# Health check
echo -e "\${BLUE}🏥 Performing health check...\${NC}"
sleep 5
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "\${GREEN}✅ Deployment successful! Service is healthy.\${NC}"
else
    echo -e "\${RED}❌ Health check failed. Please check logs: pm2 logs $SERVICE_NAME\${NC}"
    exit 1
fi

echo -e "\${GREEN}🎉 Video Call Integration Server deployed successfully!\${NC}"
echo -e "\${BLUE}📊 Status: pm2 status\${NC}"
echo -e "\${BLUE}📋 Logs: pm2 logs $SERVICE_NAME\${NC}"
echo -e "\${BLUE}🔄 Restart: pm2 restart $SERVICE_NAME\${NC}"
echo -e "\${BLUE}🌐 Health: curl http://localhost:3001/health\${NC}"
`;

    await fs.writeFile(path.join(deployDir, 'deploy.sh'), deployScript);
    console.log('✓ Created deploy.sh');
  }

  /**
   * Tạo PM2 ecosystem config
   */
  async createPM2Config(deployDir) {
    const pm2Config = `module.exports = {
  apps: [{
    name: 'video-call-integration',
    script: 'integrationServer.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};`;

    await fs.writeFile(path.join(deployDir, 'ecosystem.config.js'), pm2Config);
    console.log('✓ Created ecosystem.config.js');
  }

  /**
   * Tạo Nginx configuration
   */
  async createNginxConfig(deployDir) {
    const nginxConfig = `server {
    listen 80;
    server_name 34.142.175.163;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name 34.142.175.163;

    # SSL Configuration (you need to add your SSL certificates)
    # ssl_certificate /path/to/your/certificate.crt;
    # ssl_certificate_key /path/to/your/private.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Integration API
    location /api/integration {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket for Socket.IO
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Video call pages
    location /video-call/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`;

    await fs.writeFile(path.join(deployDir, 'nginx.conf'), nginxConfig);
    console.log('✓ Created nginx.conf');
  }

  /**
   * Hiển thị hướng dẫn deployment
   */
  async showDeploymentInstructions() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    DEPLOYMENT INSTRUCTIONS                     ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ 1. Copy the 'deploy' folder to your VM (34.142.175.163):      ║
║    scp -r deploy/ user@34.142.175.163:/tmp/                   ║
║                                                                ║
║ 2. SSH to your VM:                                             ║
║    ssh user@34.142.175.163                                     ║
║                                                                ║
║ 3. Navigate to deployment folder:                              ║
║    cd /tmp/deploy                                              ║
║                                                                ║
║ 4. Make deployment script executable:                          ║
║    chmod +x deploy.sh                                          ║
║                                                                ║
║ 5. Run deployment:                                             ║
║    sudo ./deploy.sh                                            ║
║                                                                ║
║ 6. Edit environment configuration:                             ║
║    sudo nano /var/www/video-call-integration/.env             ║
║                                                                ║
║ 7. Restart service:                                            ║
║    sudo -u www-data pm2 restart video-call-integration        ║
║                                                                ║
║ 8. Check status:                                               ║
║    curl http://34.142.175.163:3001/health                     ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║                       INTEGRATION USAGE                       ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║ Server API Base URL:                                           ║
║ https://34.142.175.163/api/integration                        ║
║                                                                ║
║ WebSocket URL:                                                 ║
║ wss://34.142.175.163/socket.io                                ║
║                                                                ║
║ Client Components Location:                                    ║
║ ./integration-client-components/                              ║
║                                                                ║
║ Integration Guide:                                             ║
║ ./integration-client-components/README.md                     ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);
  }
}

// Run deployment if this file is executed directly
if (require.main === module) {
  const deployment = new IntegrationDeployment();
  deployment.createDeploymentPackage().catch(console.error);
}

module.exports = IntegrationDeployment;
