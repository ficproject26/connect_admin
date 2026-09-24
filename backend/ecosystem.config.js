module.exports = {
  apps: [
    {
      name: 'connect-admin-backend',
      script: './server.js',
      cwd: __dirname,
      // Cluster mode note: For multi-instance cluster mode, ensure REDIS_URL is configured
      // so that Socket.IO and cacheService operate across workers seamlessly.
      instances: process.env.NODE_ENV === 'production' && process.env.REDIS_URL ? 'max' : 1,
      exec_mode: process.env.NODE_ENV === 'production' && process.env.REDIS_URL ? 'cluster' : 'fork',
      watch: false,
      max_memory_restart: '800M',
      env: {
        NODE_ENV: 'development',
        PORT: 8000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    }
  ]
};
