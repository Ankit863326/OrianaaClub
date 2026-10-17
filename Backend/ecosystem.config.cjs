// Phase 6: Keep the API alive under PM2 while secrets load from Backend/.env.
module.exports = {
  apps: [{
    name: 'oriana-api',
    script: 'src/server.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
