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
        PORT: 8004,
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: 587,
        SMTP_SECURE: 'true',
        SMTP_USER: 'ficonnectblr@gmail.com',
        SMTP_PASS: 'kgfy ptpa lifh xrzz',
        SMTP_FROM: '"Forge India Connect Security" <ficonnectblr@gmail.com>',
        OTP_EXPIRES_MINUTES: 5
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 8004,
        SMTP_HOST: 'smtp.gmail.com',
        SMTP_PORT: 587,
        SMTP_SECURE: 'true',
        SMTP_USER: 'ficonnectblr@gmail.com',
        SMTP_PASS: 'kgfy ptpa lifh xrzz',
        SMTP_FROM: '"Forge India Connect Security" <ficonnectblr@gmail.com>',
        OTP_EXPIRES_MINUTES: 5
      }
    }
  ]
};
