import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, Users, Award, Download, Plus, Filter, Search, RefreshCw,
  CheckCircle, Clock, FileText, Calculator, ChevronRight, X, AlertCircle,
  Shield, Key, Send, AlertTriangle, ArrowRight, Printer, Check, MapPin, Building
} from 'lucide-react';

export const PayrollManagement = React.memo(({ token, API_BASE, currentUser, onToast }) => {
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [kpi, setKpi] = useState({
    totalSalary: 0,
    commissionPaid: 0,
    pendingSalary: 0,
    currentMonthPayroll: 0
  });

  // Territories from Database
  const [territoryStates, setTerritoryStates] = useState([]);
  const [territoryDistricts, setTerritoryDistricts] = useState([]);
  const [territoryDivisions, setTerritoryDivisions] = useState([]);
  const [territoryPincodes, setTerritoryPincodes] = useState([]);

  // Filters (Section 18)
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeType, setEmployeeType] = useState('all');
  const [status, setStatus] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [districtFilter, setDistrictFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [pincodeFilter, setPincodeFilter] = useState('all');
  const [salaryMonth, setSalaryMonth] = useState('September');

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedPayrollView, setSelectedPayrollView] = useState(null);

  // Cancellation Modal (Section 22)
  const [cancelModalItem, setCancelModalItem] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Security Verification Workflow States (Email OTP -> PIN -> Final Confirmation) (Sections 21 & 23)
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityStep, setSecurityStep] = useState(1);
  const [activePaymentAction, setActivePaymentAction] = useState(null); // { type: 'single' | 'bulk', payrollId?, department?, count?, amount?, name? }
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || '');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [processingSuccess, setProcessingSuccess] = useState(null);

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  // Fetch Territory Hierarchy
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
      console.error('Territory error in payroll:', err);
    }
  }, [API_BASE, token]);

  // Cascade Filtering for Territory Dropdowns
  const availableDistricts = useMemo(() => {
    if (!stateFilter || stateFilter === 'all') return territoryDistricts;
    return territoryDistricts.filter(d => (d.stateName || d.state || '').toLowerCase() === stateFilter.toLowerCase());
  }, [stateFilter, territoryDistricts]);

  const availableDivisions = useMemo(() => {
    if (!districtFilter || districtFilter === 'all') return territoryDivisions;
    return territoryDivisions.filter(div => (div.districtName || div.district || '').toLowerCase() === districtFilter.toLowerCase());
  }, [districtFilter, territoryDivisions]);

  const availablePincodes = useMemo(() => {
    if (!divisionFilter || divisionFilter === 'all') return territoryPincodes;
    return territoryPincodes.filter(p => (p.divisionName || p.division || '').toLowerCase() === divisionFilter.toLowerCase());
  }, [divisionFilter, territoryPincodes]);

  // Fetch Payroll Data
  const fetchPayrollData = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        department,
        role: roleFilter,
        employeeType,
        status,
        state: stateFilter,
        district: districtFilter,
        division: divisionFilter,
        pincode: pincodeFilter,
        month: salaryMonth
      });

      const res = await fetch(`${API_BASE}/admin/enterprise/payroll?${query.toString()}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data.payrolls || []);
        if (data.kpi) setKpi(data.kpi);
      }
    } catch (err) {
      console.error('Fetch payroll error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, department, roleFilter, employeeType, status, stateFilter, districtFilter, divisionFilter, pincodeFilter, salaryMonth, API_BASE, token]);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

  useEffect(() => {
    fetchTerritories();
  }, [fetchTerritories]);

  // Handle Manual Generate Entry
  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payroll/generate`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowGenerateModal(false);
        toast('New payroll record processed!', 'success');
        fetchPayrollData();
      }
    } catch (err) {
      console.error('Generate payroll error:', err);
    }
  };

  // Start Payment Security Verification (Single / Bulk)
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

  // Handle OTP Send
  const handleSendOtp = async () => {
    if (!adminEmail || !adminEmail.trim()) {
      setSecurityError('Enter registered administrator email address.');
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
        toast('Verification code sent to registered administrator email.', 'success');
      } else {
        setSecurityError(data.msg || 'Failed to send OTP.');
      }
    } catch (err) {
      setSecurityError('Connection error sending verification code.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Handle OTP Verification
  const handleVerifyOtp = async () => {
    if (!otpInput || otpInput.trim().length !== 6) {
      setSecurityError('Please enter 6-digit code.');
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
        setSecurityStep(2);
        toast('Email verified. Enter your 6-digit PIN.', 'success');
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

    if (value && index < 5) {
      const nextInput = document.getElementById(`payroll-pin-digit-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handlePinKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !pinDigits[index] && index > 0) {
      const prevInput = document.getElementById(`payroll-pin-digit-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Handle PIN Verification
  const handleVerifyPin = async () => {
    const fullPin = pinDigits.join('');
    if (fullPin.length !== 6) {
      setSecurityError('Please enter all 6 digits of your PIN.');
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
        setSecurityStep(3); // Final Confirmation
      } else {
        setSecurityError(data.msg || 'Incorrect PIN.');
      }
    } catch (err) {
      setSecurityError('Error verifying PIN.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Execute Final Payroll Payment (Single or Bulk)
  const handleExecutePayrollPayment = async () => {
    setSecurityLoading(true);
    setSecurityError('');
    try {
      let endpoint = `${API_BASE}/admin/enterprise/payroll/pay`;
      let payload = {
        verificationToken,
        notes: 'Disbursed via Super Admin Payroll Gateway'
      };

      if (activePaymentAction.type === 'bulk') {
        endpoint = `${API_BASE}/admin/enterprise/payroll/pay-bulk`;
        payload.department = activePaymentAction.department;
      } else {
        payload.payrollId = activePaymentAction.payrollId;
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
        toast(data.msg || 'Salary payment disbursed successfully!', 'success');
        fetchPayrollData();
      } else {
        setSecurityError(data.msg || 'Payment failed.');
      }
    } catch (err) {
      setSecurityError('Critical error during payroll processing.');
    } finally {
      setSecurityLoading(false);
    }
  };

  // Open Cancel Payroll Modal (Section 22)
  const handleOpenCancel = (item) => {
    setCancelModalItem(item);
    setCancelReason('');
  };

  const handleExecuteCancel = async () => {
    if (!cancelReason || !cancelReason.trim()) {
      toast('Cancellation reason is required.', 'error');
      return;
    }
    setCancelLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payroll/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          payrollId: cancelModalItem._id,
          cancellationReason: cancelReason.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast('Payroll record cancelled successfully.', 'success');
        setCancelModalItem(null);
        fetchPayrollData();
      } else {
        toast(data.msg || 'Failed to cancel payroll.', 'error');
      }
    } catch (err) {
      toast('Error executing payroll cancellation.', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  // Helper for Bulk Pay per department
  const triggerBulkPay = (deptName) => {
    const eligible = payrolls.filter(p => {
      const isUnpaid = (p.paymentStatus || '').toLowerCase() === 'pending';
      if (!isUnpaid) return false;
      if (deptName === 'All Employees') return true;
      return (p.department || '').toLowerCase().includes(deptName.toLowerCase());
    });

    if (eligible.length === 0) {
      toast(`No eligible pending payroll records found for ${deptName}.`, 'info');
      return;
    }

    const total = eligible.reduce((acc, p) => acc + (p.netSalary || p.salary || 0), 0);

    startSecurityVerification({
      type: 'bulk',
      department: deptName,
      count: eligible.length,
      amount: total,
      name: `${eligible.length} Employees in ${deptName}`
    });
  };

  return (
    <div className="space-y-6 pb-20 font-sans">

      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-black">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Payroll Management</h2>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                  HR & Disbursements
                </span>
              </div>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Departmental salary disbursements, territory filtering, OTP/PIN authorization, and automated net payouts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Process Payroll
          </button>
          <button
            onClick={fetchPayrollData}
            title="Refresh Payroll"
            className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. PAYROLL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Salary Outflow</span>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">
            ₹{(kpi.totalSalary || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Gross Budget</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Commission Disbursed</span>
          <span className="block text-2xl font-black text-amber-600 dark:text-amber-400">
            ₹{(kpi.commissionPaid || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Agent & Merchant</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">Current Month Payroll</span>
          <span className="block text-2xl font-black text-purple-600 dark:text-purple-400">
            ₹{(kpi.currentMonthPayroll || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">{salaryMonth} 2026</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Pending Salary</span>
          <span className="block text-2xl font-black text-rose-600 dark:text-rose-400">
            ₹{(kpi.pendingSalary || 0).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Awaiting Super Admin Approval</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTION 23: PAYROLL BULK PAYMENT ACTION BUTTONS                        */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-primary-600" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Departmental Bulk Salary Disbursements (OTP & PIN Protected)
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400">1-Click Bulk Run</span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {[
            { label: 'Pay All Admin Staff', dept: 'Admin Staff' },
            { label: 'Pay All Managers', dept: 'Managers' },
            { label: 'Pay All KYC Team', dept: 'KYC Team' },
            { label: 'Pay All Payment Team', dept: 'Payment Team' },
            { label: 'Pay All Customer Support', dept: 'Customer Support' },
            { label: 'Pay All Employees', dept: 'All Employees' }
          ].map((btn, idx) => (
            <button
              key={idx}
              onClick={() => triggerBulkPay(btn.dept)}
              className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200/80 dark:border-slate-800 hover:border-rose-500/30 text-slate-700 dark:text-slate-200 hover:text-rose-600 text-xs font-extrabold rounded-2xl flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-rose-500" /> {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. FILTERS TOOLBAR (DEPARTMENT, TERRITORY, MONTH, STATUS) (SECTION 18)    */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-200/70 dark:border-slate-850 space-y-3">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-3 py-2 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search Employee Name or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-semibold"
            />
          </div>

          {/* Department Filter (Section 18) */}
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="Admin Staff">Admin Staff</option>
            <option value="Managers">Managers</option>
            <option value="KYC Team">KYC Team</option>
            <option value="Payment Team">Payment Team</option>
            <option value="Customer Support">Customer Support</option>
            <option value="HR">HR</option>
            <option value="Agent Operations">Agent Operations</option>
            <option value="Logistics">Logistics</option>
            <option value="Technical Support">Technical Support</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Payment Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          {/* Salary Month */}
          <select
            value={salaryMonth}
            onChange={e => setSalaryMonth(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="September">September 2026</option>
            <option value="August">August 2026</option>
            <option value="July">July 2026</option>
            <option value="June">June 2026</option>
          </select>
        </div>

        {/* Dynamic Territory Hierarchy Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
          {/* State */}
          <select
            value={stateFilter}
            onChange={e => {
              setStateFilter(e.target.value);
              setDistrictFilter('all');
              setDivisionFilter('all');
              setPincodeFilter('all');
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All States</option>
            {territoryStates.map(st => (
              <option key={st._id} value={st.name}>{st.name}</option>
            ))}
          </select>

          {/* District */}
          <select
            value={districtFilter}
            onChange={e => {
              setDistrictFilter(e.target.value);
              setDivisionFilter('all');
              setPincodeFilter('all');
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Districts</option>
            {availableDistricts.map(d => (
              <option key={d._id} value={d.name}>{d.name}</option>
            ))}
          </select>

          {/* Division */}
          <select
            value={divisionFilter}
            onChange={e => {
              setDivisionFilter(e.target.value);
              setPincodeFilter('all');
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Divisions</option>
            {availableDivisions.map(div => (
              <option key={div._id} value={div.name}>{div.name}</option>
            ))}
          </select>

          {/* Pincode */}
          <select
            value={pincodeFilter}
            onChange={e => setPincodeFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Pincodes</option>
            {availablePincodes.map(p => (
              <option key={p._id} value={p.code}>{p.code}</option>
            ))}
          </select>
        </div>

        <div className="flex justify-between items-center text-xs pt-1 px-1">
          <span className="font-bold text-slate-400">
            Total Employees: <strong>{payrolls.length}</strong>
          </span>
          {(stateFilter !== 'all' || districtFilter !== 'all' || department !== 'all') && (
            <button
              onClick={() => {
                setStateFilter('all');
                setDistrictFilter('all');
                setDivisionFilter('all');
                setPincodeFilter('all');
                setDepartment('all');
              }}
              className="text-primary-600 font-bold hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. PAYROLL TABLE (SECTION 19)                                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
              <th className="py-3 px-3">Employee Name</th>
              <th className="py-3 px-3">ID & Role</th>
              <th className="py-3 px-3">Department</th>
              <th className="py-3 px-3">Territory</th>
              <th className="py-3 px-3">Month</th>
              <th className="py-3 px-3">Salary Amount</th>
              <th className="py-3 px-3">Due Date</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
            {payrolls.map((p) => (
              <tr key={p._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-850/40 transition-colors">
                
                {/* Employee Name */}
                <td className="py-3.5 px-3">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{p.employeeName}</span>
                  <span className="text-[10px] font-semibold text-slate-400">{p.employeeType || 'Employee'}</span>
                </td>

                {/* ID & Role */}
                <td className="py-3.5 px-3">
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 block">{p.employeeCode}</span>
                  <span className="text-[10px] text-slate-400">{p.role || 'Staff'}</span>
                </td>

                {/* Department */}
                <td className="py-3.5 px-3">
                  <span className="font-bold text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] inline-block">
                    {p.department}
                  </span>
                </td>

                {/* Territory */}
                <td className="py-3.5 px-3 text-[11px]">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 block">{p.territory?.state || 'Tamil Nadu'}</span>
                  <span className="text-slate-400 block text-[10px]">{p.territory?.district || '—'} / {p.territory?.pincode || '—'}</span>
                </td>

                {/* Month */}
                <td className="py-3.5 px-3 font-semibold text-slate-600 dark:text-slate-400">
                  {p.month || 'September'} {p.year || 2026}
                </td>

                {/* Salary Amount */}
                <td className="py-3.5 px-3">
                  <span className="font-black text-sm text-slate-900 dark:text-slate-100 block">
                    ₹{(p.netSalary || p.salary || 0).toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold block">
                    Base: ₹{(p.salary || 0).toLocaleString()}
                  </span>
                </td>

                {/* Due Date */}
                <td className="py-3.5 px-3 font-medium text-slate-600 dark:text-slate-400">
                  {p.dueDate ? new Date(p.dueDate).toLocaleDateString() : 'Immediate'}
                </td>

                {/* Payment Status */}
                <td className="py-3.5 px-3">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full inline-block ${
                    p.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                    p.paymentStatus === 'Cancelled' ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700' :
                    'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                  }`}>
                    {p.paymentStatus || 'Pending'}
                  </span>
                </td>

                {/* Actions: [View], [Pay], [Cancel] (Section 19) */}
                <td className="py-3.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setSelectedPayrollView(p)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-[11px] cursor-pointer"
                      title="View Details"
                    >
                      View
                    </button>

                    {(p.paymentStatus || '').toLowerCase() === 'pending' && (
                      <>
                        <button
                          onClick={() => startSecurityVerification({
                            type: 'single',
                            payrollId: p._id,
                            name: p.employeeName,
                            amount: p.netSalary || p.salary,
                            department: p.department
                          })}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] cursor-pointer shadow-xs active:scale-95"
                          title="Pay Salary"
                        >
                          Pay
                        </button>
                        <button
                          onClick={() => handleOpenCancel(p)}
                          className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 font-bold rounded-xl text-[11px] cursor-pointer"
                          title="Cancel Payroll Entry"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </td>

              </tr>
            ))}

            {payrolls.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-16 text-slate-400">
                  <Calculator className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold">No payroll records match your filter criteria.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 6. PAYROLL VIEW DETAILS MODAL (SECTION 20)                                */}
      {/* ========================================================================= */}
      {selectedPayrollView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 space-y-5 shadow-2xl my-6">
            
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">
                  Salary Details ({selectedPayrollView.employeeName})
                </h3>
              </div>
              <button onClick={() => setSelectedPayrollView(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Employee ID</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-sm mt-0.5">{selectedPayrollView.employeeCode}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Department & Designation</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{selectedPayrollView.department}</span>
                  <span className="text-[10px] text-slate-400">{selectedPayrollView.role}</span>
                </div>
              </div>

              {/* Salary Breakdown (Basic, Allowances, Deductions, Net) */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Compensation Breakdown</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Basic Salary</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹{(selectedPayrollView.salary || 0).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Allowances / Bonus</span>
                    <span className="font-bold text-emerald-600">+₹{((selectedPayrollView.bonus || 0) + (selectedPayrollView.commission || 0) + (selectedPayrollView.incentive || 0)).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Deductions (PF/ESI/Tax)</span>
                    <span className="font-bold text-rose-500">-₹{((selectedPayrollView.pf || 0) + (selectedPayrollView.esi || 0) + (selectedPayrollView.professionalTax || 0) + (selectedPayrollView.deduction || 0)).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Net Payable</span>
                    <span className="font-black text-slate-900 dark:text-slate-100 text-sm">₹{(selectedPayrollView.netSalary || selectedPayrollView.salary || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Bank & Territory */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 font-mono">
                  <span className="text-[10px] text-slate-400 font-black uppercase block font-sans">Bank Account</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{selectedPayrollView.bankAccountNumber || '••••••••1234'}</span>
                  <span className="text-[10px] text-slate-400 font-sans block">{selectedPayrollView.bankIfsc || 'SBIN0004567'} ({selectedPayrollView.bankName || 'State Bank'})</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Territory</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{selectedPayrollView.territory?.state || 'Tamil Nadu'}</span>
                  <span className="text-[10px] text-slate-400">{selectedPayrollView.territory?.district || 'Krishnagiri'} / {selectedPayrollView.territory?.pincode || '635109'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedPayrollView(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. CANCEL PAYROLL MODAL (SECTION 22)                                      */}
      {/* ========================================================================= */}
      {cancelModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl my-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                Cancel Payroll ({cancelModalItem.employeeName})
              </h3>
              <button onClick={() => setCancelModalItem(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 p-3 rounded-2xl text-amber-700 dark:text-amber-400 font-medium">
                Mandatory cancellation reason required to revoke this payroll disbursement.
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
                  placeholder="Enter reason for cancelling payroll record..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 text-xs font-semibold focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCancelModalItem(null)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-2xl cursor-pointer"
              >
                Keep Record
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || cancelLoading}
                onClick={handleExecuteCancel}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : 'Cancel Payroll'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. 3-STEP SECURITY VERIFICATION MODAL FOR PAYROLL (SECTION 21 & 23)       */}
      {/* ========================================================================= */}
      {securityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl my-6">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-black">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                      Payroll Authorization Gateway
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

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className={`h-1.5 rounded-full ${securityStep >= 1 ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full ${securityStep >= 2 ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                <div className={`h-1.5 rounded-full ${securityStep >= 3 ? 'bg-cyan-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
              </div>
            </div>

            {securityError && (
              <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-600 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{securityError}</span>
              </div>
            )}

            {processingSuccess ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Payroll Disbursed Successfully!</h4>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Salary disbursement has been committed to the ledger with transaction reference:
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 text-xs text-left font-mono">
                  <div>Reference: <span className="font-bold text-slate-800 dark:text-slate-200">{processingSuccess.transactionReference || processingSuccess.batchReference || 'TXN-PR-SUCCESS'}</span></div>
                  <div>Status: <span className="font-bold text-emerald-600">PAID</span></div>
                </div>

                <div className="flex justify-center gap-2 pt-2">
                  <button
                    onClick={() => setSecurityModalOpen(false)}
                    className="px-6 py-2.5 bg-primary-600 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-md"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* STEP 1: EMAIL OTP */}
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
                          className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-2xl text-xs cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {otpSent ? 'Resend' : 'Send Code'}
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-2 pt-2">
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
                      </div>
                    )}

                    <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSecurityModalOpen(false)}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-2xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!otpSent || otpInput.length !== 6 || securityLoading}
                        onClick={handleVerifyOtp}
                        className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {securityLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Verify & Continue <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: 6-DIGIT PIN */}
                {securityStep === 2 && (
                  <div className="space-y-4 text-xs">
                    <div className="text-center space-y-1">
                      <label className="block font-black text-slate-800 dark:text-slate-100 text-sm">
                        Enter 6-Digit Payment PIN
                      </label>
                      <span className="text-[11px] text-slate-400 font-medium">
                        Enter confidential PIN to disburse payroll
                      </span>
                    </div>

                    <div className="flex justify-center gap-2.5 py-2">
                      {[0, 1, 2, 3, 4, 5].map((idx) => (
                        <input
                          key={idx}
                          id={`payroll-pin-digit-${idx}`}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          value={pinDigits[idx]}
                          onChange={(e) => handlePinDigitChange(idx, e.target.value)}
                          onKeyDown={(e) => handlePinKeyDown(idx, e)}
                          className="w-11 h-13 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-xl font-mono font-black focus:border-cyan-500 focus:outline-none"
                        />
                      ))}
                    </div>

                    <div className="pt-3 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSecurityModalOpen(false)}
                        className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-2xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={pinDigits.join('').length !== 6 || securityLoading}
                        onClick={handleVerifyPin}
                        className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold rounded-2xl cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {securityLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        Authorize PIN <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: FINAL CONFIRMATION */}
                {securityStep === 3 && (
                  <div className="space-y-4 text-xs">
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-500/20 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-rose-600 font-black text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>Confirm Payroll Disbursement?</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Are you sure you want to process this salary payment? This operation will mark salaries as PAID and synchronize accounts.
                      </p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Run / Recipient:</span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100">{activePaymentAction?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Total Net Amount:</span>
                        <span className="font-black text-rose-600 text-sm">₹{(activePaymentAction?.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Period:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">September 2026</span>
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
                        onClick={handleExecutePayrollPayment}
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
      {/* 9. PROCESS NEW PAYROLL ENTRY MODAL                                        */}
      {/* ========================================================================= */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Process & Generate Payroll</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Employee Name</label>
                <input name="employeeName" required type="text" placeholder="e.g. Rahul Sharma" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Employee Type</label>
                  <select name="employeeType" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold">
                    <option value="Employee">Employee</option>
                    <option value="Agent">Agent</option>
                    <option value="Commission Based">Commission Based</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Department</label>
                  <select name="department" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold">
                    <option value="Admin Staff">Admin Staff</option>
                    <option value="Managers">Managers</option>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Payment Team">Payment Team</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="HR">HR</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Base Salary (₹)</label>
                  <input name="salary" type="number" defaultValue="35000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Bonus (₹)</label>
                  <input name="bonus" type="number" defaultValue="5000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Commission (₹)</label>
                  <input name="commission" type="number" defaultValue="2500" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">PF (₹)</label>
                  <input name="pf" type="number" defaultValue="1800" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">ESI (₹)</label>
                  <input name="esi" type="number" defaultValue="500" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Deduction (₹)</label>
                  <input name="deduction" type="number" defaultValue="0" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-2xl p-2.5 text-xs font-semibold" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2.5 bg-primary-600 text-white font-extrabold rounded-2xl shadow-md cursor-pointer">
                  Generate Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
});

export default PayrollManagement;
