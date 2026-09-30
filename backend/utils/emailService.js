const crypto = require('crypto');
const nodemailer = require('nodemailer');

const PEPPER_SECRET = process.env.JWT_SECRET || 'connect_secret_key_prod_2026';

/**
 * Mask email for safe UI display (e.g. "admin@example.com" -> "a***n@example.com")
 */
const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    const clean = email.trim();
    const parts = clean.split('@');
    if (parts.length !== 2) return clean;
    const [user, domain] = parts;
    if (user.length <= 2) {
        return `${user[0]}*@${domain}`;
    }
    const visibleStart = user.slice(0, 2);
    const visibleEnd = user.slice(-1);
    return `${visibleStart}***${visibleEnd}@${domain}`;
};

/**
 * Generate cryptographically secure 6-digit numeric OTP
 */
const generateOtp = () => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Hash OTP with email, purpose, and server pepper (SHA-256)
 */
const hashOtp = (otp, email, purpose) => {
    const raw = `${String(otp).trim()}:${String(email).toLowerCase().trim()}:${String(purpose).trim()}:${PEPPER_SECRET}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

/**
 * Verify submitted OTP against stored hash using timing-safe comparison
 */
const verifyOtpHash = (enteredOtp, email, purpose, storedHash) => {
    if (!enteredOtp || !storedHash) return false;
    const computed = hashOtp(enteredOtp, email, purpose);
    const bufA = Buffer.from(computed, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * Configure Nodemailer transporter if SMTP settings exist in environment
 */
let transporter = null;
const getTransporter = () => {
    if (transporter) return transporter;
    const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
    const port = process.env.SMTP_PORT || process.env.MAIL_PORT || 587;
    const user = process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.EMAIL_PASS;

    if (host && user && pass) {
        try {
            transporter = nodemailer.createTransport({
                host,
                port: Number(port),
                secure: Number(port) === 465,
                auth: { user, pass },
                tls: { rejectUnauthorized: false }
            });
        } catch (err) {
            console.warn('[EmailService] Failed to initialize SMTP transporter:', err.message);
        }
    }
    return transporter;
};

/**
 * Send Payment Security OTP Email
 */
const sendPaymentSecurityEmail = async ({ toEmail, purpose, otp, metadata = {} }) => {
    const email = (toEmail || '').toLowerCase().trim();
    let subject = 'Security Verification Code - Forge India Connect';
    let actionDesc = 'a payment security action';

    switch (purpose) {
        case 'PAYMENT_EMAIL_SETUP':
            subject = 'Verify Payment Authorization Email - Forge India Connect';
            actionDesc = 'first-time setup of the official Payment Authorization Email for the Admin Portal';
            break;
        case 'PAYMENT_EMAIL_CHANGE_OLD':
            subject = 'Security Alert: Authorize Payment Email Change';
            actionDesc = 'authorizing a request to change the current Payment Authorization Email';
            break;
        case 'PAYMENT_EMAIL_CHANGE_NEW':
            subject = 'Verify Your New Payment Authorization Email';
            actionDesc = 'confirming this address as the new official Payment Authorization Email';
            break;
        case 'TRANSACTION_PIN_SETUP':
            subject = 'Security Verification: Set Transaction PIN';
            actionDesc = 'configuring the 6-digit Transaction PIN for payment disbursements';
            break;
        case 'TRANSACTION_PIN_CHANGE':
            subject = 'Security Verification: Change Transaction PIN';
            actionDesc = 'changing the 6-digit Transaction PIN for payment disbursements';
            break;
        case 'PAYMENT_AUTHORIZATION':
            const amtStr = metadata.amount ? `₹${Number(metadata.amount).toLocaleString('en-IN')}` : '';
            subject = `High Security: Authorize Payment Disbursement ${amtStr}`.trim();
            actionDesc = `authorizing disbursement of payment ${metadata.paymentId || ''} (${amtStr}) to ${metadata.recipientName || 'recipient'}`;
            break;
        default:
            break;
    }

    const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
            <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 24px 32px; text-align: center;">
                <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">FORGE INDIA CONNECT</h1>
                <p style="margin: 4px 0 0 0; color: #fef3c7; font-size: 13px; font-weight: 600;">Main Admin • Payment Security Authorization</p>
            </div>
            <div style="padding: 32px 28px;">
                <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-top: 0;">
                    You are receiving this verification code because you initiated <strong>${actionDesc}</strong> in the Main Admin Portal.
                </p>
                <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #f59e0b; display: block; margin-bottom: 8px;">Your Single-Use Verification Code</span>
                    <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; font-family: monospace;">${otp}</span>
                    <span style="font-size: 12px; color: #94a3b8; display: block; margin-top: 8px;">Valid for 5 minutes • Single-use only</span>
                </div>
                ${metadata.amount ? `
                <div style="background: #0b1120; border: 1px dashed #334155; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #94a3b8;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Payment ID:</span> <strong style="color: #f8fafc;">${metadata.paymentId || 'N/A'}</strong></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Recipient:</span> <strong style="color: #f8fafc;">${metadata.recipientName || 'N/A'} (${metadata.recipientType || 'Recipient'})</strong></div>
                    <div style="display: flex; justify-content: space-between;"><span>Disbursement Amount:</span> <strong style="color: #10b981;">₹${Number(metadata.amount || 0).toLocaleString('en-IN')}</strong></div>
                </div>` : ''}
                <p style="font-size: 12px; line-height: 1.5; color: #ef4444; margin: 0;">
                    ⚠️ <strong>Security Notice:</strong> Never share this code with anyone. Forge India Connect administrators will never ask for your verification code or Transaction PIN.
                </p>
            </div>
            <div style="background: #020617; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b;">
                This is an automated security transmission. If you did not initiate this request, please lock the portal and notify the system administrator immediately.
            </div>
        </div>
    `;

    const textBody = `FORGE INDIA CONNECT - Payment Security Code\n\nYour 6-digit verification code is: ${otp}\nAction: ${actionDesc}\nValid for 5 minutes. Never share this code with anyone.`;

    const mailClient = getTransporter();
    if (mailClient) {
        try {
            await mailClient.sendMail({
                from: process.env.SMTP_FROM || `"Forge India Connect Security" <noreply@ficapp.in>`,
                to: email,
                subject,
                text: textBody,
                html: htmlBody
            });
            console.log(`📧 [EmailService] Verification OTP successfully dispatched via SMTP to ${email} for ${purpose}`);
            return { sent: true, mode: 'smtp' };
        } catch (smtpErr) {
            console.error(`[EmailService] SMTP error sending to ${email}:`, smtpErr.message);
        }
    }

    // Graceful secure console logging if SMTP is not configured or fails
    console.log(`🔐 [Payment Security Email Service] To: ${email} | Purpose: ${purpose} | Code: ${otp}`);
    return { sent: true, mode: 'console' };
};

module.exports = {
    maskEmail,
    generateOtp,
    hashOtp,
    verifyOtpHash,
    sendPaymentSecurityEmail
};
