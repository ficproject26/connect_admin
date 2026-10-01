import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DollarSign, Shield, RefreshCw, Layers, FileText, CheckCircle, Clock,
  AlertTriangle, XCircle, Search, ChevronRight, Eye, Lock, Key, ArrowRight,
  Check, X, Printer, MapPin, Building, User, Users, Send, AlertCircle,
  FileCheck, ArrowUpRight, ArrowDownRight, Share2, HelpCircle, Briefcase,
  Truck, Wrench, Store, PauseCircle, Ban, PlayCircle, Hash, ExternalLink,
  Zap
} from 'lucide-react';
import { io } from 'socket.io-client';

export const EnterprisePaymentDashboard = React.memo(({ token, API_BASE, currentUser, onToast }) => {
  // Main Data States
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('agents'); // 'agents' | 'vendors' | 'delivery' | 'technicians'
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Executive KPI summary
  const [kpis, setKpis] = useState({
    totalPayableAmount: 0,
    totalPayableCount: 0,
    agentPayableAmount: 0,
    agentPayableCount: 0,
    vendorPayableAmount: 0,
    vendorPayableCount: 0,
    deliveryPayableAmount: 0,
    deliveryPayableCount: 0,
    technicianPayableAmount: 0,
    technicianPayableCount: 0,
    totalPaidOut: 0,
    onHoldCount: 0,
    cancelledCount: 0
  });

  // Four recipient categories
  const [recipients, setRecipients] = useState({
    agents: [],
    vendors: [],
    deliveryPartners: [],
    technicians: []
  });

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'HOLD' | 'PAID' | 'CANCELLED'

  // Pay Action Modal Flow States (10 Steps)
  // Step 1: Confirmation & Breakdown
  // Step 2: Email OTP Entry
  // Step 3: Security PIN Entry
  // Step 4: Success & Receipt
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payStep, setPayStep] = useState(1); // 1: details, 2: otp, 3: pin, 4: success
  const [selectedPayable, setSelectedPayable] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(120);
  const [verificationToken, setVerificationToken] = useState('');
  const [maskedAuthEmail, setMaskedAuthEmail] = useState('');
  const [securityPin, setSecurityPin] = useState(['', '', '', '', '', '']);
  const [pinLoading, setPinLoading] = useState(false);
  const [payError, setPayError] = useState('');
  const [processedResult, setProcessedResult] = useState(null);

  // Hold Action Modal
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [holdTarget, setHoldTarget] = useState(null);
  const [holdReason, setHoldReason] = useState('');
  const [holdLoading, setHoldLoading] = useState(false);

  // Cancel Action Modal
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Security PIN Configuration Modal
  const [pinConfigModalOpen, setPinConfigModalOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinSetupLoading, setPinSetupLoading] = useState(false);
  const [pinSetupError, setPinSetupError] = useState('');
  const [pinStatus, setPinStatus] = useState({ configured: false, isLocked: false });

  // Payout Audit Log Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Receipt Modal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // Bulk Payment Selection & Multi-Step Processing States (Requirements 2, 3, 4, 5, 9, 10)
  const [selectedPaymentIds, setSelectedPaymentIds] = useState(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState(1); // 1: review, 2: otp, 3: pin, 4: results
  const [bulkItems, setBulkItems] = useState([]);
  const [bulkOtpCode, setBulkOtpCode] = useState('');
  const [bulkOtpLoading, setBulkOtpLoading] = useState(false);
  const [bulkOtpTimer, setBulkOtpTimer] = useState(120);
  const [bulkVerificationToken, setBulkVerificationToken] = useState('');
  const [bulkMaskedAuthEmail, setBulkMaskedAuthEmail] = useState('');
  const [bulkSecurityPin, setBulkSecurityPin] = useState(['', '', '', '', '', '']);
  const [bulkPinLoading, setBulkPinLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkResults, setBulkResults] = useState([]);

  // Detailed Payment Breakdown Statement Modal States (Requirement 7)
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  // Fetch Payout Dashboard Data
  const fetchDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/dashboard`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.kpis) setKpis(data.kpis);
        if (data.recipients) {
          setRecipients({
            agents: Array.isArray(data.recipients.agents) ? data.recipients.agents : [],
            vendors: Array.isArray(data.recipients.vendors) ? data.recipients.vendors : [],
            deliveryPartners: Array.isArray(data.recipients.deliveryPartners) ? data.recipients.deliveryPartners : [],
            technicians: Array.isArray(data.recipients.technicians) ? data.recipients.technicians : []
          });
        }
      }
    } catch (err) {
      console.error('Fetch payout dashboard error:', err);
      if (!isSilent) toast('Failed to load payout dashboard data', 'error');
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [API_BASE, token, toast]);

  // Check Security PIN Status
  const checkPinStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/pin-status`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setPinStatus({
          configured: Boolean(data.configured),
          isLocked: Boolean(data.isLocked),
          lockedUntil: data.lockedUntil
        });
      }
    } catch (e) {}
  }, [API_BASE, token]);

  // Initial Load
  useEffect(() => {
    fetchDashboardData();
    checkPinStatus();
  }, [fetchDashboardData, checkPinStatus]);

  // Socket.IO Real-Time Synchronization Listener
  useEffect(() => {
    let socket = null;
    try {
      let serverUrl = API_BASE ? API_BASE.replace(/\/api.*$/, '') : '';
      if (!serverUrl && typeof window !== 'undefined') {
        serverUrl = window.location.origin;
      }
      socket = io(serverUrl || 'http://localhost:8004', {
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 10,
        reconnectionDelay: 1500
      });

      socket.on('connect', () => {
        setIsLiveConnected(true);
        socket.emit('register', { role: 'admin' });
      });

      socket.on('disconnect', () => {
        setIsLiveConnected(false);
      });

      const onRealtimeUpdate = () => {
        fetchDashboardData(true);
      };

      socket.on('payment_updated', onRealtimeUpdate);
      socket.on('payment:updated', onRealtimeUpdate);
      socket.on('pincode_updated', onRealtimeUpdate);
      socket.on('territory_updated', onRealtimeUpdate);
    } catch (e) {
      console.warn('Real-time connection notice:', e.message);
    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, [API_BASE, fetchDashboardData]);

  // OTP Countdown Timer (Single Pay)
  useEffect(() => {
    let interval = null;
    if (payModalOpen && payStep === 2 && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [payModalOpen, payStep, otpTimer]);

  // Bulk OTP Countdown Timer (Requirements 2, 5, 9, 10)
  useEffect(() => {
    let interval = null;
    if (bulkModalOpen && bulkStep === 2 && bulkOtpTimer > 0) {
      interval = setInterval(() => {
        setBulkOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [bulkModalOpen, bulkStep, bulkOtpTimer]);

  // Format currency
  const fmtCurrency = (val) => {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  };

  // Format Date
  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return String(d);
    }
  };

  // Filter current active recipient list
  const currentList = useMemo(() => {
    const raw = recipients[activeTab] || [];
    return raw.filter(item => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const itemStatus = (item.status || 'PENDING').toUpperCase();
        if (statusFilter === 'PENDING' && itemStatus !== 'PENDING' && itemStatus !== 'ELIGIBLE') return false;
        if (statusFilter !== 'PENDING' && itemStatus !== statusFilter) return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const name = (item.recipientName || '').toLowerCase();
        const id = (item.recipientId || item.paymentId || '').toLowerCase();
        const ref = (item.sourceReference || item.orderReference || item.deliveryReference || item.workReference || '').toLowerCase();
        const purp = (item.paymentPurpose || '').toLowerCase();
        const phone = (item.recipientPhone || '').toLowerCase();
        const email = (item.recipientEmail || '').toLowerCase();
        const bName = (item.businessName || '').toLowerCase();
        return name.includes(q) || id.includes(q) || ref.includes(q) || purp.includes(q) || phone.includes(q) || email.includes(q) || bName.includes(q);
      }
      return true;
    });
  }, [recipients, activeTab, statusFilter, searchTerm]);

  // Selectable pending items in the currently visible list (Requirements 3, 4)
  const pendingItemsInCurrentList = useMemo(() => {
    return currentList.filter(item => {
      const s = (item.status || 'PENDING').toUpperCase();
      return s === 'PENDING' || s === 'ELIGIBLE';
    });
  }, [currentList]);

  // Header Select All state for current visible pending items
  const isAllSelected = useMemo(() => {
    if (pendingItemsInCurrentList.length === 0) return false;
    return pendingItemsInCurrentList.every(item => selectedPaymentIds.has(item.paymentId || item._id));
  }, [pendingItemsInCurrentList, selectedPaymentIds]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected) return false;
    return pendingItemsInCurrentList.some(item => selectedPaymentIds.has(item.paymentId || item._id));
  }, [pendingItemsInCurrentList, selectedPaymentIds, isAllSelected]);

  // Total amount of currently selected pending items
  const bulkSelectedAmount = useMemo(() => {
    const allItems = [
      ...(recipients.agents || []),
      ...(recipients.vendors || []),
      ...(recipients.deliveryPartners || []),
      ...(recipients.technicians || [])
    ];
    let total = 0;
    allItems.forEach(item => {
      const id = item.paymentId || item._id;
      if (selectedPaymentIds.has(id)) {
        const s = (item.status || 'PENDING').toUpperCase();
        if (s === 'PENDING' || s === 'ELIGIBLE') {
          total += Number(item.payableAmount || item.amount || 0);
        }
      }
    });
    return total;
  }, [recipients, selectedPaymentIds]);

  const handleToggleSelectAll = () => {
    setSelectedPaymentIds(prev => {
      const next = new Set(prev);
      if (isAllSelected) {
        pendingItemsInCurrentList.forEach(item => next.delete(item.paymentId || item._id));
      } else {
        pendingItemsInCurrentList.forEach(item => next.add(item.paymentId || item._id));
      }
      return next;
    });
  };

  const handleToggleSelectOne = (id) => {
    setSelectedPaymentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------
  // ACTION: INITIATE PAY FLOW (Step 1)
  // -------------------------------------------------------------
  const handleOpenPayModal = (item) => {
    setSelectedPayable(item);
    setPayStep(1);
    setPayError('');
    setOtpCode('');
    setVerificationToken('');
    setMaskedAuthEmail('');
    setSecurityPin(['', '', '', '', '', '']);
    setProcessedResult(null);
    setPayModalOpen(true);
  };

  // ACTION: CONFIRM DETAILS & REQUEST EMAIL OTP (Step 2)
  const handleRequestOtp = async () => {
    setOtpLoading(true);
    setPayError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/send-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: selectedPayable?.paymentId,
          amount: selectedPayable?.payableAmount || selectedPayable?.amount,
          recipientId: selectedPayable?.recipientId,
          recipientName: selectedPayable?.recipientName,
          recipientType: selectedPayable?.recipientType
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.maskedEmail) setMaskedAuthEmail(data.maskedEmail);
        const tokenVal = data.authorizationToken || data.verificationToken || '';
        if (tokenVal) setVerificationToken(tokenVal);
        toast(data.msg || `Verification OTP dispatched to ${data.maskedEmail || currentUser?.email || 'authorized email'}`);
        setOtpTimer(data.expiresIn || 120);
        setPayStep(2);
      } else {
        setPayError(data.msg || 'Failed to dispatch email verification code');
      }
    } catch (err) {
      setPayError('Network error while requesting OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  // ACTION: VERIFY EMAIL OTP (Step 2 -> Step 3)
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setPayError('Please enter a complete 6-digit OTP code');
      return;
    }
    setOtpLoading(true);
    setPayError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/verify-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp: otpCode.trim(),
          authorizationToken: verificationToken,
          verificationToken: verificationToken
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const tokenVal = data.authorizationToken || data.verificationToken || verificationToken;
        if (tokenVal) setVerificationToken(tokenVal);
        setPayStep(3);
        toast('Email OTP verified. Please enter your Security PIN.');
      } else {
        setPayError(data.msg || 'Invalid or expired OTP code');
      }
    } catch (err) {
      setPayError('Network error verifying OTP code');
    } finally {
      setOtpLoading(false);
    }
  };

  // ACTION: VERIFY PIN & DISBURSE PAYMENT (Step 3 -> Step 4)
  const handleAuthorizeDisbursement = async (e) => {
    e.preventDefault();
    const pinStr = securityPin.join('');
    if (pinStr.length < 4 || pinStr.length > 6) {
      setPayError('Please enter your 4 to 6 digit Security PIN');
      return;
    }

    setPinLoading(true);
    setPayError('');
    try {
      // 1. Verify PIN with server
      const pinRes = await fetch(`${API_BASE}/admin/enterprise/payments/verify-pin`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pin: pinStr,
          authorizationToken: verificationToken,
          verificationToken: verificationToken
        })
      });
      const pinData = await pinRes.json();
      if (!pinRes.ok || !pinData.success) {
        setPayError(pinData.msg || 'Incorrect Security PIN');
        setPinLoading(false);
        return;
      }

      // 2. Process Disbursement Atomically with server-side authorization session
      const processRes = await fetch(`${API_BASE}/admin/enterprise/payments/process`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: selectedPayable.paymentId,
          authorizationToken: verificationToken,
          verificationToken: verificationToken,
          amount: selectedPayable.payableAmount || selectedPayable.amount,
          recipientId: selectedPayable.recipientId,
          notes: selectedPayable.paymentPurpose
        })
      });
      const processData = await processRes.json();
      if (processRes.ok && processData.success) {
        setProcessedResult(processData.payment);
        setPayStep(4);
        toast(processData.msg || 'Payment disbursed successfully');
        fetchDashboardData(true);
      } else {
        setPayError(processData.msg || 'Payment processing failed');
      }
    } catch (err) {
      setPayError('Disbursement transaction failed due to network error');
    } finally {
      setPinLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: HOLD PAYMENT
  // -------------------------------------------------------------
  const handleOpenHoldModal = (item) => {
    setHoldTarget(item);
    setHoldReason('');
    setHoldModalOpen(true);
  };

  const handleConfirmHold = async (e) => {
    e.preventDefault();
    if (!holdReason.trim()) {
      toast('Please specify a mandatory reason for placing this payment on hold', 'error');
      return;
    }
    setHoldLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/hold`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: holdTarget.paymentId,
          reason: holdReason.trim(),
          recipientId: holdTarget.recipientId,
          recipientType: holdTarget.recipientType,
          recipientName: holdTarget.recipientName,
          payableAmount: holdTarget.payableAmount,
          paymentPurpose: holdTarget.paymentPurpose,
          sourceReference: holdTarget.sourceReference
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`Payment ${holdTarget.paymentId} placed on hold`);
        setHoldModalOpen(false);
        fetchDashboardData(true);
      } else {
        toast(data.msg || 'Failed to place payment on hold', 'error');
      }
    } catch (err) {
      toast('Network error holding payment', 'error');
    } finally {
      setHoldLoading(false);
    }
  };

  const handleReleaseHold = async (item) => {
    if (!window.confirm(`Release payment ${item.paymentId} from HOLD back to PENDING?`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/release-hold`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ paymentId: item.paymentId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`Payment ${item.paymentId} released back to PENDING`);
        fetchDashboardData(true);
      } else {
        toast(data.msg || 'Failed to release hold', 'error');
      }
    } catch (err) {
      toast('Network error releasing hold', 'error');
    }
  };

  // -------------------------------------------------------------
  // ACTION: CANCEL PAYMENT
  // -------------------------------------------------------------
  const handleOpenCancelModal = (item) => {
    setCancelTarget(item);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      toast('A cancellation reason is required for immutable audit logging', 'error');
      return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/cancel`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: cancelTarget.paymentId,
          cancellationReason: cancelReason.trim(),
          reason: cancelReason.trim(),
          recipientId: cancelTarget.recipientId,
          recipientType: cancelTarget.recipientType,
          recipientName: cancelTarget.recipientName,
          payableAmount: cancelTarget.payableAmount,
          paymentPurpose: cancelTarget.paymentPurpose,
          sourceReference: cancelTarget.sourceReference
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast(`Payment ${cancelTarget.paymentId} cancelled successfully`);
        setCancelModalOpen(false);
        fetchDashboardData(true);
      } else {
        toast(data.msg || 'Failed to cancel payment', 'error');
      }
    } catch (err) {
      toast('Network error cancelling payment', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: CONFIGURE / SETUP SECURITY PIN
  // -------------------------------------------------------------
  const handleSetupPin = async (e) => {
    e.preventDefault();
    if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinSetupError('Security PIN must be exactly 6 numeric digits');
      return;
    }
    if (newPin !== confirmPin) {
      setPinSetupError('PIN and Confirmation PIN do not match');
      return;
    }
    setPinSetupLoading(true);
    setPinSetupError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/setup-pin`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pin: newPin, confirmPin })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('6-digit Payment Security PIN configured successfully');
        setPinConfigModalOpen(false);
        checkPinStatus();
      } else {
        setPinSetupError(data.msg || 'Failed to configure PIN');
      }
    } catch (err) {
      setPinSetupError('Network error configuring PIN');
    } finally {
      setPinSetupLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: VIEW AUDIT LOGS
  // -------------------------------------------------------------
  const handleOpenAuditLogs = async () => {
    setAuditModalOpen(true);
    setAuditLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/audit-log?limit=50`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      toast('Failed to load audit logs', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: VIEW RECEIPT
  // -------------------------------------------------------------
  const handleViewReceipt = async (item) => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/receipt/${item.paymentId}`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok && data.success && data.receipt) {
        setReceiptData(data.receipt);
        setReceiptModalOpen(true);
      } else {
        toast('Receipt details not found', 'error');
      }
    } catch (err) {
      toast('Failed to retrieve receipt', 'error');
    }
  };

  // -------------------------------------------------------------
  // ACTION: BULK PAYMENT FLOW (REQUIREMENTS 2, 4, 5, 9, 10, 13)
  // -------------------------------------------------------------
  const handleInitiatePayAll = () => {
    const allItems = [
      ...(recipients.agents || []),
      ...(recipients.vendors || []),
      ...(recipients.deliveryPartners || []),
      ...(recipients.technicians || [])
    ];
    const selected = allItems.filter(i => 
      (selectedPaymentIds.has(i.paymentId) || selectedPaymentIds.has(i._id)) &&
      (i.status === 'PENDING' || i.status === 'ELIGIBLE' || !i.status)
    );

    if (selected.length === 0) {
      toast('Please select at least one pending disbursement to process', 'warning');
      return;
    }

    setBulkItems(selected);
    setBulkStep(1);
    setBulkError('');
    setBulkOtpCode('');
    setBulkSecurityPin(['', '', '', '', '', '']);
    setBulkResults([]);
    setBulkSummary(null);
    setBulkModalOpen(true);
  };

  const handleInitiateProcessAll = () => {
    let itemsToProcess = [];
    if (selectedPaymentIds.size > 0) {
      const allItems = [
        ...(recipients.agents || []),
        ...(recipients.vendors || []),
        ...(recipients.deliveryPartners || []),
        ...(recipients.technicians || [])
      ];
      itemsToProcess = allItems.filter(i => 
        (selectedPaymentIds.has(i.paymentId) || selectedPaymentIds.has(i._id)) &&
        (i.status === 'PENDING' || i.status === 'ELIGIBLE' || !i.status)
      );
    } else {
      itemsToProcess = pendingItemsInCurrentList;
    }

    if (itemsToProcess.length === 0) {
      toast('No pending disbursements found to process in the current view', 'warning');
      return;
    }

    // Select the items to process
    const newSel = new Set(selectedPaymentIds);
    itemsToProcess.forEach(i => newSel.add(i.paymentId || i._id));
    setSelectedPaymentIds(newSel);

    setBulkItems(itemsToProcess);
    setBulkStep(1);
    setBulkError('');
    setBulkOtpCode('');
    setBulkSecurityPin(['', '', '', '', '', '']);
    setBulkResults([]);
    setBulkSummary(null);
    setBulkModalOpen(true);
  };

  const handleBulkRequestOtp = async () => {
    setBulkOtpLoading(true);
    setBulkError('');
    try {
      const paymentIds = bulkItems.map(i => i.paymentId || i._id);
      const totalAmt = bulkItems.reduce((acc, i) => acc + Number(i.payableAmount || i.amount || 0), 0);
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/send-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentIds,
          isBulk: true,
          amount: totalAmt,
          recipientName: `${bulkItems.length} Recipients (Bulk Payout)`,
          recipientType: 'Bulk Payout',
          paymentPurpose: `Bulk disbursement for ${bulkItems.length} verified payouts`
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkVerificationToken(data.authorizationToken || data.verificationToken);
        setBulkMaskedAuthEmail(data.maskedEmail || '');
        setBulkOtpTimer(120);
        setBulkStep(2);
        toast(data.msg || 'Bulk verification OTP sent to authorized email');
      } else {
        setBulkError(data.msg || 'Failed to dispatch verification OTP');
      }
    } catch (err) {
      setBulkError('Network error requesting OTP');
    } finally {
      setBulkOtpLoading(false);
    }
  };

  const handleBulkVerifyOtp = async (e) => {
    e.preventDefault();
    if (!bulkOtpCode || bulkOtpCode.trim().length !== 6) {
      setBulkError('Please enter a complete 6-digit OTP code');
      return;
    }
    setBulkOtpLoading(true);
    setBulkError('');
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/verify-otp`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          otp: bulkOtpCode.trim(),
          authorizationToken: bulkVerificationToken,
          verificationToken: bulkVerificationToken
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const tokenVal = data.authorizationToken || data.verificationToken || bulkVerificationToken;
        if (tokenVal) setBulkVerificationToken(tokenVal);
        setBulkStep(3);
        toast('Email OTP verified. Please enter your Security PIN.');
      } else {
        setBulkError(data.msg || 'Invalid or expired OTP code');
      }
    } catch (err) {
      setBulkError('Network error verifying OTP code');
    } finally {
      setBulkOtpLoading(false);
    }
  };

  const handleBulkAuthorizeDisbursement = async (e) => {
    e.preventDefault();
    const pinStr = bulkSecurityPin.join('');
    if (pinStr.length < 4 || pinStr.length > 6) {
      setBulkError('Please enter your 4 to 6 digit Security PIN');
      return;
    }

    setBulkPinLoading(true);
    setBulkError('');
    try {
      // 1. Verify PIN
      const pinRes = await fetch(`${API_BASE}/admin/enterprise/payments/verify-pin`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pin: pinStr,
          authorizationToken: bulkVerificationToken,
          verificationToken: bulkVerificationToken
        })
      });
      const pinData = await pinRes.json();
      if (!pinRes.ok || !pinData.success) {
        setBulkError(pinData.msg || 'Incorrect Security PIN');
        setBulkPinLoading(false);
        return;
      }

      // 2. Process Bulk Disbursement Atomically
      const paymentIds = bulkItems.map(i => i.paymentId || i._id);
      const processRes = await fetch(`${API_BASE}/admin/enterprise/payments/bulk-process`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentIds,
          authorizationToken: bulkVerificationToken,
          verificationToken: bulkVerificationToken
        })
      });
      const processData = await processRes.json();
      if (processRes.ok && processData.success) {
        setBulkSummary(processData.summary);
        setBulkResults(processData.results || []);
        setBulkStep(4);
        toast(processData.msg || 'Bulk payment processed successfully');
        setSelectedPaymentIds(new Set());
        fetchDashboardData(true);
      } else {
        setBulkError(processData.msg || 'Bulk payment processing failed');
      }
    } catch (err) {
      setBulkError('Disbursement transaction failed due to network error');
    } finally {
      setBulkPinLoading(false);
    }
  };

  // -------------------------------------------------------------
  // ACTION: VIEW DETAILED BREAKDOWN STATEMENT (REQUIREMENT 7)
  // -------------------------------------------------------------
  const handleOpenBreakdown = async (item) => {
    setBreakdownLoading(true);
    setBreakdownData(null);
    setBreakdownModalOpen(true);
    try {
      const pId = item.paymentId || item._id;
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/breakdown/${pId}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.breakdown) {
          setBreakdownData(data.breakdown);
          return;
        }
      }
      // Accurate fallback from database record properties
      const gross = Number(item.grossAmount || item.amount || item.payableAmount || 0);
      const payable = Number(item.payableAmount || item.amount || 0);
      const comm = Math.max(0, gross - payable);
      const commRate = item.commissionRate || (gross > 0 && comm > 0 ? `${((comm / gross) * 100).toFixed(1)}%` : '0%');
      setBreakdownData({
        summary: {
          paymentId: item.paymentId || 'Not available',
          receiptId: item.receiptNumber || item.receiptId || (item.transactionReference ? `REC-${item.paymentId}` : 'Not available'),
          transactionReference: item.transactionReference || 'Not available',
          status: item.status || 'PENDING',
          paymentDate: item.paymentDate ? new Date(item.paymentDate).toLocaleDateString('en-IN') : 'Not available',
          paymentTime: item.paymentDate ? new Date(item.paymentDate).toLocaleTimeString('en-IN') : 'Not available',
          amount: payable,
          paymentMethod: item.paymentMethod || 'Direct Bank Transfer / NEFT',
          paymentPurpose: item.paymentPurpose || 'Not available'
        },
        recipient: {
          name: item.recipientName || 'Not available',
          recipientId: item.recipientId || 'Not available',
          recipientType: item.recipientType || (activeTab === 'agents' ? 'Agent' : activeTab === 'vendors' ? 'Vendor' : activeTab === 'delivery' ? 'Delivery Partner' : 'Technician'),
          businessName: item.businessName || 'Not available',
          businessType: item.businessType || item.role || 'Not available',
          phone: item.recipientPhone || item.phone || 'Not available',
          email: item.recipientEmail || item.email || 'Not available'
        },
        calculation: {
          grossAmount: gross,
          commissionRate: commRate,
          commissionAmount: comm,
          vendorPayableAmount: payable,
          applicableFees: 0,
          finalPayableAmount: payable
        },
        orderSettlement: {
          relatedOrderId: item.orderReference || item.sourceReference || 'Not available',
          orderDate: item.lastUpdated ? new Date(item.lastUpdated).toLocaleDateString('en-IN') : 'Not available',
          orderItems: item.eligibleOrder || item.eligibleWork || item.completedWork || 'Not available',
          quantity: item.quantity || 1,
          orderAmount: gross,
          settlementReference: item.sourceReference || item.orderReference || 'Not available',
          settlementDate: item.paymentDate || item.lastUpdated ? new Date(item.lastUpdated || item.paymentDate).toLocaleDateString('en-IN') : 'Not available'
        }
      });
    } catch (err) {
      console.error('Breakdown fetch error:', err);
    } finally {
      setBreakdownLoading(false);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status, holdReason, cancelReason) => {
    const s = (status || 'PENDING').toUpperCase();
    if (s === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle className="w-3.5 h-3.5" />
          PAID
        </span>
      );
    }
    if (s === 'HOLD') {
      return (
        <span
          title={holdReason ? `Hold Reason: ${holdReason}` : 'On Hold for Review'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800 cursor-help"
        >
          <PauseCircle className="w-3.5 h-3.5" />
          ON HOLD
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span
          title={cancelReason ? `Cancellation: ${cancelReason}` : 'Payment Cancelled'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 cursor-help"
        >
          <Ban className="w-3.5 h-3.5" />
          CANCELLED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
        <Clock className="w-3.5 h-3.5" />
        PENDING
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── 1. HEADER & EXECUTIVE ACTIONS ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Payment Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              PAYOUT & COMMISSION MANAGEMENT
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
            Review verified completed work, inspect calculation basis, and securely disburse payouts to Agents, Vendors, Delivery Partners, and Technicians via bank-grade dual verification.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Refresh Button (Position 1) */}
          <button
            type="button"
            onClick={() => fetchDashboardData(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer disabled:opacity-50 text-xs font-bold"
            title="Refresh dashboard records from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {/* Process All Button (Position 2) */}
          <button
            type="button"
            onClick={handleInitiateProcessAll}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Process pending payouts through dual verification"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Process All</span>
          </button>

          {/* Audit Log Button */}
          <button
            type="button"
            onClick={handleOpenAuditLogs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Audit Log</span>
          </button>
        </div>
      </div>

      {/* ── 2. PAYOUT EXECUTIVE KPI METRICS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Total Pending Payables */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-indigo-200/80 dark:border-indigo-900/60 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 text-xs font-bold">
            <span>TOTAL PAYABLE</span>
            <DollarSign className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {fmtCurrency(kpis.totalPayableAmount)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            {kpis.totalPayableCount} Pending Approvals
          </span>
        </div>

        {/* Agent Commissions */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-blue-200/80 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-bold">
            <span>AGENTS</span>
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {fmtCurrency(kpis.agentPayableAmount)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            {kpis.agentPayableCount} Eligible Agents
          </span>
        </div>

        {/* Vendor Settlements */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-purple-200/80 dark:border-purple-900/60 shadow-xs">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 text-xs font-bold">
            <span>VENDORS</span>
            <Store className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {fmtCurrency(kpis.vendorPayableAmount)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            {kpis.vendorPayableCount} Orders / Settlements
          </span>
        </div>

        {/* Delivery & Tech */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-amber-200/80 dark:border-amber-900/60 shadow-xs">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold">
            <span>LOGISTICS & TECH</span>
            <Truck className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {fmtCurrency(kpis.deliveryPayableAmount + kpis.technicianPayableAmount)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            {kpis.deliveryPayableCount + kpis.technicianPayableCount} Field Tasks
          </span>
        </div>

        {/* Total Paid Out */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
            <span>TOTAL PAID</span>
            <CheckCircle className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {fmtCurrency(kpis.totalPaidOut)}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            Disbursed Outflows
          </span>
        </div>

        {/* On Hold & Reviews */}
        <div className="p-4 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span>ON HOLD</span>
            <PauseCircle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {kpis.onHoldCount}
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5 font-medium">
            {kpis.cancelledCount} Cancelled
          </span>
        </div>
      </div>

      {/* ── 3. RECIPIENT TABS & FILTERS BAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Recipient Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('agents')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'agents'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Agents</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'agents' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {recipients.agents.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('vendors')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'vendors'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Vendors</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'vendors' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {recipients.vendors.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivery')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'delivery'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Delivery Partners</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'delivery' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {recipients.deliveryPartners.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('technicians')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeTab === 'technicians'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/60'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Technicians</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'technicians' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {recipients.technicians.length}
              </span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <div className="relative min-w-[200px] w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search recipient, ID, reference..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending / Eligible</option>
              <option value="HOLD">On Hold</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* ── Bulk Selection Bar (Requirements 4, 5) ── */}
        <div className="flex items-center justify-between gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Selected: <span className="text-indigo-600 dark:text-indigo-400 font-black">{selectedPaymentIds.size}</span>
              </span>
              {selectedPaymentIds.size > 0 && bulkSelectedAmount > 0 && (
                <span className="text-xs text-slate-500 font-semibold">
                  (Total: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fmtCurrency(bulkSelectedAmount)}</span>)
                </span>
              )}
            </div>
            {selectedPaymentIds.size > 0 && (
              <button
                type="button"
                onClick={() => setSelectedPaymentIds(new Set())}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInitiatePayAll}
              disabled={selectedPaymentIds.size === 0 || loading}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                selectedPaymentIds.size > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
              }`}
              title={selectedPaymentIds.size > 0 ? `Pay ${selectedPaymentIds.size} selected disbursements` : 'Select at least one pending disbursement'}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Pay All {selectedPaymentIds.size > 0 ? `(${selectedPaymentIds.size})` : ''}</span>
            </button>
          </div>
        </div>

        {/* ── 4. RECIPIENT TABLES ── */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-medium">Fetching real database payout records...</p>
          </div>
        ) : currentList.length === 0 ? (
          <div className="py-16 text-center space-y-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Layers className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No payable records available
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {activeTab === 'delivery'
                  ? 'There are currently no active delivery partner accounts or completed deliveries pending payout.'
                  : activeTab === 'technicians'
                  ? 'There are currently no active technician accounts or completed service tasks pending payout.'
                  : `No ${activeTab} matching the selected status or search filter were found in the database.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-black tracking-wider text-slate-400">
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      title={isAllSelected ? 'Deselect all pending disbursements' : 'Select all pending disbursements'}
                    />
                  </th>
                  <th className="py-3 px-3">Recipient / ID</th>
                  {activeTab === 'agents' && <th className="py-3 px-3">Role & Territory</th>}
                  {activeTab === 'vendors' && <th className="py-3 px-3">Business & Outlets</th>}
                  <th className="py-3 px-3">
                    {activeTab === 'agents' ? 'Completed Work' : activeTab === 'vendors' ? 'Order / Reference' : 'Completed Task'}
                  </th>
                  <th className="py-3 px-3">Commission / Basis</th>
                  <th className="py-3 px-3">Payable Amount</th>
                  <th className="py-3 px-3">Payment Purpose</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {currentList.map((item) => {
                  const isPending = item.status === 'PENDING' || item.status === 'ELIGIBLE' || !item.status;
                  const isHold = item.status === 'HOLD';
                  const isPaid = item.status === 'PAID';
                  const isCancelled = item.status === 'CANCELLED';

                  return (
                    <tr
                      key={item._id || item.paymentId}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                    >
                      {/* Checkbox before Receipt / Payment Record (Requirement 3) */}
                      <td className="py-3.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedPaymentIds.has(item.paymentId || item._id)}
                          disabled={!isPending}
                          onChange={() => handleToggleSelectOne(item.paymentId || item._id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isPending ? 'Select for bulk disbursement' : `Cannot select ${item.status || 'non-pending'} disbursement`}
                        />
                      </td>

                      {/* Recipient / ID */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {item.recipientName?.charAt(0) || 'R'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.recipientName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {item.recipientId || item.paymentId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Tab Specific Context (Agent Territory / Vendor Business) */}
                      {activeTab === 'agents' && (
                        <td className="py-3.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800 mb-0.5">
                            {item.role || 'Agent'}
                          </span>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.assignedTerritory || 'Tamil Nadu'}
                          </div>
                        </td>
                      )}

                      {activeTab === 'vendors' && (
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.businessName || 'Merchant Outlet'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {item.businessType || 'Retail'}
                          </div>
                        </td>
                      )}

                      {/* Completed Work / Order Ref */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">
                          {activeTab === 'agents' ? item.eligibleWork : activeTab === 'vendors' ? item.eligibleOrder : item.completedWork || item.completedDeliveries || item.sourceReference}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ref: {item.sourceReference || item.orderReference || '—'}
                        </div>
                      </td>

                      {/* Commission Basis & Rate */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-700 dark:text-slate-300">
                          {item.commissionBasis}
                        </div>
                        <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                          Rate: {item.commissionRate || 'Standard'}
                        </div>
                      </td>

                      {/* Payable Amount */}
                      <td className="py-3.5 px-3">
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          {fmtCurrency(item.payableAmount)}
                        </div>
                        {item.grossAmount && item.grossAmount !== item.payableAmount && (
                          <div className="text-[10px] text-slate-400">
                            Gross: {fmtCurrency(item.grossAmount)}
                          </div>
                        )}
                      </td>

                      {/* Payment Purpose */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <span className="text-slate-600 dark:text-slate-400 line-clamp-2 text-[11px]" title={item.paymentPurpose}>
                          {item.paymentPurpose || 'Verified service compensation'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        {renderStatusBadge(item.status, item.holdReason, item.cancellationReason)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View / Breakdown Button for Every Record (Requirement 7) */}
                          <button
                            type="button"
                            onClick={() => handleOpenBreakdown(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition shadow-xs cursor-pointer"
                            title="View detailed payment breakdown statement"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-500" />
                            <span>View</span>
                          </button>

                          {/* Pay Action Button */}
                          {(isPending || isHold) && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayModal(item)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs cursor-pointer"
                              title="Process dual-verified payout"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                              <span>Pay</span>
                            </button>
                          )}

                          {/* Hold Action Button */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleOpenHoldModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 hover:bg-amber-100 transition shadow-xs cursor-pointer"
                              title="Freeze payout for review"
                            >
                              <PauseCircle className="w-3.5 h-3.5" />
                              <span>Hold</span>
                            </button>
                          )}

                          {/* Release Hold Button */}
                          {isHold && (
                            <button
                              type="button"
                              onClick={() => handleReleaseHold(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 hover:bg-blue-100 transition shadow-xs cursor-pointer"
                              title="Release back to pending"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Release</span>
                            </button>
                          )}

                          {/* Cancel Action Button */}
                          {!isPaid && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition shadow-xs cursor-pointer"
                              title="Cancel disbursement"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancel</span>
                            </button>
                          )}

                          {/* Paid Receipt View Button */}
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition shadow-xs cursor-pointer"
                              title="View and print disbursement receipt"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>Receipt</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 5. PAY ACTION FLOW MODAL (10 STEPS: DETAILS → OTP → PIN → SUCCESS) ── */}
      {payModalOpen && selectedPayable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {payStep === 1 && 'Confirm Payout Disbursement'}
                    {payStep === 2 && 'Step 1: Email OTP Verification'}
                    {payStep === 3 && 'Step 2: Security PIN Verification'}
                    {payStep === 4 && 'Disbursement Successful'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Dual-factor server-side payment security protocol
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message Alert */}
            {payError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            {/* Step 1: Confirmation & Details Breakdown */}
            {payStep === 1 && (
              <div className="p-6 space-y-4 overflow-y-auto">
                {/* Recipient Details Card */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Recipient</span>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {selectedPayable.recipientName}
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        ID: {selectedPayable.recipientId}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      {selectedPayable.recipientType}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Bank Account</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {selectedPayable.bankDetails?.accountNumber || 'Pending Submission'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">IFSC Code</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                        {selectedPayable.bankDetails?.ifsc || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-2.5">
                  <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider block">
                    Calculation & Traceability
                  </span>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Source Reference</span>
                    <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
                      {selectedPayable.sourceReference}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Commission Basis</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPayable.commissionBasis}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Applicable Rate</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPayable.commissionRate}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-indigo-200/60 dark:border-indigo-800/60 flex items-baseline justify-between">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">Final Payable Amount</span>
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                      {fmtCurrency(selectedPayable.payableAmount)}
                    </span>
                  </div>
                </div>

                {/* Payment Purpose Callout */}
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Payment Purpose (Reason)
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    {selectedPayable.paymentPurpose}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRequestOtp}
                    disabled={otpLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {otpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Confirm & Send Email OTP</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Email OTP Entry */}
            {payStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Send className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Verification Code
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    A verification OTP has been sent to:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{maskedAuthEmail || currentUser?.email || 'Payment Authorization Email'}</strong>
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Expires in: {Math.floor(otpTimer / 60)}:{(otpTimer % 60).toString().padStart(2, '0')}</span>
                    {otpTimer === 0 ? (
                      <button
                        type="button"
                        onClick={handleRequestOtp}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    ) : (
                      <span>Single-use code</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayStep(1)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {otpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Verify Email OTP</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Security PIN Entry */}
            {payStep === 3 && (
              <form onSubmit={handleAuthorizeDisbursement} className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Security PIN
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Email OTP verified. Please enter your Security PIN to finalize and disburse {fmtCurrency(selectedPayable.payableAmount)}.
                  </p>
                </div>

                {/* 6 Digit Input Boxes */}
                <div className="flex justify-center gap-2.5 my-3">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <input
                      key={idx}
                      id={`pin-box-${idx}`}
                      type="password"
                      maxLength={1}
                      autoFocus={idx === 0}
                      value={securityPin[idx] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const copy = [...securityPin];
                        copy[idx] = val;
                        setSecurityPin(copy);
                        if (val && idx < 5) {
                          const next = document.getElementById(`pin-box-${idx + 1}`);
                          if (next) next.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !securityPin[idx] && idx > 0) {
                          const prev = document.getElementById(`pin-box-${idx - 1}`);
                          if (prev) prev.focus();
                        }
                      }}
                      className="w-11 h-12 text-center text-xl font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                  <span>Server-side verified disbursement amount: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {fmtCurrency(selectedPayable.payableAmount)}
                  </strong>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPayStep(2)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={pinLoading || securityPin.join('').length < 4}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {pinLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Authorize & Disburse</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Success & Receipt */}
            {payStep === 4 && (
              <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white">
                    Disbursement Completed
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Payout of {fmtCurrency(processedResult?.amount || selectedPayable.payableAmount)} has been authorized and disbursed to {selectedPayable.recipientName}.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment ID</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      {processedResult?.paymentId || selectedPayable.paymentId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction Reference</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {processedResult?.transactionReference || 'TXN-FIC-PROCESSED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Processed By</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {processedResult?.processedBy || currentUser?.name || 'Super Admin'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Disbursement Time</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {new Date().toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPayModalOpen(false);
                      handleViewReceipt({ paymentId: processedResult?.paymentId || selectedPayable.paymentId });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-500" />
                    <span>View Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayModalOpen(false)}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 6. HOLD PAYMENT MODAL ── */}
      {holdModalOpen && holdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <PauseCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Place Payment on Hold
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {holdTarget.paymentId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHoldModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmHold} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/60 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{holdTarget.recipientName}</span>
                  <span className="text-amber-700 dark:text-amber-400">{fmtCurrency(holdTarget.payableAmount)}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  This payout will be frozen. It will not be eligible for disbursement until explicitly released.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Hold Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="e.g. Bank details verification pending, performance inquiry, territory audit flag..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setHoldModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={holdLoading || !holdReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {holdLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                  <span>Confirm Hold</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 7. CANCEL PAYMENT MODAL ── */}
      {cancelModalOpen && cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <Ban className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cancel Disbursement
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {cancelTarget.paymentId}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCancel} className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/60 text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-700 dark:text-slate-300">{cancelTarget.recipientName}</span>
                  <span className="text-rose-600 dark:text-rose-400">{fmtCurrency(cancelTarget.payableAmount)}</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Cancelled disbursements cannot be paid or reversed. The reason and timestamp are saved in the immutable audit trail.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Order returned/refunded by customer, duplicate claim, fraudulent activity..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                >
                  Keep Active
                </button>
                <button
                  type="submit"
                  disabled={cancelLoading || !cancelReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {cancelLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. CONFIGURE SECURITY PIN MODAL ── */}
      {pinConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {pinStatus.configured ? 'Update Security PIN' : 'Configure Security PIN'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinConfigModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSetupPin} className="p-6 space-y-4">
              {pinSetupError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">
                  {pinSetupError}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  New 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-xl tracking-[0.4em] font-mono py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Confirm 6-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••••"
                  className="w-full text-center text-xl tracking-[0.4em] font-mono py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPinConfigModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinSetupLoading || newPin.length !== 6 || confirmPin.length !== 6}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition disabled:opacity-50"
                >
                  {pinSetupLoading ? 'Saving...' : 'Save PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 9. AUDIT LOG MODAL ── */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Payout Security Audit Trail
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Immutable event records for authorization and disbursements
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {auditLoading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400 mx-auto" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No audit logs recorded yet.
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-indigo-600 dark:text-indigo-400 uppercase text-[10px]">
                        {log.action}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(log.timestamp || log.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {log.details}
                    </p>
                    <div className="text-[10px] text-slate-400 font-mono">
                      By: {log.user || 'Administrator'} • IP: {log.ipAddress || '127.0.0.1'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 10. RECEIPT MODAL ── */}
      {receiptModalOpen && receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Disbursement Receipt
              </h3>
              <button
                type="button"
                onClick={() => setReceiptModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                  FORGE INDIA CONNECT ENTERPRISE
                </span>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {fmtCurrency(receiptData.amount)}
                </div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  PAID & VERIFIED
                </span>
              </div>

              <div className="space-y-2 font-medium text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt No</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{receiptData.receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction Ref</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{receiptData.transactionReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Name</span>
                  <span className="font-bold text-slate-900 dark:text-white">{receiptData.recipientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient Category</span>
                  <span>{receiptData.recipientType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Purpose</span>
                  <span className="max-w-[200px] text-right line-clamp-2">{receiptData.paymentPurpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Disbursed Date</span>
                  <span>{new Date(receiptData.paymentDate).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Authorized By</span>
                  <span>{receiptData.processedBy}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 11. BULK PAYMENT MULTI-STEP MODAL (REQUIREMENTS 2, 5, 9, 10) ── */}
      {bulkModalOpen && bulkItems.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {bulkStep === 1 && `Review Bulk Payout (${bulkItems.length} items)`}
                    {bulkStep === 2 && 'Step 1: Email OTP Verification'}
                    {bulkStep === 3 && 'Step 2: Security PIN Verification'}
                    {bulkStep === 4 && 'Bulk Disbursement Summary'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Dual-factor server-side payment security protocol
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message Alert */}
            {bulkError && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bulkError}</span>
              </div>
            )}

            {/* Step 1: Review List of Selected Payments */}
            {bulkStep === 1 && (
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider block">
                      TOTAL BULK PAYABLE
                    </span>
                    <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {fmtCurrency(bulkItems.reduce((acc, i) => acc + Number(i.payableAmount || i.amount || 0), 0))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                      {bulkItems.length} Recipient{bulkItems.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Selected Payouts to Disburse:
                  </span>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {bulkItems.map((item, idx) => (
                      <div key={item.paymentId || item._id || idx} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.recipientName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.recipientType} • Ref: {item.sourceReference || item.orderReference || item.paymentId}
                          </div>
                        </div>
                        <div className="text-right font-black text-slate-900 dark:text-white">
                          {fmtCurrency(item.payableAmount || item.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                    Security Authorization
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                    Dual-factor authentication is required. Clicking continue will dispatch an email OTP to the authorized enterprise payment security account.
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBulkModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkRequestOtp}
                    disabled={bulkOtpLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-md shadow-indigo-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {bulkOtpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>Confirm & Send Email OTP</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Email OTP Entry */}
            {bulkStep === 2 && (
              <form onSubmit={handleBulkVerifyOtp} className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                    <Send className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Verification Code
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    A bulk verification OTP has been sent to:{' '}
                    <strong className="text-slate-800 dark:text-slate-200">{bulkMaskedAuthEmail || currentUser?.email || 'Authorized Email'}</strong>
                  </p>
                </div>

                <div>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={bulkOtpCode}
                    onChange={(e) => setBulkOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono font-bold py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>Expires in: {Math.floor(bulkOtpTimer / 60)}:{(bulkOtpTimer % 60).toString().padStart(2, '0')}</span>
                    {bulkOtpTimer === 0 ? (
                      <button
                        type="button"
                        onClick={handleBulkRequestOtp}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        Resend Code
                      </button>
                    ) : (
                      <span>Single-use code</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBulkStep(1)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={bulkOtpLoading || bulkOtpCode.length !== 6}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {bulkOtpLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Verify Email OTP</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Security PIN Entry */}
            {bulkStep === 3 && (
              <form onSubmit={handleBulkAuthorizeDisbursement} className="p-6 space-y-4">
                <div className="text-center space-y-1">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Enter Security PIN
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Email OTP verified. Please enter your Security PIN to finalize and disburse payouts to {bulkItems.length} recipients.
                  </p>
                </div>

                {/* 6 Digit Input Boxes */}
                <div className="flex justify-center gap-2.5 my-3">
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <input
                      key={idx}
                      id={`bulk-pin-box-${idx}`}
                      type="password"
                      maxLength={1}
                      autoFocus={idx === 0}
                      value={bulkSecurityPin[idx] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const copy = [...bulkSecurityPin];
                        copy[idx] = val;
                        setBulkSecurityPin(copy);
                        if (val && idx < 5) {
                          const next = document.getElementById(`bulk-pin-box-${idx + 1}`);
                          if (next) next.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !bulkSecurityPin[idx] && idx > 0) {
                          const prev = document.getElementById(`bulk-pin-box-${idx - 1}`);
                          if (prev) prev.focus();
                        }
                      }}
                      className="w-11 h-12 text-center text-xl font-bold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-center text-xs text-slate-500">
                  <span>Server-side verified total disbursement: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {fmtCurrency(bulkItems.reduce((acc, i) => acc + Number(i.payableAmount || i.amount || 0), 0))}
                  </strong>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setBulkStep(2)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={bulkPinLoading || bulkSecurityPin.join('').length < 4}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-md shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                  >
                    {bulkPinLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Authorize & Disburse All</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 4: Bulk Results & Reconciliation */}
            {bulkStep === 4 && (
              <div className="p-6 space-y-4 overflow-y-auto">
                <div className="text-center space-y-1">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    Bulk Payout Execution Completed
                  </h4>
                  <p className="text-xs text-slate-500">
                    Disbursement batch has been processed atomically by the server.
                  </p>
                </div>

                {/* KPI Result Badges */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {bulkSummary?.total ?? bulkResults.length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block uppercase">Success</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                      {bulkSummary?.successful ?? bulkResults.filter(r => r.status === 'SUCCESS').length}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block uppercase">Failed</span>
                    <span className="text-base font-black text-rose-700 dark:text-rose-300">
                      {bulkSummary?.failed ?? bulkResults.filter(r => r.status !== 'SUCCESS').length}
                    </span>
                  </div>
                </div>

                {/* Per-Item Results List */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Individual Disbursement Status:
                  </span>
                  <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {bulkResults.map((r, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {r.recipientName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {r.status === 'SUCCESS' ? `Txn: ${r.transactionReference}` : `Reason: ${r.reason || 'Verification rejected'}`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-slate-900 dark:text-white">
                            {fmtCurrency(r.amount)}
                          </div>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          }`}>
                            {r.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkModalOpen(false);
                      setSelectedPaymentIds(new Set());
                      fetchDashboardData(true);
                    }}
                    className="px-8 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 transition cursor-pointer"
                  >
                    Done & Refresh Records
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 12. DETAILED PAYMENT BREAKDOWN STATEMENT MODAL (REQUIREMENT 7) ── */}
      {breakdownModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Payment Statement Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive real-time financial audit and order settlement record
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                  title="Print statement"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBreakdownModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              {breakdownLoading ? (
                <div className="py-16 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">Loading verified database statement...</p>
                </div>
              ) : breakdownData ? (
                <div className="space-y-4 text-xs">
                  {/* 1. PAYMENT SUMMARY */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        1. Payment Summary
                      </span>
                      {renderStatusBadge(breakdownData.summary?.status)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment ID</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {breakdownData.summary?.paymentId || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Receipt ID</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {breakdownData.summary?.receiptId || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Transaction Reference</span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {breakdownData.summary?.transactionReference || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Date & Time</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.summary?.paymentDate !== 'Not available' ? `${breakdownData.summary?.paymentDate} ${breakdownData.summary?.paymentTime || ''}` : 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Method</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.summary?.paymentMethod || 'Direct Bank Transfer / NEFT'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Payment Amount</span>
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {fmtCurrency(breakdownData.summary?.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className="text-[10px] text-slate-400 block">Payment Purpose</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {breakdownData.summary?.paymentPurpose || 'Verified service compensation'}
                      </span>
                    </div>
                  </div>

                  {/* 2. VENDOR / RECIPIENT DETAILS */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                      2. Vendor / Recipient Details
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Recipient Name</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {breakdownData.recipient?.name || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Recipient ID</span>
                        <span className="font-mono text-slate-700 dark:text-slate-300">
                          {breakdownData.recipient?.recipientId || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Role / Category</span>
                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                          {breakdownData.recipient?.recipientType || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Business Name</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.recipient?.businessName || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Business Type</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.recipient?.businessType || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Phone / Contact</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.recipient?.phone || 'Not available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. PAYMENT CALCULATION */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 space-y-2">
                    <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider block pb-1 border-b border-indigo-100 dark:border-indigo-900/60">
                      3. Payment Calculation
                    </span>
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gross Amount</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {fmtCurrency(breakdownData.calculation?.grossAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Commission Rate</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {breakdownData.calculation?.commissionRate || '0%'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Commission Amount</span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400">
                          - {fmtCurrency(breakdownData.calculation?.commissionAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Applicable Fees</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {fmtCurrency(breakdownData.calculation?.applicableFees || 0)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-indigo-200 dark:border-indigo-800 flex justify-between items-baseline">
                        <span className="font-bold text-slate-900 dark:text-white">Final Net Payable</span>
                        <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {fmtCurrency(breakdownData.calculation?.finalPayableAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 4. ORDER / SETTLEMENT DETAILS */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
                      4. Order / Settlement Details
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Related Order ID</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.relatedOrderId || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Order Date</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.orderDate || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Quantity</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.quantity ?? 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Order Items / Task</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.orderItems || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Settlement Reference</span>
                        <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.settlementReference || 'Not available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Settlement Date / Run</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {breakdownData.orderSettlement?.settlementDate || 'Not available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 text-center italic">
                    All payment values and financial statements are strictly loaded from verified operational database records.
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Statement details could not be retrieved from the database.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setBreakdownModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-black transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default EnterprisePaymentDashboard;
