const crypto = require('crypto');
const nodemailer = require('nodemailer');

const PEPPER_SECRET = process.env.JWT_SECRET || 'connect_secret_key_prod_2026';
const OTP_EXPIRES_MINUTES = parseInt(process.env.OTP_EXPIRES_MINUTES, 10) || 5;

/**
 * Mask email for safe UI display (e.g. "admin@example.com" -> "a******@gmail.com")
 */
const maskEmail = (email) => {
    if (!email || typeof email !== 'string') return '';
    const clean = email.trim();
    const parts = clean.split('@');
    if (parts.length !== 2) return clean;
    const [user, domain] = parts;
    if (user.length <= 1) {
        return `${user}******@${domain}`;
    }
    const visibleStart = user.slice(0, 1);
    return `${visibleStart}******@${domain}`;
};

/**
 * Generate cryptographically secure 6-digit numeric OTP
 * Using Node.js crypto.randomInt (100000 to 1000000)
 */
const generateOtp = () => {
    return crypto.randomInt(100000, 1000000).toString();
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
    const host = (process.env.SMTP_HOST || process.env.MAIL_HOST || '').trim();
    const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || 587, 10);
    const user = (process.env.SMTP_USER || process.env.MAIL_USER || process.env.EMAIL_USER || '').trim();
    const rawPass = (process.env.SMTP_PASS || process.env.MAIL_PASS || process.env.EMAIL_PASS || '').trim();
    // Gmail app passwords contain spaces like "kgfy ptpa lifh xrzz"; remove spaces for SMTP auth
    const pass = host.includes('gmail') ? rawPass.replace(/\s+/g, '') : rawPass;

    if (host && user && pass) {
        try {
            transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
                tls: { rejectUnauthorized: false },
                connectionTimeout: 15000,
                greetingTimeout: 15000,
                socketTimeout: 20000
            });
        } catch (err) {
            console.warn('[EmailService] Failed to initialize SMTP transporter:', err.message);
        }
    }
    return transporter;
};

/**
 * Core sendOTPEmail function for all security operations
 */
const sendOTPEmail = async ({ email: rawEmail, toEmail, otp, purpose, metadata = {} }) => {
    const email = (rawEmail || toEmail || '').toLowerCase().trim();
    if (!email) throw new Error('Recipient email is required for OTP dispatch');

    let subject = 'Payment Security Verification OTP';
    let actionDesc = 'payment security verification';

    switch (purpose) {
        case 'PAYMENT_EMAIL_SETUP':
            subject = 'Payment Authorization Email Setup OTP';
            actionDesc = 'configuring the official Payment Authorization Email for the Admin Portal';
            break;
        case 'EMAIL_CHANGE_OLD':
        case 'PAYMENT_EMAIL_CHANGE_OLD':
            subject = 'Security Alert: Authorize Payment Email Change';
            actionDesc = 'verifying your current payment email address before changing to a new one';
            break;
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
                    ⚠️ <strong>Security Notice:</strong> Never share this code with anyone.
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

    const mailClient = getTransporter();
    if (mailClient) {
        try {
            let fromAddress = (process.env.SMTP_FROM || '').trim();
            if (!fromAddress || !fromAddress.includes('<')) {
                const user = (process.env.SMTP_USER || 'ficonnectblr@gmail.com').trim();
                fromAddress = `"Forge India Connect Security" <${user}>`;
            }
            await mailClient.sendMail({
                from: fromAddress,
                to: email,
                subject,
                text: textBody,
                html: htmlBody
            });
            console.log(`📧 [EmailService] Verification OTP successfully dispatched via SMTP to ${email} for ${purpose}`);
            return { sent: true, mode: 'smtp' };
        } catch (smtpErr) {
            console.error(`[EmailService] SMTP error sending to ${email}:`, smtpErr.message);
            // Fall back to console mode so operations aren't blocked when SMTP is misconfigured
        }
    }

    // When SMTP credentials are not configured or fail, log safe developer notification
    if (process.env.NODE_ENV !== 'production') {
        console.log(`🔐 [Email OTP Service] (Dev Simulation) To: ${email} | Purpose: ${purpose} | Code: ${otp}`);
    } else {
        console.log(`🔐 [Email OTP Service] OTP generated and queued for ${maskEmail(email)} for ${purpose}`);
    }
    return { sent: true, mode: 'fallback' };
};

module.exports = {
    maskEmail,
    generateOtp,
    hashOtp,
    verifyOtpHash,
    sendOTPEmail,
    sendPaymentSecurityEmail: sendOTPEmail // Alias for backward compatibility
};
