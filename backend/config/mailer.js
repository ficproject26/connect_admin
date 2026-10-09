const nodemailer = require('nodemailer');

const createTransporter = (overridePort = null) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const defaultPort = Number(process.env.SMTP_PORT) || 465;
  const port = overridePort || defaultPort;
  const secure = port === 465 ? true : (port === 587 ? false : (process.env.SMTP_SECURE === 'true'));
  const user = ((process.env.SMTP_USER && process.env.SMTP_USER.trim()) || 'ficonnectblr@gmail.com').trim();
  const rawPass = ((process.env.SMTP_PASS && process.env.SMTP_PASS.trim()) || 'kgfy ptpa lifh xrzz').trim();
  // Strip spaces from Gmail 16-character App Password (e.g. "kgfy ptpa lifh xrzz" -> "kgfyptpalifhxrzz")
  const pass = rawPass.replace(/\s+/g, '');

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    },
    tls: {
      rejectUnauthorized: false
    },
    // Balanced timeouts for cloud server reliability
    connectionTimeout: 20000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  });
};

const getTransporter = () => {
  return createTransporter();
};

const verifyTransporter = async () => {
  try {
    const user = (process.env.SMTP_USER || '').trim();
    console.log('Attempting SMTP connection...');
    console.log('SMTP user:', user);
    const t = getTransporter();
    await t.verify();
    console.log('✅ [SMTP Mailer] Connection verified successfully with host:', process.env.SMTP_HOST || 'smtp.gmail.com', 'port:', process.env.SMTP_PORT || 465);
    return true;
  } catch (error) {
    console.error('SMTP ERROR:', {
      code: error.code,
      response: error.response,
      command: error.command,
      message: error.message
    });
    return false;
  }
};

module.exports = {
  getTransporter,
  createTransporter,
  verifyTransporter
};
