const path = require('node:path');

module.exports = {
  apps: [{
    name: 'oriana-api',
    script: 'src/server.js',
    cwd: path.join(__dirname, 'Backend'),
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
    },
  }],
};
