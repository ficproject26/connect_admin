const { getTransporter } = require('../config/mailer');
const { OTP_EXPIRES_MINUTES, maskEmail } = require('./otpService');

/**
 * Send single-use verification OTP email via Gmail SMTP
 * Fails fast and throws error if sendMail fails, preventing false positive frontend modal transitions
 */
const sendOTPEmail = async ({ email: rawEmail, toEmail, otp, purpose, metadata = {} }) => {
  const recipient = (rawEmail || toEmail || '').toLowerCase().trim();
  if (!recipient) {
    throw new Error('Recipient email is required for OTP dispatch');
  }

  let subject = 'Payment Security Verification OTP';
  let actionDesc = 'payment security verification';

  switch (purpose) {
    case 'PAYMENT_EMAIL_SETUP':
      subject = 'Payment Authorization Email Setup OTP';
      actionDesc = 'configuring the official Payment Authorization Email for the Admin Portal';
      break;
    case 'CURRENT_EMAIL_CHANGE':
    case 'EMAIL_CHANGE_OLD':
    case 'PAYMENT_EMAIL_CHANGE_OLD':
      subject = 'Security Alert: Authorize Payment Email Change';
      actionDesc = 'verifying your current payment email address before changing to a new one';
      break;
    case 'NEW_EMAIL_CHANGE':
    case 'EMAIL_CHANGE_NEW':
    case 'PAYMENT_EMAIL_CHANGE_NEW':
      subject = 'Verify New Payment Authorization Email';
      actionDesc = 'confirming this address as the new official Payment Authorization Email';
      break;
    case 'PIN_SETUP':
    case 'TRANSACTION_PIN_SETUP':
      subject = 'Set Transaction PIN Verification OTP';
      actionDesc = 'setting your 6-digit Transaction PIN for payment disbursements';
      break;
    case 'PIN_CHANGE':
    case 'TRANSACTION_PIN_CHANGE':
      subject = 'Change Transaction PIN Verification OTP';
      actionDesc = 'modifying your 6-digit Transaction PIN for payment disbursements';
      break;
    case 'PAYMENT_AUTHORIZATION':
      const amtStr = metadata.amount ? `₹${Number(metadata.amount).toLocaleString('en-IN')}` : '';
      subject = `Payment Security Verification OTP ${amtStr}`.trim();
      actionDesc = `authorizing disbursement of payment ${metadata.paymentId || ''} (${amtStr}) to ${metadata.recipientName || 'recipient'}`;
      break;
    default:
      break;
  }

  const textBody = `Payment Security Verification\n\nYour verification OTP is:\n\n${otp}\n\nThis OTP is valid for ${OTP_EXPIRES_MINUTES} minutes.\n\nAction: ${actionDesc}\n\nIf you did not request this verification, please ignore this email.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
      <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 24px 32px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">FORGE INDIA CONNECT</h1>
        <p style="margin: 4px 0 0 0; color: #fef3c7; font-size: 13px; font-weight: 600;">Main Admin • Payment Security Authorization</p>
      </div>
      <div style="padding: 32px 28px;">
        <h2 style="font-size: 16px; color: #ffffff; margin-top: 0; margin-bottom: 8px;">Payment Security Verification</h2>
        <p style="font-size: 13px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">
          You are receiving this verification code for <strong>${actionDesc}</strong> in the Main Admin Portal.
        </p>
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; display: block; margin-bottom: 8px;">Your Verification OTP</span>
          <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ffffff; font-family: monospace;">${otp}</span>
          <span style="font-size: 12px; color: #94a3b8; display: block; margin-top: 8px;">This OTP is valid for ${OTP_EXPIRES_MINUTES} minutes • Single-use only</span>
        </div>
        ${metadata.amount ? `
        <div style="background: #0b1120; border: 1px dashed #334155; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #94a3b8;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Payment ID:</span> <strong style="color: #f8fafc;">${metadata.paymentId || 'N/A'}</strong></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Recipient:</span> <strong style="color: #f8fafc;">${metadata.recipientName || 'N/A'}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span>Amount:</span> <strong style="color: #10b981;">₹${Number(metadata.amount || 0).toLocaleString('en-IN')}</strong></div>
        </div>` : ''}
        <p style="font-size: 12px; line-height: 1.5; color: #ef4444; margin: 0 0 12px 0;">
          ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Antigravity/Forge India Connect admins will never ask for your OTP.
        </p>
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          If you did not request this verification, please ignore this email.
        </p>
      </div>
      <div style="background: #020617; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
        This is an automated security transmission. Forge India Connect.
      </div>
    </div>
  `;

  // Server-side logging required by Section 8
  console.log('Attempting SMTP connection...');
  console.log('SMTP user:', process.env.SMTP_USER);
  console.log('Sending OTP email to:', recipient);

  const transporter = getTransporter();
  let fromAddress = (process.env.SMTP_FROM || '').trim();
  const smtpUser = (process.env.SMTP_USER || 'ficonnectblr@gmail.com').trim();
  if (!fromAddress) {
    fromAddress = `"Forge India Connect Security" <${smtpUser}>`;
  } else if (!fromAddress.includes('<')) {
    fromAddress = `"Forge India Connect Security" <${fromAddress}>`;
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject,
      text: textBody,
      html: htmlBody
    });

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId,
      recipient: maskEmail(recipient)
    };
  } catch (error) {
    // Explicit SMTP error logging (Section 8)
    console.error('SMTP ERROR:', {
      code: error.code,
      response: error.response,
      command: error.command,
      message: error.message
    });
    throw new Error(`Unable to send OTP email: ${error.message || 'SMTP transmission failure'}`);
  }
};

/**
 * Send test email for Section 9 Super Admin diagnostics
 */
const sendTestEmail = async (targetEmail) => {
  const recipient = (targetEmail || '').toLowerCase().trim();
  if (!recipient) throw new Error('Recipient email is required');

  console.log('Attempting SMTP connection...');
  console.log('SMTP user:', process.env.SMTP_USER);
  console.log('Sending test email to:', recipient);

  const transporter = getTransporter();
  let fromAddress = (process.env.SMTP_FROM || '').trim();
  const smtpUser = (process.env.SMTP_USER || 'ficonnectblr@gmail.com').trim();
  if (!fromAddress) {
    fromAddress = `"Forge India Connect Security" <${smtpUser}>`;
  } else if (!fromAddress.includes('<')) {
    fromAddress = `"Forge India Connect Security" <${fromAddress}>`;
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: 'Forge India Connect - SMTP Test Email',
      text: 'This is a test email sent from Forge India Connect Super Admin Payment Security service. If you are seeing this, SMTP email delivery is functioning perfectly.',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #10b981; border-radius: 12px; background: #0f172a; color: #ffffff;">
          <h2 style="color: #10b981; margin-top: 0;">✅ SMTP Email Service Active</h2>
          <p style="font-size: 14px; color: #cbd5e1;">This confirms that the Gmail SMTP service configured in Forge India Connect is functioning properly and able to dispatch messages directly to your inbox.</p>
          <p style="font-size: 12px; color: #64748b;">Recipient: ${recipient} • Sent at: ${new Date().toISOString()}</p>
        </div>
      `
    });

    console.log('Email sent successfully:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('SMTP ERROR:', {
      code: error.code,
      response: error.response,
      command: error.command,
      message: error.message
    });
    throw new Error(`SMTP Test Failure: ${error.message}`);
  }
};

module.exports = {
  sendOTPEmail,
  sendTestEmail
};
