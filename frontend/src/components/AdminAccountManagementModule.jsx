import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Key, Lock, Eye, EyeOff, CheckCircle, AlertTriangle,
  RefreshCw, Check, X, User, AlertCircle, ShieldCheck, UserCheck
} from 'lucide-react';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const AdminAccountManagementModule = ({ token, API_BASE, currentUser, onToast }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [callerUser, setCallerUser] = useState(null);

  // Per-slot form states
  const [formState, setFormState] = useState({
    1: {
      email: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      showOld: false,
      showNew: false,
      showConfirm: false,
      submitting: false,
      statusMsg: null // { type: 'success' | 'error', text: '' }
    },
    2: {
      email: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      showOld: false,
      showNew: false,
      showConfirm: false,
      submitting: false,
      statusMsg: null
    },
    3: {
      email: '',
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      showOld: false,
      showNew: false,
      showConfirm: false,
      submitting: false,
      statusMsg: null
    }
  });

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  // Resolve resilient endpoint candidate URLs
  const resolveAccountEndpoints = useCallback((subpath) => {
    const cleanPath = subpath.startsWith('/') ? subpath : `/${subpath}`;
    const cleanApiBase = (API_BASE || '').replace(/\/+$/, '');
    const origin = cleanApiBase.replace(/\/admin-api\/?$/, '').replace(/\/api\/?$/, '');
    const list = [
      `${cleanApiBase}${cleanPath}`.replace(/\/admin-api\/admin-api/, '/admin-api'),
      `${origin}/admin-api${cleanPath}`,
      `${origin}${cleanPath}`
    ];
    return [...new Set(list.filter(Boolean))];
  }, [API_BASE]);

  // Fetch all 3 Super Admin accounts from backend
  const fetchAccounts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const endpoints = resolveAccountEndpoints('/admin/accounts/credentials');
      let res = null;
      let data = null;

      for (const endpoint of endpoints) {
        try {
          const attemptRes = await fetch(endpoint, {
            headers: {
              'x-auth-token': token,
              'Authorization': `Bearer ${token}`
            }
          });
          if (attemptRes.status !== 404) {
            res = attemptRes;
            data = await attemptRes.json().catch(() => null);
            break;
          }
        } catch (e) {
          // Fall through to next candidate endpoint
        }
      }

      if (res && res.ok && data?.success && Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
        setCallerUser(data.currentUser || null);

        // Pre-fill email values in formState from DB records
        setFormState(prev => {
          const next = { ...prev };
          data.accounts.forEach(acc => {
            const slot = acc.slot;
            if (next[slot]) {
              next[slot] = {
                ...next[slot],
                email: acc.email || next[slot].email || ''
              };
            }
          });
          return next;
        });
      } else {
        const errorMsg = data?.message || data?.msg || 'Network/server error.';
        if (!isSilent) toast(errorMsg, 'error');
      }
    } catch (err) {
      console.error('Fetch admin accounts error:', err);
      if (!isSilent) toast('Network/server error.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveAccountEndpoints, token, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Field change handler for a given slot
  const handleFieldChange = (slot, field, value) => {
    setFormState(prev => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [field]: value,
        statusMsg: null // Clear previous message on edit
      }
    }));
  };

  const toggleShowPassword = (slot, field) => {
    setFormState(prev => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        [field]: !prev[slot][field]
      }
    }));
  };

  // Password Strength Evaluation for inline meter and checklist
  const evaluatePasswordStrength = (pwd) => {
    if (!pwd || typeof pwd !== 'string') {
      return {
        score: 0,
        label: 'Very Weak',
        color: 'bg-rose-500',
        textColor: 'text-rose-400',
        rules: {
          minLen: false,
          upper: false,
          lower: false,
          num: false,
          special: false
        }
      };
    }

    const rules = {
      minLen: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd),
      lower: /[a-z]/.test(pwd),
      num: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9\s]/.test(pwd)
    };

    const count = Object.values(rules).filter(Boolean).length;
    let label = 'Weak';
    let color = 'bg-rose-500';
    let textColor = 'text-rose-400';

    if (count <= 2) {
      label = 'Weak';
      color = 'bg-rose-500';
      textColor = 'text-rose-400';
    } else if (count === 3 || count === 4) {
      label = 'Moderate';
      color = 'bg-amber-500';
      textColor = 'text-amber-400';
    } else if (count === 5) {
      label = 'Strong';
      color = 'bg-emerald-500';
      textColor = 'text-emerald-400';
    }

    return { score: (count / 5) * 100, label, color, textColor, rules };
  };

  // Submit Password / Credential Update for a slot
  const handleUpdatePassword = async (e, slot) => {
    e.preventDefault();
    const currentSlotForm = formState[slot];
    if (!currentSlotForm || currentSlotForm.submitting) return;

    // 1. Email validation
    const rawEmail = (currentSlotForm.email || '').trim();
    if (!rawEmail || !EMAIL_REGEX.test(rawEmail) || rawEmail.includes(' ')) {
      setFormState(prev => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          statusMsg: { type: 'error', text: 'Invalid email format.' }
        }
      }));
      return;
    }

    // 2. Old password check
    if (!currentSlotForm.oldPassword) {
      setFormState(prev => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          statusMsg: { type: 'error', text: 'Incorrect old password.' }
        }
      }));
      return;
    }

    // 3. New password security requirements
    const strength = evaluatePasswordStrength(currentSlotForm.newPassword);
    if (!strength.rules.minLen || !strength.rules.upper || !strength.rules.lower || !strength.rules.num || !strength.rules.special) {
      setFormState(prev => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          statusMsg: { type: 'error', text: 'New password does not meet the security requirements.' }
        }
      }));
      return;
    }

    // 4. Confirm password match
    if (currentSlotForm.newPassword !== currentSlotForm.confirmPassword) {
      setFormState(prev => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          statusMsg: { type: 'error', text: 'Confirmation password does not match.' }
        }
      }));
      return;
    }

    // Set submitting loading state
    setFormState(prev => ({
      ...prev,
      [slot]: {
        ...prev[slot],
        submitting: true,
        statusMsg: null
      }
    }));

    try {
      const endpoints = resolveAccountEndpoints('/admin/accounts/update-credentials');
      let res = null;
      let data = null;

      const payload = JSON.stringify({
        slot,
        email: rawEmail.toLowerCase(),
        oldPassword: currentSlotForm.oldPassword,
        newPassword: currentSlotForm.newPassword,
        confirmPassword: currentSlotForm.confirmPassword
      });

      for (const endpoint of endpoints) {
        try {
          const attemptRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'x-auth-token': token,
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: payload
          });
          if (attemptRes.status !== 404) {
            res = attemptRes;
            data = await attemptRes.json().catch(() => null);
            break;
          }
        } catch (e) {
          // Fall through to next candidate endpoint
        }
      }

      if (res.ok && data?.success) {
        setFormState(prev => ({
          ...prev,
          [slot]: {
            ...prev[slot],
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
            submitting: false,
            statusMsg: { type: 'success', text: 'Password updated successfully.' }
          }
        }));
        toast('Password updated successfully.', 'success');
        // Refresh account list silently
        fetchAccounts(true);
      } else {
        const errorText = data?.message || data?.msg || 'Network/server error.';
        setFormState(prev => ({
          ...prev,
          [slot]: {
            ...prev[slot],
            submitting: false,
            statusMsg: { type: 'error', text: errorText }
          }
        }));
        toast(errorText, 'error');
      }
    } catch (err) {
      console.error('Update credentials request error:', err);
      setFormState(prev => ({
        ...prev,
        [slot]: {
          ...prev[slot],
          submitting: false,
          statusMsg: { type: 'error', text: 'Network/server error.' }
        }
      }));
      toast('Network/server error.', 'error');
    }
  };

  // Determine if the current authenticated user has permission to edit this slot
  const canEditSlot = (slot) => {
    if (!callerUser) return true;
    if (callerUser.isPrimarySuperAdmin || callerUser.slot === 1) return true;
    return callerUser.slot === slot;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Admin Account Management
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure and secure the three primary and additional Super Admin credential accounts with strict role isolation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAccounts(false)}
            disabled={loading || refreshing}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Refresh admin accounts"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid of 3 Separate Super Admin Account Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(slotNum => {
          const acc = accounts.find(a => a.slot === slotNum) || {
            slot: slotNum,
            slotTitle: slotNum === 1 ? 'User 1 — Main Admin / Primary Super Admin' : `User ${slotNum} — Additional Super Admin`,
            displayName: slotNum === 1 ? 'Main Admin' : (slotNum === 2 ? 'Super Admin' : 'Additional Super Admin 2'),
            role: slotNum === 1 ? 'Primary Super Admin' : 'Additional Super Admin',
            email: '',
            status: 'Unconfigured',
            isPrimary: slotNum === 1,
            isConfigured: false,
            isCurrentAccount: false
          };

          const slotForm = formState[slotNum];
          const hasEditPermission = canEditSlot(slotNum);
          const strength = evaluatePasswordStrength(slotForm.newPassword);
          const passwordsMatch = slotForm.confirmPassword && slotForm.newPassword === slotForm.confirmPassword;
          const passwordsMismatch = slotForm.confirmPassword && slotForm.newPassword !== slotForm.confirmPassword;

          return (
            <div
              key={`admin-slot-${slotNum}`}
              className={`p-5 rounded-2xl border flex flex-col justify-between transition-all ${
                acc.isCurrentAccount
                  ? 'border-amber-500/50 bg-slate-50/80 dark:bg-slate-950/70 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/20'
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Card Header & Status Badges */}
              <div className="space-y-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {acc.slotTitle}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {acc.displayName} • <span className="font-medium text-amber-600 dark:text-amber-400">{acc.role}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {acc.isConfigured && acc.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="w-3 h-3" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                        <AlertTriangle className="w-3 h-3" />
                        Unconfigured
                      </span>
                    )}

                    {acc.isCurrentAccount && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                        Current Account
                      </span>
                    )}
                  </div>
                </div>

                {!hasEditPermission && (
                  <div className="bg-slate-100 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Managed only by Primary Super Admin</span>
                  </div>
                )}
              </div>

              {/* Form Content */}
              <form onSubmit={(e) => handleUpdatePassword(e, slotNum)} className="pt-4 space-y-4">
                {/* 1. Username / Email Address */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Username / Email Address
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!hasEditPermission || slotForm.submitting}
                    value={slotForm.email}
                    onChange={(e) => handleFieldChange(slotNum, 'email', e.target.value)}
                    placeholder={`admin${slotNum}@connect.com`}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {slotForm.email && !EMAIL_REGEX.test(slotForm.email.trim()) && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Invalid email format.
                    </p>
                  )}
                </div>

                {/* 2. Old Password */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {callerUser?.isPrimarySuperAdmin && !acc.isCurrentAccount
                      ? 'Admin Authorization Password'
                      : 'Old Password'}
                  </label>
                  <div className="relative">
                    <input
                      type={slotForm.showOld ? 'text' : 'password'}
                      required
                      disabled={!hasEditPermission || slotForm.submitting}
                      value={slotForm.oldPassword}
                      onChange={(e) => handleFieldChange(slotNum, 'oldPassword', e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-10 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!hasEditPermission || slotForm.submitting}
                      onClick={() => toggleShowPassword(slotNum, 'showOld')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-40"
                    >
                      {slotForm.showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* 3. New Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      New Password
                    </label>
                    {slotForm.newPassword && (
                      <span className={`text-[11px] font-bold ${strength.textColor}`}>
                        {strength.label}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={slotForm.showNew ? 'text' : 'password'}
                      required
                      disabled={!hasEditPermission || slotForm.submitting}
                      value={slotForm.newPassword}
                      onChange={(e) => handleFieldChange(slotNum, 'newPassword', e.target.value)}
                      placeholder="Enter strong new password"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-10 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!hasEditPermission || slotForm.submitting}
                      onClick={() => toggleShowPassword(slotNum, 'showNew')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-40"
                    >
                      {slotForm.showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Progress Bar */}
                  {slotForm.newPassword && (
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      />
                    </div>
                  )}

                  {/* Live Requirement Checklist */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className={`flex items-center gap-1.5 text-[11px] ${strength.rules.minLen ? 'text-emerald-500 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {strength.rules.minLen ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />}
                      <span>8+ characters</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${strength.rules.upper ? 'text-emerald-500 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {strength.rules.upper ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />}
                      <span>Uppercase (A-Z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${strength.rules.lower ? 'text-emerald-500 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {strength.rules.lower ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />}
                      <span>Lowercase (a-z)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] ${strength.rules.num ? 'text-emerald-500 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {strength.rules.num ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />}
                      <span>Number (0-9)</span>
                    </div>
                    <div className={`flex items-center gap-1.5 text-[11px] col-span-1 sm:col-span-2 ${strength.rules.special ? 'text-emerald-500 dark:text-emerald-400 font-semibold' : 'text-slate-400'}`}>
                      {strength.rules.special ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mx-0.5" />}
                      <span>Special character (!@#$%^&*)</span>
                    </div>
                  </div>
                </div>

                {/* 4. Confirm New Password */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={slotForm.showConfirm ? 'text' : 'password'}
                      required
                      disabled={!hasEditPermission || slotForm.submitting}
                      value={slotForm.confirmPassword}
                      onChange={(e) => handleFieldChange(slotNum, 'confirmPassword', e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 pr-10 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      disabled={!hasEditPermission || slotForm.submitting}
                      onClick={() => toggleShowPassword(slotNum, 'showConfirm')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer disabled:opacity-40"
                    >
                      {slotForm.showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {passwordsMatch && (
                    <p className="text-[11px] text-emerald-500 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                      <Check className="w-3 h-3" /> Passwords match
                    </p>
                  )}
                  {passwordsMismatch && (
                    <p className="text-[11px] text-rose-500 dark:text-rose-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Confirmation password does not match.
                    </p>
                  )}
                </div>

                {/* 5. Status / Error Notification Box */}
                {slotForm.statusMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      slotForm.statusMsg.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {slotForm.statusMsg.type === 'success' ? (
                      <CheckCircle className="w-4 h-4 shrink-0 text-emerald-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    )}
                    <span className="font-semibold">{slotForm.statusMsg.text}</span>
                  </div>
                )}

                {/* 6. Update Password Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!hasEditPermission || slotForm.submitting}
                    className="w-full text-center text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {slotForm.submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{slotForm.submitting ? 'Updating Password...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default AdminAccountManagementModule;
