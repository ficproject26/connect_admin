import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Shield, RefreshCw, X, CheckCircle, AlertCircle, Mail } from 'lucide-react';

/**
 * Production-Ready Reusable OTP Verification Modal Component
 * Matches Section 9 exact UI layout and behavior requirements:
 * - 6 separate numeric OTP boxes
 * - Auto-advance on input, backspace move-back, 6-digit paste support
 * - Dynamic countdown timer
 * - Resend button with cooldown rate-limiting
 * - No localStorage / sessionStorage
 */
export const OtpVerificationModal = ({
  isOpen,
  onClose,
  email,
  maskedEmail,
  title = 'Verify Your Email',
  subtitle,
  onVerify,
  onResend,
  loading = false,
  error = '',
  success = '',
  initialExpiresIn = 300, // 5 minutes in seconds
  actionLabel = 'Verify OTP'
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(initialExpiresIn);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setOtp(['', '', '', '', '', '']);
      setTimer(initialExpiresIn);
      setCanResend(false);
      setTimeout(() => {
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }, 100);
    }
  }, [isOpen, initialExpiresIn]);

  // Countdown timer effect
  useEffect(() => {
    let interval = null;
    if (isOpen && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [isOpen, timer]);

  // Format MM:SS
  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Safe Mask Email if not provided
  const displayEmail = maskedEmail || (() => {
    if (!email || typeof email !== 'string') return '';
    const clean = email.trim();
    const parts = clean.split('@');
    if (parts.length !== 2) return clean;
    const [u, d] = parts;
    const first = u.slice(0, 1);
    return `${first}******@${d}`;
  })();

  // Handle Digit Change
  const handleChange = (index, value) => {
    // Keep only numeric characters
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      const copy = [...otp];
      copy[index] = '';
      setOtp(copy);
      return;
    }

    const copy = [...otp];
    copy[index] = clean.slice(-1); // Only last entered digit
    setOtp(copy);

    // Auto-advance to next input field
    if (index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle Key Down (Backspace Navigation)
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0 && inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1].focus();
    } else if (e.key === 'ArrowRight' && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1].focus();
    }
  };

  // Handle Paste 6 Digits
  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const copy = [...otp];
    for (let i = 0; i < 6; i++) {
      copy[i] = pasteData[i] || '';
    }
    setOtp(copy);

    // Focus last filled or next field
    const focusIndex = Math.min(pasteData.length, 5);
    if (inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex].focus();
    }
  };

  // Submit Handler
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length !== 6 || loading) return;
    if (onVerify) {
      onVerify(otpCode);
    }
  };

  // Resend Handler
  const handleResendClick = async () => {
    if (!canResend || resending || !onResend) return;
    setResending(true);
    try {
      await onResend();
      setTimer(initialExpiresIn);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      if (inputRefs.current[0]) inputRefs.current[0].focus();
    } finally {
      setResending(false);
    }
  };

  if (!isOpen) return null;

  const isComplete = otp.join('').length === 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center relative">
        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Icon & Title */}
        <div className="space-y-2 pt-2">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <Mail className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {title}
          </h3>
          <div className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {subtitle ? (
              <p>{subtitle}</p>
            ) : (
              <>
                <p>A verification OTP has been sent to</p>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm mt-0.5">
                  {displayEmail || 'your authorized email'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* OTP Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Enter OTP
            </label>

            {/* 6 Separate Digit Boxes */}
            <div className="flex justify-center gap-2 sm:gap-3 onpaste" onPaste={handlePaste}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={otp[index]}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={loading}
                  className="w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl font-bold font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all disabled:opacity-50"
                />
              ))}
            </div>

            {/* Timer countdown */}
            <div className="text-xs text-slate-400 pt-1">
              {timer > 0 ? (
                <span>OTP expires in <strong className="font-mono text-slate-700 dark:text-slate-300">{formatTimer(timer)}</strong></span>
              ) : (
                <span className="text-rose-500 font-semibold">OTP has expired. Please request a new OTP.</span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isComplete || loading || timer === 0}
              className="w-full py-3 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span>{actionLabel}</span>
            </button>
          </div>
        </form>

        {/* Resend Section */}
        <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80">
          <p className="mb-1">Didn't receive the OTP?</p>
          <button
            type="button"
            onClick={handleResendClick}
            disabled={!canResend || resending || loading}
            className={`font-bold transition cursor-pointer ${
              canResend && !resending
                ? 'text-amber-600 dark:text-amber-400 hover:underline'
                : 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            {resending ? 'Sending...' : 'Resend OTP'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationModal;
