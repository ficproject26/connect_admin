const nodemailer = require('nodemailer');

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = Number(process.env.SMTP_PORT) || 465;
const secure = process.env.SMTP_SECURE === 'true' || port === 465;
const user = (process.env.SMTP_USER || '').trim();
const rawPass = (process.env.SMTP_PASS || '').trim();
// Strip spaces from Gmail 16-character App Password (e.g. "kgfy ptpa lifh xrzz" -> "kgfyptpalifhxrzz")
const pass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    if (!user || !pass) {
      console.warn('⚠️ [SMTP Mailer] SMTP_USER or SMTP_PASS is missing in environment variables.');
    }
    transporter = nodemailer.createTransport({
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
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000
    });
  }
  return transporter;
};

const verifyTransporter = async () => {
  try {
    console.log('Attempting SMTP connection...');
    console.log('SMTP user:', user);
    const t = getTransporter();
    await t.verify();
    console.log('✅ [SMTP Mailer] Connection verified successfully with host:', host, 'port:', port);
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
  verifyTransporter
};
