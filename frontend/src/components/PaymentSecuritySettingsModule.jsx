import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Mail, Key, CheckCircle, AlertTriangle, RefreshCw, Lock,
  ArrowRight, Check, X, Eye, EyeOff, ShieldCheck, History, Info,
  AlertCircle, ChevronRight
} from 'lucide-react';

export const PaymentSecuritySettingsModule = ({ token, API_BASE, onToast }) => {
  // Main Settings State (Direct from MongoDB)
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    paymentAuthorizationEmail: '',
    maskedEmail: '',
    emailVerified: false,
    pinConfigured: false,
    isPinLocked: false,
    pinLockedUntil: null,
    securityStatus: 'UNCONFIGURED',
    updatedAt: null
  });

  // Modal Visibility States
  const [modalType, setModalType] = useState(null); // 'SETUP_EMAIL' | 'CHANGE_EMAIL' | 'SETUP_PIN' | 'CHANGE_PIN' | 'AUDIT_LOGS'
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Setup Email Form State
  const [setupEmail, setSetupEmail] = useState('');
  const [setupEmailStep, setSetupEmailStep] = useState(1); // 1: Enter Email, 2: Enter OTP
  const [setupOtp, setSetupOtp] = useState('');
  const [setupOtpTimer, setSetupOtpTimer] = useState(0);

  // Change Payment Authorization Email State (Strict 2-step verification per Step 6)
  const [changeEmailStep, setChangeEmailStep] = useState(1); // 1: Current Email OTP, 2: New Email, 3: Verify New
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentEmailOtp, setCurrentEmailOtp] = useState("");
  const [newEmailOtp, setNewEmailOtp] = useState("");
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [otpPurpose, setOtpPurpose] = useState(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isCurrentEmailLoading, setIsCurrentEmailLoading] = useState(false);

  // Setup PIN Form State
  const [setupPinStep, setSetupPinStep] = useState(1); // 1: OTP, 2: PIN Setup
  const [setupPinOtp, setSetupPinOtp] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinOtpTimer, setPinOtpTimer] = useState(0);

  // Change PIN Form State
  const [changePinStep, setChangePinStep] = useState(1); // 1: OTP sent & Enter OTP + New PIN
  const [changePinOtp, setChangePinOtp] = useState('');
  const [newPinValue, setNewPinValue] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [showChangePin, setShowChangePin] = useState(false);
  const [changePinOtpTimer, setChangePinOtpTimer] = useState(0);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  const maskEmail = (em) => {
    if (!em || !em.includes('@')) return em || '';
    const [u, d] = em.split('@');
    if (u.length <= 1) return `${u}******@${d}`;
    return `${u[0]}******@${d}`;
  };

  // 1. Fetch Current Security Settings from MongoDB via Backend API
  const fetchSettings = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/status`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      const resolvedSettings = data?.settings || data?.data || (data?.success ? data : null);
      if (res.ok && data?.success && resolvedSettings) {
        setSettings({
          paymentAuthorizationEmail: resolvedSettings.paymentAuthorizationEmail || resolvedSettings.email || '',
          maskedEmail: resolvedSettings.maskedEmail || maskEmail(resolvedSettings.paymentAuthorizationEmail || resolvedSettings.email || ''),
          emailVerified: Boolean(resolvedSettings.emailVerified || resolvedSettings.emailConfigured),
          pinConfigured: Boolean(resolvedSettings.pinConfigured || resolvedSettings.transactionPinConfigured),
          isPinLocked: Boolean(resolvedSettings.isPinLocked),
          pinLockedUntil: resolvedSettings.pinLockedUntil || null,
          securityStatus: resolvedSettings.securityStatus || 'UNCONFIGURED',
          updatedAt: resolvedSettings.updatedAt || null
        });
      } else {
        console.error('Payment security status error:', data);
        if (!isSilent) toast(data?.msg || data?.message || 'Payment security service is currently unavailable.', 'error');
      }
    } catch (err) {
      console.error('Payment security status error:', err);
      if (!isSilent) toast('Payment security service is currently unavailable.', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API_BASE, token, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Dynamic countdown timer calculating remainingSeconds from backend expiresAt (STEP 2)
  useEffect(() => {
    if (!otpExpiresAt) {
      setRemainingSeconds(0);
      return;
    }
    const updateCountdown = () => {
      const expiry = new Date(otpExpiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setRemainingSeconds(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  // Resend cooldown countdown (STEP 8: 30-second cooldown)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Timers countdown for other modals (Setup Email, PIN Setup, PIN Change)
  useEffect(() => {
    let interval = null;
    if (setupOtpTimer > 0) {
      interval = setInterval(() => setSetupOtpTimer(prev => prev - 1), 1000);
    } else if (pinOtpTimer > 0) {
      interval = setInterval(() => setPinOtpTimer(prev => prev - 1), 1000);
    } else if (changePinOtpTimer > 0) {
      interval = setInterval(() => setChangePinOtpTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [setupOtpTimer, pinOtpTimer, changePinOtpTimer]);

  // Reset all modal forms on close
  const closeModal = () => {
    setModalType(null);
    setModalLoading(false);
    setModalError('');
    setModalSuccess('');
    // Setup Email
    setSetupEmail('');
    setSetupEmailStep(1);
    setSetupOtp('');
    // Change Email (Reset all separate states per Step 6)
    setChangeEmailStep(1);
    setCurrentEmail('');
    setNewEmail('');
    setCurrentEmailOtp('');
    setNewEmailOtp('');
    setOtpExpiresAt(null);
    setRemainingSeconds(0);
    setOtpPurpose(null);
    setIsSendingOtp(false);
    setIsVerifyingOtp(false);
    setError('');
    setResendCooldown(0);
    setIsCurrentEmailLoading(false);
    // Setup PIN
    setSetupPinStep(1);
    setSetupPinOtp('');
    setPinValue('');
    setPinConfirm('');
    setShowPin(false);
    // Change PIN
    setChangePinStep(1);
    setChangePinOtp('');
    setNewPinValue('');
    setNewPinConfirm('');
    setShowChangePin(false);
  };

  // =========================================================================
  // FLOW 1: FIRST-TIME EMAIL SETUP
  // =========================================================================
  const handleStartSetupEmail = () => {
    closeModal();
    setModalType('SETUP_EMAIL');
    setSetupEmailStep(1);
  };

  const handleRequestSetupEmailOtp = async (e) => {
    e.preventDefault();
    if (!setupEmail || !setupEmail.includes('@')) {
      setModalError('Please enter a valid email address');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/email/setup/request-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: setupEmail.trim().toLowerCase() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSetupEmailStep(2);
        setSetupOtpTimer(300);
        toast(`Verification OTP dispatched to ${setupEmail}`, 'success');
      } else {
        const errorMsg = data.msg || data.message || 'Unable to send OTP. Please try again.';
        setModalError(errorMsg);
        toast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Request setup email OTP error:', err);
      setModalError('Unable to send OTP. Please try again.');
      toast('Unable to send OTP. Please try again.', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifySetupEmailOtp = async (e) => {
    e.preventDefault();
    if (!setupOtp || setupOtp.trim().length !== 6) {
      setModalError('Please enter the 6-digit OTP sent to your email');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/email/setup/verify-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: setupEmail.trim().toLowerCase(),
          otp: setupOtp.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('Payment authorization email verified successfully.', 'success');
        setModalSuccess('Payment authorization email verified successfully.');
        await fetchSettings(true);
        setTimeout(() => closeModal(), 1800);
      } else {
        setModalError(data.msg || data.message || 'Invalid OTP. Please check your email and try again.');
      }
    } catch (err) {
      console.error('Verify setup email OTP error:', err);
      setModalError('Network error verifying OTP code');
    } finally {
      setModalLoading(false);
    }
  };

  // =========================================================================
  // FLOW 2: CHANGE PAYMENT AUTHORIZATION EMAIL (2-STEP VERIFICATION)
  // =========================================================================
  const handleStartChangeEmail = async () => {
    closeModal();
    setModalType('CHANGE_EMAIL');
    setChangeEmailStep(1);
    setIsCurrentEmailLoading(true);
    setIsSendingOtp(true);
    setError('');
    setModalError('');
    setCurrentEmailOtp('');

    try {
      // STEP 1: Fetch currently configured email from backend
      let emailFromBackend = settings.paymentAuthorizationEmail || '';
      try {
        const emailRes = await fetch(`${API_BASE}/admin/payment-security/current-email`, {
          headers: {
            'x-auth-token': token,
            'Authorization': `Bearer ${token}`
          }
        });
        if (emailRes.ok) {
          const emailData = await emailRes.json();
          if (emailData?.currentEmail) {
            emailFromBackend = emailData.currentEmail;
          }
        }
      } catch (fetchErr) {
        console.warn('Fallback fetching current email via status:', fetchErr);
      }

      setCurrentEmail(emailFromBackend);
      setIsCurrentEmailLoading(false);

      // STEP 1 & 7: Request OTP to CURRENT payment authorization email
      const res = await fetch(`${API_BASE}/admin/payment-security/email/change/request-old-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // STEP 2: Use backend-generated expiresAt
        if (data.expiresAt) {
          setOtpExpiresAt(data.expiresAt);
        } else {
          setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
        }
        setOtpPurpose(data.purpose || 'CURRENT_EMAIL_CHANGE');
        setResendCooldown(30);
        if (data.currentEmail) {
          setCurrentEmail(data.currentEmail);
        }
        toast(data.msg || data.message || `A verification OTP has been sent to your current payment authorization email (${data.maskedEmail || maskEmail(emailFromBackend)})`, 'info');
      } else {
        const errorMsg = data.message || data.msg || 'Unable to send OTP. Please try again.';
        setError(errorMsg);
        setModalError(errorMsg);
      }
    } catch (err) {
      console.error('Request current email OTP error:', err);
      const errorMsg = 'Unable to send OTP email. Please try again.';
      setError(errorMsg);
      setModalError(errorMsg);
    } finally {
      setIsSendingOtp(false);
      setIsCurrentEmailLoading(false);
    }
  };

  // STEP 3: Verify Current Email OTP
  const handleVerifyCurrentEmailOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!currentEmailOtp || currentEmailOtp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP sent to your current email');
      setModalError('Please enter the 6-digit OTP sent to your current email');
      return;
    }
    if (remainingSeconds === 0 && otpExpiresAt) {
      const expiredMsg = 'OTP has expired. Please resend a new OTP.';
      setError(expiredMsg);
      setModalError(expiredMsg);
      return;
    }

    setIsVerifyingOtp(true);
    setError('');
    setModalError('');

    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/verify-current-email-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ otp: currentEmailOtp.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangeEmailStep(2);
        setOtpExpiresAt(null);
        setRemainingSeconds(0);
        setError('');
        setModalError('');
        toast('Current email verified successfully. Please enter the new email.', 'success');
      } else {
        const errorMsg = data.message || data.msg || 'Invalid OTP. Please check the code and try again.';
        setError(errorMsg);
        setModalError(errorMsg);
      }
    } catch (err) {
      console.error('Verify current email OTP error:', err);
      const errorMsg = 'Invalid OTP. Please check the code and try again.';
      setError(errorMsg);
      setModalError(errorMsg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // STEP 4: Request OTP for NEW email
  const handleRequestNewEmailOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const cleanEmail = (newEmail || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid new email address');
      setModalError('Please enter a valid new email address');
      return;
    }
    if (cleanEmail === (currentEmail || '').trim().toLowerCase()) {
      setError('The new email address cannot be the same as the current email');
      setModalError('The new email address cannot be the same as the current email');
      return;
    }

    setIsSendingOtp(true);
    setError('');
    setModalError('');

    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/email/change/request-new-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newEmail: cleanEmail })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangeEmailStep(3);
        if (data.expiresAt) {
          setOtpExpiresAt(data.expiresAt);
        } else {
          setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
        }
        setOtpPurpose(data.purpose || 'NEW_EMAIL_CHANGE');
        setResendCooldown(30);
        setError('');
        setModalError('');
        toast(data.msg || data.message || `A verification OTP has been sent to ${cleanEmail}`, 'success');
      } else {
        const errorMsg = data.message || data.msg || 'Unable to send OTP. Please try again.';
        setError(errorMsg);
        setModalError(errorMsg);
      }
    } catch (err) {
      console.error('Request new email OTP error:', err);
      const errorMsg = 'Unable to send OTP to new email address. Please try again.';
      setError(errorMsg);
      setModalError(errorMsg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // STEP 5: Verify NEW email OTP and save to database
  const handleVerifyNewEmailOtp = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newEmailOtp || newEmailOtp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP sent to your new email');
      setModalError('Please enter the 6-digit OTP sent to your new email');
      return;
    }
    if (remainingSeconds === 0 && otpExpiresAt) {
      const expiredMsg = 'OTP has expired. Please resend a new OTP.';
      setError(expiredMsg);
      setModalError(expiredMsg);
      return;
    }

    setIsVerifyingOtp(true);
    setError('');
    setModalError('');

    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/verify-new-email-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp: newEmailOtp.trim(),
          newEmail: (newEmail || '').trim().toLowerCase()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModalSuccess('Payment authorization email updated successfully.');
        toast('Payment authorization email replaced and verified successfully.', 'success');
        await fetchSettings(true);
        setTimeout(() => closeModal(), 1800);
      } else {
        const errorMsg = data.message || data.msg || 'Invalid OTP. Please check the code and try again.';
        setError(errorMsg);
        setModalError(errorMsg);
      }
    } catch (err) {
      console.error('Verify new email OTP error:', err);
      const errorMsg = 'Invalid OTP. Please check the code and try again.';
      setError(errorMsg);
      setModalError(errorMsg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // STEP 8: Resend OTP with cooldown
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setError('');
    setModalError('');

    if (changeEmailStep === 1) {
      // Resend current email OTP
      setIsSendingOtp(true);
      try {
        const res = await fetch(`${API_BASE}/admin/payment-security/email/change/request-old-otp`, {
          method: 'POST',
          headers: {
            'x-auth-token': token,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.expiresAt) {
            setOtpExpiresAt(data.expiresAt);
          } else {
            setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
          }
          setResendCooldown(30);
          setCurrentEmailOtp('');
          toast(data.msg || data.message || 'A new verification OTP has been sent to your current payment authorization email.', 'info');
        } else {
          const errorMsg = data.message || data.msg || 'Unable to resend OTP. Please try again.';
          setError(errorMsg);
          setModalError(errorMsg);
        }
      } catch (err) {
        console.error('Resend old email OTP error:', err);
        setError('Unable to resend OTP. Please try again.');
        setModalError('Unable to resend OTP. Please try again.');
      } finally {
        setIsSendingOtp(false);
      }
    } else if (changeEmailStep === 3) {
      // Resend new email OTP
      setIsSendingOtp(true);
      try {
        const res = await fetch(`${API_BASE}/admin/payment-security/email/change/request-new-otp`, {
          method: 'POST',
          headers: {
            'x-auth-token': token,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ newEmail: (newEmail || '').trim().toLowerCase() })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          if (data.expiresAt) {
            setOtpExpiresAt(data.expiresAt);
          } else {
            setOtpExpiresAt(new Date(Date.now() + 5 * 60 * 1000).toISOString());
          }
          setResendCooldown(30);
          setNewEmailOtp('');
          toast(data.msg || data.message || `A new verification OTP has been sent to ${newEmail}`, 'info');
        } else {
          const errorMsg = data.message || data.msg || 'Unable to resend OTP. Please try again.';
          setError(errorMsg);
          setModalError(errorMsg);
        }
      } catch (err) {
        console.error('Resend new email OTP error:', err);
        setError('Unable to resend OTP. Please try again.');
        setModalError('Unable to resend OTP. Please try again.');
      } finally {
        setIsSendingOtp(false);
      }
    }
  };

  // =========================================================================
  // FLOW 3: FIRST-TIME TRANSACTION PIN SETUP
  // =========================================================================
  const handleStartSetupPin = async () => {
    if (!settings.emailVerified) {
      toast('Please configure and verify your Payment Authorization Email first.', 'warning');
      return;
    }
    closeModal();
    setModalType('SETUP_PIN');
    setSetupPinStep(1);
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/pin/setup/request-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinOtpTimer(300);
        toast(`A verification OTP has been sent to ${data.maskedEmail || settings.maskedEmail}`, 'info');
      } else {
        setModalError(data.msg || data.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Request PIN setup OTP error:', err);
      setModalError('Unable to send OTP. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifySetupPinAndSave = async (e) => {
    e.preventDefault();
    if (!setupPinOtp || setupPinOtp.trim().length !== 6) {
      setModalError('Please enter the 6-digit OTP code');
      return;
    }
    if (!pinValue || pinValue.length < 4 || pinValue.length > 6 || !/^\d+$/.test(pinValue)) {
      setModalError('Transaction PIN must be 4 to 6 numeric digits');
      return;
    }
    if (pinValue !== pinConfirm) {
      setModalError('Confirm PIN does not match Enter PIN');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/pin/setup/verify-and-save`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp: setupPinOtp.trim(),
          pin: pinValue,
          confirmPin: pinConfirm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('Transaction PIN created successfully.', 'success');
        setModalSuccess('Transaction PIN created successfully.');
        await fetchSettings(true);
        setTimeout(() => closeModal(), 1800);
      } else {
        setModalError(data.msg || data.message || 'Invalid OTP. Please check your email and try again.');
      }
    } catch (err) {
      console.error('Save Transaction PIN error:', err);
      setModalError('Failed to save Transaction PIN. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  // =========================================================================
  // FLOW 4: CHANGE TRANSACTION PIN
  // =========================================================================
  const handleStartChangePin = async () => {
    if (!settings.emailVerified) {
      toast('Payment authorization email must be verified first.', 'warning');
      return;
    }
    closeModal();
    setModalType('CHANGE_PIN');
    setChangePinStep(1);
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/pin/change/request-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChangePinOtpTimer(300);
        toast(`A verification OTP has been sent to ${data.maskedEmail || settings.maskedEmail}`, 'info');
      } else {
        setModalError(data.msg || data.message || 'Unable to send OTP. Please try again.');
      }
    } catch (err) {
      console.error('Request PIN change OTP error:', err);
      setModalError('Unable to send OTP. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleVerifyChangePinAndSave = async (e) => {
    e.preventDefault();
    if (!changePinOtp || changePinOtp.trim().length !== 6) {
      setModalError('Please enter the 6-digit OTP code');
      return;
    }
    if (!newPinValue || newPinValue.length < 4 || newPinValue.length > 6 || !/^\d+$/.test(newPinValue)) {
      setModalError('New Transaction PIN must be 4 to 6 numeric digits');
      return;
    }
    if (newPinValue !== newPinConfirm) {
      setModalError('Confirm New PIN does not match');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/pin/change/verify-and-save`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp: changePinOtp.trim(),
          pin: newPinValue,
          confirmPin: newPinConfirm
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('Transaction PIN changed successfully.', 'success');
        setModalSuccess('Transaction PIN changed successfully.');
        await fetchSettings(true);
        setTimeout(() => closeModal(), 1800);
      } else {
        setModalError(data.msg || data.message || 'Invalid OTP. Please check your email and try again.');
      }
    } catch (err) {
      console.error('Change PIN error:', err);
      setModalError('Failed to change Transaction PIN. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  // =========================================================================
  // FLOW 5: SECURITY AUDIT TRAIL LOGS
  // =========================================================================
  const handleOpenAuditLogs = async () => {
    closeModal();
    setModalType('AUDIT_LOGS');
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/payment-security/audit-logs`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      toast('Failed to load security audit logs', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  // Format Helper
  const fmtTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Payment Security Settings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Mandatory two-factor authorization and hashed transaction PIN required for all financial disbursements.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSettings()}
            disabled={loading}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleOpenAuditLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </div>
      </div>

      {/* Grid: 3 Interactive Control Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* 1. Payment Authorization Email */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Authorization Email
              </span>
              {settings.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle className="w-3 h-3" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3 h-3" />
                  Not Configured
                </span>
              )}
            </div>

            <div className="pt-1">
              <label className="block text-xs text-slate-500 mb-1">Configured Disbursement Email</label>
              <div className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {settings.paymentAuthorizationEmail ? (
                  <span>{settings.paymentAuthorizationEmail}</span>
                ) : (
                  <span className="text-slate-400 italic">No email configured</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                The ONLY authorized email address for receiving OTP codes during payment execution.
              </p>
            </div>
          </div>

          <div className="pt-2">
            {settings.emailVerified ? (
              <button
                onClick={handleStartChangeEmail}
                className="w-full text-center text-xs font-semibold py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                Change Email
              </button>
            ) : (
              <button
                onClick={handleStartSetupEmail}
                className="w-full text-center text-xs font-bold py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer shadow-sm"
              >
                Verify & Set Email
              </button>
            )}
          </div>
        </div>

        {/* 2. Transaction PIN */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Transaction PIN
              </span>
              {settings.pinConfigured ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck className="w-3 h-3" />
                  Protected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-3 h-3" />
                  Action Required
                </span>
              )}
            </div>

            <div className="pt-1">
              <label className="block text-xs text-slate-500 mb-1">Security PIN Status</label>
              <div className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                {settings.pinConfigured ? (
                  <>
                    <span className="tracking-[0.25em] text-lg text-emerald-600 dark:text-emerald-400">●●●●●●</span>
                    <span className="text-[11px] font-normal text-slate-400">(Hashed)</span>
                  </>
                ) : (
                  <span className="text-slate-400 italic">Not configured</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {settings.isPinLocked ? (
                  <span className="text-red-500 font-bold">⚠️ PIN temporarily locked due to failed attempts</span>
                ) : (
                  'Encrypted server-side with bcrypt. Required as Step 3 for every payment.'
                )}
              </p>
            </div>
          </div>

          <div className="pt-2">
            {settings.pinConfigured ? (
              <button
                onClick={handleStartChangePin}
                className="w-full text-center text-xs font-semibold py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer"
              >
                Change Transaction PIN
              </button>
            ) : (
              <button
                onClick={handleStartSetupPin}
                disabled={!settings.emailVerified}
                className={`w-full text-center text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer shadow-sm ${
                  settings.emailVerified
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                Set Transaction PIN
              </button>
            )}
          </div>
        </div>

        {/* 3. Security Status */}
        <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Current Security Status
              </span>
            </div>

            <div className="pt-1 space-y-2">
              {settings.emailVerified && settings.pinConfigured ? (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-500 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">✓ Payment authorization enabled</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Both Email OTP and Transaction PIN are fully active and enforced on all disbursements.
                    </p>
                  </div>
                </div>
              ) : settings.emailVerified && !settings.pinConfigured ? (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">⚠️ PIN setup required</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Please set your Transaction PIN to complete two-factor disbursement authorization.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">⚠️ Security unconfigured</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Verify your Payment Authorization Email first to unlock secure disbursement workflows.
                    </p>
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-400 pt-1">
                <span>Database Source: </span>
                <strong className="text-slate-600 dark:text-slate-300">MongoDB (PaymentSecuritySettings)</strong>
              </div>
            </div>
          </div>

          <div className="pt-2 text-right">
            <span className="text-[10px] text-slate-400">
              {settings.updatedAt ? `Last verified: ${new Date(settings.updatedAt).toLocaleString('en-IN')}` : 'Never modified'}
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FIRST-TIME EMAIL SETUP */}
      {/* ========================================================================= */}
      {modalType === 'SETUP_EMAIL' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Configure Payment Authorization Email
                </h4>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {setupEmailStep === 1 && !modalSuccess && (
              <form onSubmit={handleRequestSetupEmailOtp} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the email address to be authorized for all payment disbursements. A single-use verification OTP will be sent to this email before saving.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Payment Authorization Email Address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="e.g. finance@connectapp.in"
                    value={setupEmail}
                    onChange={(e) => setSetupEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || !setupEmail}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verify Email (Send OTP)</span>
                  </button>
                </div>
              </form>
            )}

            {setupEmailStep === 2 && !modalSuccess && (
              <form onSubmit={handleVerifySetupEmailOtp} className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-slate-500">
                    A single-use 6-digit OTP code has been sent to:
                  </p>
                  <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                    {setupEmail}
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="Enter 6-digit OTP"
                    value={setupOtp}
                    onChange={(e) => setSetupOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
                    <span>Expires in: {fmtTime(setupOtpTimer)}</span>
                    {setupOtpTimer === 0 ? (
                      <button
                        type="button"
                        onClick={handleRequestSetupEmailOtp}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span>Single-use verification</span>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSetupEmailStep(1)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || setupOtp.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Save Email</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CHANGE PAYMENT AUTHORIZATION EMAIL (2-STEP VERIFICATION) */}
      {/* ========================================================================= */}
      {modalType === 'CHANGE_EMAIL' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Change Payment Authorization Email
                </h4>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Indicator */}
            <div className="flex items-center justify-between px-2 text-[11px] font-semibold text-slate-400">
              <span className={changeEmailStep >= 1 ? 'text-amber-500 font-bold' : ''}>1. Current Email OTP</span>
              <ChevronRight className="w-3 h-3" />
              <span className={changeEmailStep >= 2 ? 'text-amber-500 font-bold' : ''}>2. New Email</span>
              <ChevronRight className="w-3 h-3" />
              <span className={changeEmailStep >= 3 ? 'text-amber-500 font-bold' : ''}>3. Verify New</span>
            </div>

            {(error || modalError) && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error || modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {/* STEP 1: Verify OTP from current email */}
            {changeEmailStep === 1 && !modalSuccess && (
              isCurrentEmailLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-3 text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-amber-500" />
                  <span className="text-xs font-medium">Fetching payment authorization email...</span>
                </div>
              ) : (
                <form onSubmit={handleVerifyCurrentEmailOtp} className="space-y-4">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                    A verification OTP has been sent to your current payment authorization email:
                    <div className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                      {currentEmail ? maskEmail(currentEmail) : (settings.maskedEmail || maskEmail(settings.paymentAuthorizationEmail) || 'Configured Email')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Enter Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder="Enter 6-digit OTP"
                      value={currentEmailOtp}
                      onChange={(e) => setCurrentEmailOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
                      <span>Expires in: {fmtTime(remainingSeconds)}</span>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || isSendingOtp}
                        onClick={handleResendOtp}
                        className={`font-bold transition ${
                          resendCooldown > 0 || isSendingOtp
                            ? 'text-slate-400 cursor-not-allowed'
                            : 'text-amber-600 dark:text-amber-400 hover:underline cursor-pointer'
                        }`}
                      >
                        {isSendingOtp ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingOtp || isSendingOtp || currentEmailOtp.length !== 6 || (remainingSeconds === 0 && otpExpiresAt !== null)}
                      className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                      {isVerifyingOtp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>Verify Current Email</span>
                    </button>
                  </div>
                </form>
              )
            )}

            {/* STEP 2: Enter new email */}
            {changeEmailStep === 2 && !modalSuccess && (
              <form onSubmit={handleRequestNewEmailOtp} className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Current email verified. Now enter the new email address you want to set as the Payment Authorization Email.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Enter New Payment Authorization Email
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="new-email@gmail.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingOtp || !newEmail || !newEmail.includes('@')}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {isSendingOtp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Send Verification OTP</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Verify OTP from new email */}
            {changeEmailStep === 3 && !modalSuccess && (
              <form onSubmit={handleVerifyNewEmailOtp} className="space-y-4">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                  A verification OTP has been sent to:
                  <div className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                    {maskEmail(newEmail) || newEmail}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="Enter 6-digit OTP"
                    value={newEmailOtp}
                    onChange={(e) => setNewEmailOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
                    <span>Expires in: {fmtTime(remainingSeconds)}</span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || isSendingOtp}
                      onClick={handleResendOtp}
                      className={`font-bold transition ${
                        resendCooldown > 0 || isSendingOtp
                          ? 'text-slate-400 cursor-not-allowed'
                          : 'text-amber-600 dark:text-amber-400 hover:underline cursor-pointer'
                      }`}
                    >
                      {isSendingOtp ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setChangeEmailStep(2);
                      setOtpExpiresAt(null);
                      setRemainingSeconds(0);
                      setError('');
                      setModalError('');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isVerifyingOtp || isSendingOtp || newEmailOtp.length !== 6 || (remainingSeconds === 0 && otpExpiresAt !== null)}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {isVerifyingOtp && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Verify & Save Email</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FIRST-TIME TRANSACTION PIN SETUP */}
      {/* ========================================================================= */}
      {modalType === 'SETUP_PIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Set Transaction PIN
                </h4>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {!modalSuccess && (
              <form onSubmit={handleVerifySetupPinAndSave} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  A verification OTP was sent to authorized email:
                  <div className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                    {settings.maskedEmail || settings.paymentAuthorizationEmail}
                  </div>
                </div>

                {/* OTP Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Email Verification OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="Enter 6-digit OTP"
                    value={setupPinOtp}
                    onChange={(e) => setSetupPinOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>Expires in: {fmtTime(pinOtpTimer)}</span>
                    {pinOtpTimer === 0 && (
                      <button
                        type="button"
                        onClick={handleStartSetupPin}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                {/* Enter PIN */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Enter PIN (4 to 6 numeric digits)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showPin ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="••••••"
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Confirm PIN */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type={showPin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="••••••"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || setupPinOtp.length !== 6 || pinValue.length < 4 || pinValue !== pinConfirm}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Transaction PIN</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CHANGE TRANSACTION PIN */}
      {/* ========================================================================= */}
      {modalType === 'CHANGE_PIN' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Change Transaction PIN
                </h4>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            {!modalSuccess && (
              <form onSubmit={handleVerifyChangePinAndSave} className="space-y-4">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  Verification OTP dispatched to authorized email:
                  <div className="font-mono font-bold mt-1 text-slate-900 dark:text-white">
                    {settings.maskedEmail || settings.paymentAuthorizationEmail}
                  </div>
                </div>

                {/* Enter OTP */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Enter OTP
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    placeholder="Enter 6-digit OTP"
                    value={changePinOtp}
                    onChange={(e) => setChangePinOtp(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
                    <span>Expires in: {fmtTime(changePinOtpTimer)}</span>
                    {changePinOtpTimer === 0 && (
                      <button
                        type="button"
                        onClick={handleStartChangePin}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline"
                      >
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>

                {/* Enter New PIN */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Enter New PIN (4 to 6 digits)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowChangePin(!showChangePin)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
                    >
                      {showChangePin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showChangePin ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <input
                    type={showChangePin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="••••••"
                    value={newPinValue}
                    onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Confirm New PIN */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Confirm New PIN
                  </label>
                  <input
                    type={showChangePin ? 'text' : 'password'}
                    maxLength={6}
                    placeholder="••••••"
                    value={newPinConfirm}
                    onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-lg tracking-[0.3em] font-mono font-bold py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalLoading || changePinOtp.length !== 6 || newPinValue.length < 4 || newPinValue !== newPinConfirm}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition cursor-pointer disabled:opacity-50"
                  >
                    {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Change PIN</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: AUDIT LOGS MODAL */}
      {/* ========================================================================= */}
      {modalType === 'AUDIT_LOGS' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Payment Security Audit Trail
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Immutable event ledger of email configurations, PIN changes, and authorization attempts.
                  </p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500" />
                  <p className="text-xs">Loading audit ledger...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-xs">No audit events recorded yet.</p>
                </div>
              ) : (
                auditLogs.map((log, index) => {
                  const isSuccess = (log.status || '').toLowerCase() === 'success';
                  return (
                    <div
                      key={log._id || index}
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isSuccess
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                          }`}>
                            {log.action}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {log.actorName || 'Admin'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                          {log.details || log.description || 'Security operation recorded'}
                        </p>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 flex-shrink-0">
                        <div>{new Date(log.createdAt || log.timestamp).toLocaleDateString('en-IN')}</div>
                        <div>{new Date(log.createdAt || log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-right flex-shrink-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaymentSecuritySettingsModule;
