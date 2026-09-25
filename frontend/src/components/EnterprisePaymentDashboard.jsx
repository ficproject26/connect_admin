import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Shield, Download,
  Filter, Calendar, RefreshCw, BarChart2, PieChart as PieIcon, Layers, FileText,
  Plus, Minus, CheckCircle, Clock, AlertTriangle, XCircle, Search, ChevronRight,
  Eye, Lock, Key, ArrowRight, Check, X, Printer, MapPin, Building, User, Users,
  Send, AlertCircle, FileCheck, ArrowUpRight, ArrowDownRight, Share2, HelpCircle
} from 'lucide-react';

export const EnterprisePaymentDashboard = React.memo(({ token, API_BASE, currentUser, onToast }) => {
  // Main Data States
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState({
    totalReceived: 0,
    totalPaid: 0,
    pendingPayments: 0,
    pendingAmount: 0,
    failedPayments: 0,
    failedAmount: 0,
    cancelledPayments: 0,
    cancelledAmount: 0,
    netCashFlow: 0
  });

  const [receivedCategories, setReceivedCategories] = useState([]);
  const [paidCategories, setPaidCategories] = useState([]);

  // Territory hierarchy data
  const [territoryStates, setTerritoryStates] = useState([]);
  const [territoryDistricts, setTerritoryDistricts] = useState([]);
  const [territoryDivisions, setTerritoryDivisions] = useState([]);
  const [territoryPincodes, setTerritoryPincodes] = useState([]);

  // Active Category & Transaction List Modal
  const [activeCategoryModal, setActiveCategoryModal] = useState(null); // null or category object
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnTotalCount, setTxnTotalCount] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [txnLimit] = useState(15);
  const [txnTotalPages, setTxnTotalPages] = useState(1);

  // Filters for Transactions
  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterState, setFilterState] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterDivision, setFilterDivision] = useState('all');
  const [filterPincode, setFilterPincode] = useState('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSort, setFilterSort] = useState('date_desc');

  // Single Payment Detail View Modal
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pay All Preview Modal
  const [payAllPreviewData, setPayAllPreviewData] = useState(null);
  const [payAllLoading, setPayAllLoading] = useState(false);

  // Payment Verification Flow States (Single & Bulk)
  // Step 1: Email OTP -> Step 2: 6-Digit PIN -> Step 3: Final Confirmation
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityStep, setSecurityStep] = useState(1); // 1: Email OTP, 2: 6-Digit PIN, 3: Confirmation
  const [activePaymentAction, setActivePaymentAction] = useState(null); // { type: 'single' | 'bulk', paymentId?, category?, recipientName?, amount? }
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || '');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(300);
  const [verificationToken, setVerificationToken] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [pinConfigured, setPinConfigured] = useState(true);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [processingSuccess, setProcessingSuccess] = useState(null);

  // Cancel Payment Modal
  const [cancelModalPayment, setCancelModalPayment] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Delegation Modal
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [delegationState, setDelegationState] = useState('');
  const [delegationCategory, setDelegationCategory] = useState('agent_payment');
  const [stateAdminsList, setStateAdminsList] = useState([]);
  const [selectedStateAdminId, setSelectedStateAdminId] = useState('');
  const [delegationNotes, setDelegationNotes] = useState('');
  const [delegationLoading, setDelegationLoading] = useState(false);

  // Receipt Modal
  const [receiptData, setReceiptData] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // Audit Log Modal
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  // Fetch Dashboard Summary & Categories
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/dashboard`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.kpis) setKpi(data.kpis);
        if (data.receivedCategories) setReceivedCategories(data.receivedCategories);
        if (data.paidCategories) setPaidCategories(data.paidCategories);
      }
    } catch (err) {
      console.error('Fetch dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token]);

  // Fetch Active Territories from Database (Section 14)
  const fetchTerritories = useCallback(async () => {
    try {
      const [resStates, resDistricts, resDivisions, resPincodes] = await Promise.all([
        fetch(`${API_BASE}/admin/territory/states?status=Active`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE}/admin/territory/districts?status=Active`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE}/admin/territory/divisions?status=Active`, { headers: { 'x-auth-token': token } }),
        fetch(`${API_BASE}/admin/territory/pincodes?status=Active`, { headers: { 'x-auth-token': token } })
      ]);

      if (resStates.ok) {
        const data = await resStates.json();
        setTerritoryStates(Array.isArray(data) ? data : (data.states || []));
      }
      if (resDistricts.ok) {
        const data = await resDistricts.json();
        setTerritoryDistricts(Array.isArray(data) ? data : (data.districts || []));
      }
      if (resDivisions.ok) {
        const data = await resDivisions.json();
        setTerritoryDivisions(Array.isArray(data) ? data : (data.divisions || []));
      }
      if (resPincodes.ok) {
        const data = await resPincodes.json();
        setTerritoryPincodes(Array.isArray(data) ? data : (data.pincodes || []));
      }
    } catch (err) {
      console.error('Territory load error:', err);
    }
  }, [API_BASE, token]);

  // Check PIN Status
  const checkPinStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/pin-status`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPinConfigured(Boolean(data.configured));
      }
    } catch (e) {
      console.error('Check PIN status error:', e);
    }
  }, [API_BASE, token]);

  // Initial Load
  useEffect(() => {
    fetchDashboardData();
    fetchTerritories();
    checkPinStatus();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !activeCategoryModal && !securityModalOpen) {
        fetchDashboardData();
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchDashboardData, fetchTerritories, checkPinStatus, activeCategoryModal, securityModalOpen]);

  // Dynamic Territory Cascade Filtering
  const availableDistricts = useMemo(() => {
    if (!filterState || filterState === 'all') return territoryDistricts;
    return territoryDistricts.filter(d => (d.stateName || d.state || '').toLowerCase() === filterState.toLowerCase());
  }, [filterState, territoryDistricts]);

  const availableDivisions = useMemo(() => {
    if (!filterDistrict || filterDistrict === 'all') return territoryDivisions;
    return territoryDivisions.filter(div => (div.districtName || div.district || '').toLowerCase() === filterDistrict.toLowerCase());
  }, [filterDistrict, territoryDivisions]);

  const availablePincodes = useMemo(() => {
    if (!filterDivision || filterDivision === 'all') return territoryPincodes;
    return territoryPincodes.filter(p => (p.divisionName || p.division || '').toLowerCase() === filterDivision.toLowerCase());
  }, [filterDivision, territoryPincodes]);

  // Fetch Transactions List for Modal
  const fetchTransactions = useCallback(async () => {
    if (!activeCategoryModal) return;
    setTxnLoading(true);
    try {
      const params = new URLSearchParams({
        category: activeCategoryModal.key,
        type: activeCategoryModal.type,
        page: txnPage,
        limit: txnLimit,
        sort: filterSort
      });

      if (filterSearch) params.append('search', filterSearch);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterState && filterState !== 'all') params.append('state', filterState);
      if (filterDistrict && filterDistrict !== 'all') params.append('district', filterDistrict);
      if (filterDivision && filterDivision !== 'all') params.append('division', filterDivision);
      if (filterPincode && filterPincode !== 'all') params.append('pincode', filterPincode);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`${API_BASE}/admin/enterprise/payments/transactions?${params.toString()}`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setTxnTotalCount(data.totalCount || 0);
        setTxnTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch transactions error:', err);
    } finally {
      setTxnLoading(false);
    }
  }, [activeCategoryModal, txnPage, txnLimit, filterSort, filterSearch, filterStatus, filterState, filterDistrict, filterDivision, filterPincode, filterStartDate, filterEndDate, API_BASE, token]);

  useEffect(() => {
    if (activeCategoryModal) {
      fetchTransactions();
    }
  }, [activeCategoryModal, fetchTransactions]);

  // Open Detailed Transaction List Modal
  const handleOpenCategory = (cat) => {
    setActiveCategoryModal(cat);
    setTxnPage(1);
    setFilterSearch('');
    setFilterStatus('ALL');
    setFilterState('all');
    setFilterDistrict('all');
    setFilterDivision('all');
    setFilterPincode('all');
  };

  // Open Single Payment Detail View
  const handleViewPaymentDetail = async (paymentId) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/detail/${paymentId}`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedPaymentDetail(data.payment);
      }
    } catch (err) {
      console.error('Fetch payment detail error:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open Pay All Preview Screen
  const handleOpenPayAll = async (cat) => {
    setPayAllLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/pay-all-preview?category=${cat.key}`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayAllPreviewData(data);
      }
    } catch (err) {
      console.error('Fetch pay all preview error:', err);
    } finally {
      setPayAllLoading(false);
    }
  };

  // Proceed to Verification from Pay All or Single Pay
  const startSecurityVerification = (actionPayload) => {
    setActivePaymentAction(actionPayload);
    setSecurityStep(1);
    setOtpSent(false);
    setOtpInput('');
    setVerificationToken('');
    setPinDigits(['', '', '', '', '', '']);
    setSecurityError('');
    setProcessingSuccess(null);
    setAdminEmail(currentUser?.email || '');
    setSecurityModalOpen(true);
  };

  // Send Email OTP
  const handleSendOtp = async () => {
    if (!adminEmail || !adminEmail.trim()) {
      setSecurityError('Please enter your authorized email address.');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: adminEmail.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setOtpSent(true);
        setOtpExpirySeconds(data.expiresInSeconds || 300);
        toast('Verification code sent to registered administrator email.', 'success');
      } else {
        setSecurityError(data.msg || 'Failed to send OTP.');
      }
    } catch (err) {
      setSecurityError('Connection failure sending verification code.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Verify Email OTP
  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.trim().length !== 6) {
      setSecurityError('Enter the complete 6-digit verification code.');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: adminEmail.trim(), otp: otpInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setVerificationToken(data.verificationToken);
        setSecurityStep(2); // Proceed to PIN verification
        toast('Email verification successful. Enter your 6-digit Payment PIN.', 'success');
      } else {
        setSecurityError(data.msg || 'Invalid verification code.');
      }
    } catch (err) {
      setSecurityError('Error verifying OTP.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Handle PIN Digit Change
  const handlePinDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...pinDigits];
    newDigits[index] = value.slice(-1);
    setPinDigits(newDigits);

    // Auto advance focus
    if (value && index < 5) {
      const nextInput = document.getElementById(`payment-pin-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`payment-pin-digit-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Setup New Payment PIN
  const handleSetupPin = async (e) => {
    e.preventDefault();
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setSecurityError('PIN must be exactly 6 digits.');
      return;
    }
    if (newPin !== confirmNewPin) {
      setSecurityError('PIN and confirmation PIN do not match.');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/setup-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: newPin, confirmPin: confirmNewPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPinConfigured(true);
        setShowPinSetup(false);
        toast('6-digit Payment PIN configured successfully!', 'success');
      } else {
        setSecurityError(data.msg || 'Failed to configure PIN.');
      }
    } catch (err) {
      setSecurityError('Error configuring PIN.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Verify Payment PIN
  const handleVerifyPin = async () => {
    const fullPin = pinDigits.join('');
    if (fullPin.length !== 6) {
      setSecurityError('Please enter all 6 digits of your Payment PIN.');
      return;
    }
    setSecurityLoading(true);
    setSecurityError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/verify-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pin: fullPin, verificationToken })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSecurityStep(3); // Proceed to Final Confirmation
        toast('Payment PIN verified. Please review and confirm payment execution.', 'success');
      } else {
        setSecurityError(data.msg || 'Incorrect Payment PIN.');
      }
    } catch (err) {
      setSecurityError('Server error verifying PIN.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Final Payment Processing Execution (Section 7 & 8)
  const handleExecutePayment = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      let endpoint = `${API_BASE}/admin/enterprise/payments/process`;
      let payload = {
        verificationToken,
        idempotencyKey: `FIC-IDEM-${Date.now()}`
      };

      if (activePaymentAction.type === 'bulk') {
        endpoint = `${API_BASE}/admin/enterprise/payments/process-bulk`;
        payload.category = activePaymentAction.category;
      } else {
        payload.paymentId = activePaymentAction.paymentId;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProcessingSuccess(data);
        toast(data.msg || 'Payment processed successfully!', 'success');
        fetchDashboardData();
        if (activeCategoryModal) fetchTransactions();
        if (payAllPreviewData) setPayAllPreviewData(null);
      } else {
        setSecurityError(data.msg || 'Payment processing failed.');
      }
    } catch (err) {
      setSecurityError('Critical error during payment processing execution.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Open Cancel Payment Modal (Section 9)
  const handleOpenCancel = (payment) => {
    setCancelModalPayment(payment);
    setCancelReason('');
  };

  // Execute Payment Cancellation
  const handleExecuteCancel = async () => {
    if (!cancelReason || !cancelReason.trim()) {
      toast('Cancellation reason is required.', 'error');
      return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentId: cancelModalPayment.paymentId,
          cancellationReason: cancelReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`Payment ${cancelModalPayment.paymentId} cancelled successfully.`, 'success');
        setCancelModalPayment(null);
        fetchDashboardData();
        if (activeCategoryModal) fetchTransactions();
      } else {
        toast(data.msg || 'Failed to cancel payment.', 'error');
      }
    } catch (err) {
      toast('Error executing payment cancellation.', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  // View Receipt (Section 16)
  const handleOpenReceipt = async (paymentId) => {
    setReceiptLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/receipt/${paymentId}`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptData(data.receipt);
      }
    } catch (err) {
      toast('Error fetching payment receipt.', 'error');
    } finally {
      setReceiptLoading(false);
    }
  };

  // Open Delegation Modal (Section 15)
  const handleOpenDelegation = async () => {
    setShowDelegationModal(true);
    setDelegationLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/state-admins`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStateAdminsList(data.admins || []);
        if (data.admins && data.admins.length > 0) {
          setSelectedStateAdminId(data.admins[0]._id);
        }
      }
    } catch (err) {
      console.error('Fetch state admins error:', err);
    } finally {
      setDelegationLoading(false);
    }
  };

  const handleExecuteDelegation = async () => {
    if (!delegationState) {
      toast('Please choose a state territory.', 'error');
      return;
    }
    if (!selectedStateAdminId) {
      toast('Please choose a State Administrator.', 'error');
      return;
    }
    setDelegationLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/delegate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          state: delegationState,
          category: delegationCategory,
          stateAdminId: selectedStateAdminId,
          notes: delegationNotes
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(data.msg || 'Payments delegated successfully!', 'success');
        setShowDelegationModal(false);
        fetchDashboardData();
      } else {
        toast(data.msg || 'Delegation failed.', 'error');
      }
    } catch (err) {
      toast('Error during delegation processing.', 'error');
    } finally {
      setDelegationLoading(false);
    }
  };

  // Open Audit Log Modal (Section 17)
  const handleOpenAuditModal = async () => {
    setShowAuditModal(true);
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/audit-log?limit=50`, {
        headers: { 'x-auth-token': token, 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Fetch audit log error:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Printable Receipt Function
  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-20 font-sans">

      {/* 1. HEADER & CONTROL TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-black">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Payment Dashboard</h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Enterprise Financial Suite
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Strict separation of Money Received (+) and Money Paid (-), bank-grade OTP/PIN verification, and immutable audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleOpenDelegation}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-blue-500" /> Delegate to State Admin
          </button>

          <button
            onClick={handleOpenAuditModal}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4 text-purple-500" /> Audit Log
          </button>

          <button
            onClick={() => {
              setShowPinSetup(true);
              setSecurityModalOpen(true);
              setSecurityStep(2);
            }}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Key className="w-4 h-4 text-amber-500" /> {pinConfigured ? 'Security PIN' : 'Configure PIN'}
          </button>

          <button
            onClick={fetchDashboardData}
            title="Refresh Financial Data"
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. TOP DASHBOARD KPI CARDS (SECTION 24) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* TOTAL RECEIVED (+) */}
        <div className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 rounded-3xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Received</span>
            <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-sm">
              +
            </div>
          </div>
          <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 block tracking-tight mt-1.5">
            +₹{(kpi.totalReceived || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Verified Inflows</span>
        </div>

        {/* TOTAL PAID (-) */}
        <div className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 rounded-3xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Paid</span>
            <div className="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-sm">
              -
            </div>
          </div>
          <span className="text-xl font-black text-rose-600 dark:text-rose-400 block tracking-tight mt-1.5">
            -₹{(kpi.totalPaid || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Processed Outflows</span>
        </div>

        {/* PENDING PAYMENTS */}
        <div className="bg-white dark:bg-slate-900 border border-amber-500/20 dark:border-amber-500/30 rounded-3xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-xl font-black text-amber-600 dark:text-amber-400 block tracking-tight mt-1.5">
            ₹{(kpi.pendingAmount || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{kpi.pendingPayments || 0} Pending Approvals</span>
        </div>

        {/* FAILED PAYMENTS */}
        <div className="bg-white dark:bg-slate-900 border border-red-500/20 dark:border-red-500/30 rounded-3xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">Failed</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-xl font-black text-red-600 dark:text-red-400 block tracking-tight mt-1.5">
            ₹{(kpi.failedAmount || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{kpi.failedPayments || 0} Needs Review</span>
        </div>

        {/* CANCELLED PAYMENTS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-3xl p-4.5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cancelled</span>
            <XCircle className="w-4 h-4 text-slate-400" />
          </div>
          <span className="text-xl font-black text-slate-600 dark:text-slate-300 block tracking-tight mt-1.5">
            ₹{(kpi.cancelledAmount || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{kpi.cancelledPayments || 0} Revoked</span>
        </div>

        {/* NET CASH FLOW */}
        <div className={`bg-white dark:bg-slate-900 border rounded-3xl p-4.5 shadow-xs relative overflow-hidden ${
          (kpi.netCashFlow || 0) >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Net Cash Flow</span>
            {(kpi.netCashFlow || 0) >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <span className={`text-xl font-black block tracking-tight mt-1.5 ${
            (kpi.netCashFlow || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            ₹{(kpi.netCashFlow || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400 block mt-0.5">Received - Paid</span>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION A: MONEY RECEIVED (GREEN THEME, + ICON, POSITIVE AMOUNTS)      */}
      {/* ========================================================================= */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
              +
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
              A. Money Received
            </h3>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Incoming Revenue
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">Strict Positive Accounting</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {receivedCategories.map((cat) => (
            <div
              key={cat.key}
              className="bg-white dark:bg-slate-900 border border-emerald-500/20 dark:border-emerald-500/30 hover:border-emerald-500/40 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300">
                    {cat.title}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black text-xs">
                    +
                  </div>
                </div>

                <div className="mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-50 tracking-tight block">
                    +₹{(cat.totalAmount || 0).toLocaleString()}
                  </span>
                  <span className="text-xs font-semibold text-slate-400 mt-1 block">
                    {cat.transactionCount || 0} Transactions
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={() => handleOpenCategory(cat)}
                  className="w-full py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTION B: MONEY PAID (RED THEME, - ICON, OUTGOING TERMINOLOGY)        */}
      {/* ========================================================================= */}
      <div className="space-y-3.5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-xs shadow-xs">
              -
            </div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase">
              B. Money Paid
            </h3>
            <span className="text-[11px] font-bold text-rose-600 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
              Disbursements & Payouts
            </span>
          </div>
          <span className="text-xs font-bold text-slate-400">Database Payout Scheduling</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {paidCategories.map((cat) => (
            <div
              key={cat.key}
              className="bg-white dark:bg-slate-900 border border-rose-500/20 dark:border-rose-500/30 hover:border-rose-500/40 rounded-3xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase text-rose-700 dark:text-rose-300">
                    {cat.title}
                  </span>
                  <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center font-black text-xs">
                    -
                  </div>
                </div>

                <div className="mt-1">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight block">
                    -₹{(cat.totalAmount || 0).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                      {cat.pendingCount || 0} Pending
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      ({cat.totalCount || 0} Total)
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleOpenCategory(cat)}
                  className="py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button
                  disabled={!cat.pendingCount || cat.pendingCount === 0}
                  onClick={() => handleOpenPayAll(cat)}
                  className={`py-2.5 text-xs font-extrabold rounded-2xl flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs active:scale-98 ${
                    cat.pendingCount > 0
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-3 h-3" /> Pay All
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. DETAILED PAYMENT TRANSACTION MANAGEMENT MODAL (SECTION 2 & 14)         */}
      {/* ========================================================================= */}
      {activeCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-6xl rounded-3xl p-6 space-y-5 shadow-2xl my-6 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg ${
                  activeCategoryModal.type === 'received' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  {activeCategoryModal.type === 'received' ? '+' : '-'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    {activeCategoryModal.title} Management
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Detailed ledger with territory filtering, masked accounts, and backend-enforced payout actions.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {activeCategoryModal.type === 'paid' && (
                  <button
                    onClick={() => handleOpenPayAll(activeCategoryModal)}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" /> {activeCategoryModal.payAllAction || 'Pay All'}
                  </button>
                )}
                <button
                  onClick={() => setActiveCategoryModal(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter Bar (Search, Status, Dynamic Territory Hierarchy, Date Range, Sort) */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-850 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                
                {/* Search */}
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search name, ID, phone..."
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-semibold"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Dynamic State Filter (Database Sourced) */}
                <select
                  value={filterState}
                  onChange={(e) => {
                    setFilterState(e.target.value);
                    setFilterDistrict('all');
                    setFilterDivision('all');
                    setFilterPincode('all');
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All States</option>
                  {territoryStates.map((st) => (
                    <option key={st._id} value={st.name}>{st.name}</option>
                  ))}
                </select>

                {/* Dynamic District Filter */}
                <select
                  value={filterDistrict}
                  onChange={(e) => {
                    setFilterDistrict(e.target.value);
                    setFilterDivision('all');
                    setFilterPincode('all');
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Districts</option>
                  {availableDistricts.map((d) => (
                    <option key={d._id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                
                {/* Dynamic Division Filter */}
                <select
                  value={filterDivision}
                  onChange={(e) => {
                    setFilterDivision(e.target.value);
                    setFilterPincode('all');
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Divisions</option>
                  {availableDivisions.map((div) => (
                    <option key={div._id} value={div.name}>{div.name}</option>
                  ))}
                </select>

                {/* Dynamic Pincode Filter */}
                <select
                  value={filterPincode}
                  onChange={(e) => setFilterPincode(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Pincodes</option>
                  {availablePincodes.map((pin) => (
                    <option key={pin._id} value={pin.code}>{pin.code}</option>
                  ))}
                </select>

                {/* Date Filters */}
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                  title="Start Date"
                />

                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                  title="End Date"
                />

                {/* Sort Option */}
                <select
                  value={filterSort}
                  onChange={(e) => setFilterSort(e.target.value)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                >
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="amount_desc">Highest Amount</option>
                  <option value="amount_asc">Lowest Amount</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-x-auto min-h-[300px]">
              {txnLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
                  <span className="text-xs font-bold">Querying verified payment database records...</span>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-bold">No transactions found matching your criteria.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-3">Payment ID</th>
                      <th className="py-3 px-3">Recipient</th>
                      <th className="py-3 px-3">Territory</th>
                      <th className="py-3 px-3">Bank Details</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Period</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {transactions.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors">
                        
                        {/* Payment ID */}
                        <td className="py-3 px-3">
                          <span className="font-mono font-black text-slate-800 dark:text-slate-200 block">
                            {t.paymentId}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </span>
                        </td>

                        {/* Recipient */}
                        <td className="py-3 px-3">
                          <span className="font-black text-slate-800 dark:text-slate-100 block">
                            {t.recipientName}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 block">
                            {t.recipientType} {t.recipientPhone ? `• ${t.recipientPhone}` : ''}
                          </span>
                        </td>

                        {/* Territory */}
                        <td className="py-3 px-3 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block">
                            {t.territory?.state || '—'}
                          </span>
                          <span className="text-slate-400 block">
                            {t.territory?.district || '—'} / {t.territory?.pincode || '—'}
                          </span>
                        </td>

                        {/* Masked Bank Details */}
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300 block">
                            {t.maskedAccountNumber || '••••••••0000'}
                          </span>
                          <span className="text-slate-400 text-[10px] block">
                            {t.bankIfsc || '—'} ({t.bankName || 'Bank'})
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3">
                          <span className={`font-black text-sm block ${
                            t.paymentType === 'received' ? 'text-emerald-600' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {t.paymentType === 'received' ? '+' : '-'}₹{(t.amount || 0).toLocaleString()}
                          </span>
                        </td>

                        {/* Period */}
                        <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-400">
                          {t.paymentPeriod || '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full inline-block ${
                            t.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                            t.status === 'PENDING' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                            t.status === 'FAILED' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                            'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                          }`}>
                            {t.status}
                          </span>
                        </td>

                        {/* Actions (Section 2: [View], [Pay], [Cancel]) */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleViewPaymentDetail(t.paymentId)}
                              className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-[11px] cursor-pointer"
                              title="View Complete Details"
                            >
                              View
                            </button>

                            {t.status === 'PENDING' && t.paymentType === 'paid' && (
                              <>
                                <button
                                  onClick={() => startSecurityVerification({
                                    type: 'single',
                                    paymentId: t.paymentId,
                                    recipientName: t.recipientName,
                                    amount: t.amount,
                                    category: t.paymentCategory
                                  })}
                                  className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] cursor-pointer shadow-xs active:scale-95"
                                  title="Pay Recipient"
                                >
                                  Pay
                                </button>
                                <button
                                  onClick={() => handleOpenCancel(t)}
                                  className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 font-bold rounded-xl text-[11px] cursor-pointer"
                                  title="Cancel Payment"
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {t.status === 'PAID' && (
                              <button
                                onClick={() => handleOpenReceipt(t.paymentId)}
                                className="px-2 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 hover:bg-emerald-100 font-bold rounded-xl text-[11px] cursor-pointer"
                                title="View Receipt"
                              >
                                Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
              <span className="font-semibold text-slate-400">
                Showing {transactions.length} of {txnTotalCount} records
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={txnPage <= 1}
                  onClick={() => setTxnPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                  Page {txnPage} of {txnTotalPages}
                </span>
                <button
                  disabled={txnPage >= txnTotalPages}
                  onClick={() => setTxnPage(p => Math.min(txnTotalPages, p + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. PAYMENT DETAIL – VIEW MODAL (SECTION 3)                                */}
      {/* ========================================================================= */}
      {selectedPaymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 space-y-6 shadow-2xl my-6">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Payment Record Detail ({selectedPaymentDetail.paymentId})
                </h3>
              </div>
              <button
                onClick={() => setSelectedPaymentDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Recipient Name</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm block mt-0.5">
                  {selectedPaymentDetail.recipientName}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{selectedPaymentDetail.recipientType}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Amount</span>
                <span className={`font-black text-sm block mt-0.5 ${
                  selectedPaymentDetail.paymentType === 'received' ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {selectedPaymentDetail.paymentType === 'received' ? '+' : '-'}₹{(selectedPaymentDetail.amount || 0).toLocaleString()}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedPaymentDetail.status}</span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Payment Period</span>
                <span className="font-extrabold text-slate-800 dark:text-slate-100 block mt-0.5">
                  {selectedPaymentDetail.paymentPeriod || 'September 2026'}
                </span>
                <span className="text-[10px] font-bold text-slate-400">Due: {new Date(selectedPaymentDetail.dueDate).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Territory Breakdown */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-1.5 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Territory Location</span>
              <div className="grid grid-cols-4 gap-2 font-bold text-slate-700 dark:text-slate-300">
                <div>State: <span className="text-slate-900 dark:text-slate-100">{selectedPaymentDetail.territory?.state || '—'}</span></div>
                <div>District: <span className="text-slate-900 dark:text-slate-100">{selectedPaymentDetail.territory?.district || '—'}</span></div>
                <div>Division: <span className="text-slate-900 dark:text-slate-100">{selectedPaymentDetail.territory?.division || '—'}</span></div>
                <div>Pincode: <span className="text-slate-900 dark:text-slate-100">{selectedPaymentDetail.territory?.pincode || '—'}</span></div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Bank Destination</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-slate-700 dark:text-slate-300 font-semibold">
                <div>Holder: <span className="font-sans font-bold text-slate-900 dark:text-slate-100">{selectedPaymentDetail.bankAccountHolder || '—'}</span></div>
                <div>Account: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPaymentDetail.maskedAccountNumber || '••••••••0000'}</span></div>
                <div>IFSC: <span className="font-bold text-slate-900 dark:text-slate-100">{selectedPaymentDetail.bankIfsc || '—'}</span></div>
                <div>Bank: <span className="font-sans text-slate-900 dark:text-slate-100">{selectedPaymentDetail.bankName || 'Bank'}</span></div>
              </div>
            </div>

            {/* Payroll Compensation Details if Payroll */}
            {selectedPaymentDetail.department && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2 text-xs">
                <span className="text-[10px] font-black uppercase text-cyan-600 dark:text-cyan-400 tracking-wider block">Payroll Compensation Breakdown</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Department</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPaymentDetail.department}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Designation</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPaymentDetail.designation || 'Staff'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Basic Salary</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹{(selectedPaymentDetail.basicSalary || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Net Payable</span>
                    <span className="font-black text-emerald-600">₹{(selectedPaymentDetail.netSalary || selectedPaymentDetail.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Previous History */}
            {selectedPaymentDetail.previousPaymentHistory && selectedPaymentDetail.previousPaymentHistory.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Previous Payment History</span>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-850 rounded-2xl overflow-hidden">
                  {selectedPaymentDetail.previousPaymentHistory.map((h, idx) => (
                    <div key={idx} className="flex justify-between p-2.5 bg-slate-50 dark:bg-slate-950 text-[11px]">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{h.paymentId}</span>
                      <span className="text-slate-400">{h.paymentPeriod}</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">₹{(h.amount || 0).toLocaleString()}</span>
                      <span className="font-bold text-emerald-600 uppercase text-[10px]">{h.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedPaymentDetail(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold rounded-2xl cursor-pointer text-xs"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PAY ALL CONFIRMATION / PREVIEW SCREEN (SECTION 4, 10, 11, 12, 13)       */}
      {/* ========================================================================= */}
      {payAllPreviewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl p-6 space-y-5 shadow-2xl my-6">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-black text-rose-600 tracking-tight uppercase flex items-center gap-2">
                  <Send className="w-5 h-5" /> Pay All Recipients Confirmation
                </h3>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                  Review all eligible pending disbursements before proceeding to Email OTP & 6-digit PIN verification.
                </p>
              </div>
              <button onClick={() => setPayAllPreviewData(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 p-4 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 block">Total Payable Amount</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-400 block tracking-tight mt-0.5">
                  ₹{(payAllPreviewData.totalAmount || 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-850 p-4 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-400 block">Pending Recipients</span>
                <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block tracking-tight mt-0.5">
                  {payAllPreviewData.pendingCount || 0}
                </span>
              </div>
            </div>

            {/* Recipients List with Masked Bank Details */}
            <div className="max-h-64 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {payAllPreviewData.recipients.map((r, i) => (
                <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-850/40">
                  <div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{r.recipientName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {r.maskedAccountNumber} • {r.bankIfsc} • {r.territory?.state || 'TN'}
                    </span>
                  </div>
                  <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                    ₹{(r.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setPayAllPreviewData(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPayAllPreviewData(null);
                  startSecurityVerification({
                    type: 'bulk',
                    category: payAllPreviewData.category,
                    amount: payAllPreviewData.totalAmount,
                    recipientName: `${payAllPreviewData.pendingCount} Recipients in Bulk Batch`
                  });
                }}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-xs shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                Proceed to Verification <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. 3-STEP PAYMENT SECURITY VERIFICATION MODAL (SECTIONS 5, 6, 7, 8)       */}
      {/* ========================================================================= */}
      {securityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl my-6">
            
            {/* Header & Step Indicator */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-500/10 text-primary-600 flex items-center justify-center font-black">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      Payment Authorization Gateway
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400">Step {securityStep} of 3</span>
                  </div>
                </div>
                <button
                  onClick={() => setSecurityModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className={`h-1.5 rounded-full ${securityStep >= 1 ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full ${securityStep >= 2 ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full ${securityStep >= 3 ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
              </div>
            </div>

            {/* Error Message Alert */}
            {securityError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{securityError}</span>
              </div>
            )}

            {/* SUCCESS VIEW */}
            {processingSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Payment Processed Successfully!</h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    The ledger has been synchronized and the transaction is marked as PAID.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs text-left font-mono space-y-1">
                  <div>Reference: <span className="font-bold text-slate-800 dark:text-slate-200">{processingSuccess.payment?.transactionReference || processingSuccess.summary?.batchReference || 'TXN-SUCCESS'}</span></div>
                  <div>Status: <span className="font-bold text-emerald-600">PAID</span></div>
                </div>

                <div className="flex justify-center gap-2.5 pt-2">
                  <button
                    onClick={() => {
                      setSecurityModalOpen(false);
                      if (processingSuccess.payment?.paymentId) {
                        handleOpenReceipt(processingSuccess.payment.paymentId);
                      }
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-md"
                  >
                    View Receipt
                  </button>
                  <button
                    onClick={() => setSecurityModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold rounded-2xl text-xs cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: EMAIL OTP VERIFICATION (SECTION 5) */}
                {securityStep === 1 && (
                  <div className="space-y-4 text-xs">
                    <div>
                      <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Administrator Email Address
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="e.g. admin@example.com"
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={securityLoading}
                          onClick={handleSendOtp}
                          className="px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {otpSent ? 'Resend Code' : 'Send Code'}
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-2 pt-2 animate-fadeIn">
                        <label className="block font-bold text-slate-500 uppercase tracking-wider">
                          Enter 6-Digit Verification Code
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="••••••"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 font-mono text-center text-xl tracking-[0.5em] font-black text-slate-800 dark:text-slate-100 focus:outline-none"
                        />
                        <span className="text-[10px] text-slate-400 block font-medium">
                          Single-use code expires in 5 minutes. Never share this code.
                        </span>
                      </div>
                    )}

                    <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSecurityModalOpen(false)}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!otpSent || otpInput.length !== 6 || securityLoading}
                        onClick={handleVerifyOtp}
                        className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {securityLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Verify & Continue <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: 6-DIGIT PAYMENT PIN (SECTION 6) */}
                {securityStep === 2 && (
                  <div className="space-y-4 text-xs">
                    {!pinConfigured || showPinSetup ? (
                      <form onSubmit={handleSetupPin} className="space-y-3">
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 p-3 rounded-2xl text-amber-700 dark:text-amber-400 font-semibold text-xs">
                          Payment PIN has not been configured. Set up your confidential 6-digit PIN below.
                        </div>

                        <div>
                          <label className="block font-bold text-slate-500 uppercase mb-1">New 6-Digit PIN</label>
                          <input
                            type="password"
                            maxLength={6}
                            value={newPin}
                            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter 6 digits"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-center font-mono text-base font-black"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-500 uppercase mb-1">Confirm 6-Digit PIN</label>
                          <input
                            type="password"
                            maxLength={6}
                            value={confirmNewPin}
                            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Re-enter 6 digits"
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-center font-mono text-base font-black"
                          />
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="submit"
                            disabled={securityLoading || newPin.length !== 6 || confirmNewPin.length !== 6}
                            className="w-full py-3 bg-primary-600 text-white font-extrabold rounded-2xl shadow-md cursor-pointer disabled:opacity-50"
                          >
                            Save Payment PIN & Continue
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center space-y-1">
                          <label className="block font-black text-slate-800 dark:text-slate-100 text-sm">
                            Enter 6-Digit Payment PIN
                          </label>
                          <span className="text-[11px] text-slate-400 font-medium">
                            Authorized Super Administrator security verification
                          </span>
                        </div>

                        {/* 6 Digit Input Boxes */}
                        <div className="flex justify-center gap-2.5 py-2">
                          {[0, 1, 2, 3, 4, 5].map((idx) => (
                            <input
                              key={idx}
                              id={`payment-pin-digit-${idx}`}
                              type="password"
                              inputMode="numeric"
                              maxLength={1}
                              value={pinDigits[idx]}
                              onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                              onKeyDown={(e) => handlePinKeyDown(idx, e)}
                              className="w-11 h-13 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xl font-mono font-black focus:border-primary-500 focus:outline-none"
                            />
                          ))}
                        </div>

                        <div className="pt-3 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setShowPinSetup(true)}
                            className="text-primary-600 font-bold hover:underline"
                          >
                            Forgot PIN / Reset
                          </button>

                          <button
                            type="button"
                            disabled={pinDigits.join('').length !== 6 || securityLoading}
                            onClick={handleVerifyPin}
                            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {securityLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                            Authorize PIN <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: FINAL PAYMENT CONFIRMATION (SECTION 7 & 8) */}
                {securityStep === 3 && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Are you sure you want to process this payment?</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">
                        This action will disburse funds, update the backend database to PAID, and generate an irrevocable audit reference.
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Recipient / Run:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">
                          {activePaymentAction?.recipientName || 'Pending Payee'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Total Amount:</span>
                        <span className="font-black text-rose-600 text-sm">
                          ₹{(activePaymentAction?.amount || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Period:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">September 2026</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Security Clearance:</span>
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> OTP & PIN Verified
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSecurityModalOpen(false)}
                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={securityLoading}
                        onClick={handleExecutePayment}
                        className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95"
                      >
                        {securityLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Yes, Process Payment
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. CANCEL PAYMENT MODAL (SECTION 9)                                       */}
      {/* ========================================================================= */}
      {cancelModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl my-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                Cancel Payment ({cancelModalPayment.paymentId})
              </h3>
              <button onClick={() => setCancelModalPayment(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 p-3 rounded-2xl text-amber-700 dark:text-amber-400 font-medium">
                Cancelling this payment of <strong>₹{(cancelModalPayment.amount || 0).toLocaleString()}</strong> to <strong>{cancelModalPayment.recipientName}</strong>. A mandatory reason is required for compliance.
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancelling this payment..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCancelModalPayment(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl cursor-pointer"
              >
                Keep Payment
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || cancelLoading}
                onClick={handleExecuteCancel}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : 'Cancel Payment'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. PAYMENT DELEGATION TO STATE ADMIN MODAL (SECTION 15)                  */}
      {/* ========================================================================= */}
      {showDelegationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-500" />
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Delegate Payment to State Admin
                </h3>
              </div>
              <button onClick={() => setShowDelegationModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 font-medium">
                Delegate state territory disbursement responsibilities to an authorized State Administrator.
              </p>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">State Territory</label>
                <select
                  value={delegationState}
                  onChange={(e) => setDelegationState(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-semibold focus:outline-none"
                >
                  <option value="">Select State Territory...</option>
                  {territoryStates.map((st) => (
                    <option key={st._id} value={st.name}>{st.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Payment Category</label>
                <select
                  value={delegationCategory}
                  onChange={(e) => setDelegationCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-semibold focus:outline-none"
                >
                  <option value="all">All Outgoing Categories</option>
                  <option value="agent_payment">Agent Payments</option>
                  <option value="vendor_payment">Vendor Payments</option>
                  <option value="technician_payment">Technician Payments</option>
                  <option value="delivery_partner_payment">Delivery Partner Payments</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Authorized State Admin</label>
                <select
                  value={selectedStateAdminId}
                  onChange={(e) => setSelectedStateAdminId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-semibold focus:outline-none"
                >
                  {stateAdminsList.map((adm) => (
                    <option key={adm._id} value={adm._id}>
                      {adm.name} ({adm.email}) {adm.assignedState ? `— ${adm.assignedState}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-500 uppercase mb-1">Delegation Notes</label>
                <input
                  type="text"
                  value={delegationNotes}
                  onChange={(e) => setDelegationNotes(e.target.value)}
                  placeholder="e.g. Authorized September commission disbursement run"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setShowDelegationModal(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-2xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!delegationState || !selectedStateAdminId || delegationLoading}
                onClick={handleExecuteDelegation}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50"
              >
                {delegationLoading ? 'Delegating...' : 'Delegate Payouts'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. PAYMENT RECEIPT MODAL (SECTION 16)                                     */}
      {/* ========================================================================= */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl my-6 print:shadow-none print:border-none">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Official Payment Receipt</h3>
              </div>
              <button onClick={() => setReceiptData(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer print:hidden">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-800 pb-2">
                <span className="font-mono text-[10px] text-slate-400">{receiptData.receiptNumber}</span>
                <span className="font-bold text-emerald-600 uppercase text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Status: {receiptData.status}
                </span>
              </div>

              <div className="space-y-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.paymentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Ref:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.transactionReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.recipientName} ({receiptData.recipientType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Destination Account:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.bankDestination?.maskedAccount} ({receiptData.bankDestination?.ifsc})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Date:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{new Date(receiptData.paymentDate).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authorized By:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.processedBy}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                <span className="font-black text-slate-600 dark:text-slate-400 uppercase">Total Disbursed:</span>
                <span className="text-xl font-black text-emerald-600">
                  ₹{(receiptData.amount || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 text-xs print:hidden">
              <button
                onClick={handlePrintReceipt}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </button>
              <button
                onClick={() => setReceiptData(null)}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. IMMUTABLE AUDIT LOG MODAL (SECTION 17)                                */}
      {/* ========================================================================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 space-y-4 shadow-2xl my-6 max-h-[88vh] flex flex-col">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-500" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  Immutable Payment Security Audit Trail
                </h3>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {auditLoading ? (
                <div className="py-12 text-center text-slate-400">Loading audit trail...</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No payment audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log._id} className="py-3 flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-800 dark:text-slate-100">{log.user} ({log.role})</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium text-[11px]">{log.details}</p>
                      {log.paymentId && (
                        <span className="font-mono text-[10px] text-slate-400 block">Payment ID: {log.paymentId}</span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold rounded-2xl text-xs cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
});
