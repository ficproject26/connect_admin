const nodemailer = require('nodemailer');

const createTransporter = (overridePort = null) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const defaultPort = Number(process.env.SMTP_PORT) || 465;
  const port = overridePort || defaultPort;
  const secure = port === 465;
  const user = (process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.SMTP_PASS || '').trim();
  // Strip spaces from Gmail 16-character App Password (e.g. "kgfy ptpa lifh xrzz" -> "kgfyptpalifhxrzz")
  const pass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;

  if (!user || !pass) {
    console.warn('⚠️ [SMTP Mailer] SMTP_USER or SMTP_PASS is missing in environment variables.');
  }

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
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
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
