// PM2 Ecosystem Configuration for atlasx.online
// Production deployment configuration

module.exports = {
  apps: [
    {
      name: "atlasx3",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",

      // Environment variables
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },

      // Logging
      error_file: "logs/error.log",
      out_file: "logs/output.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      combine_logs: true,

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      max_memory_restart: "500M",

      // Watch & restart on file changes (disable in production)
      watch: false,
      ignore_watch: ["node_modules", "logs", "data"],

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,

      // Source map support
      source_map_support: true,

      // Interpreter options
      node_args: "--max-old-space-size=2048",

      // Cron restart (optional - restart daily at 3 AM)
      cron_restart: "0 3 * * *",

      // Merge logs from all instances
      merge_logs: true,

      // Time zone
      time: true,
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: "ubuntu",
      host: "erc.dog",
      ref: "origin/main",
      repo: "git@github.com:taherhussain610/atlasx3.git",
      path: "/var/www/atlasx3",
      "post-deploy": "npm install --production && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "apt-get update && apt-get install -y git nodejs npm nginx",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
    },
  },
};
