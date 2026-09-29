import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CreditCard, Store, ShieldCheck, CheckCircle2, Clock, AlertTriangle,
  Search, Filter, RefreshCw, X, ChevronRight, Eye, Calendar,
  TrendingUp, DollarSign, MapPin, Building, ArrowRight, Copy, Check,
  AlertCircle, ChevronDown, ChevronLeft, Layers, User, Phone, Mail,
  ExternalLink, Sparkles, FileText, Ban
} from 'lucide-react';

export default function VendorSubscriptionModule({ token, API_BASE, currentUser, onToast }) {
  // ── States ──
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Subscriptions & Summary
  const [subscriptions, setSubscriptions] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [summary, setSummary] = useState({
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    pendingPayments: 0,
    expiredSubscriptions: 0,
    monthlyRevenue: 0,
    totalRevenue: 0
  });

  // Filter options from backend
  const [filterOptions, setFilterOptions] = useState({
    states: [],
    districts: {},
    divisions: {},
    pincodes: {},
    businessTypes: ['Products', 'Services', 'Stay', 'Food'],
    subscriptionStatuses: ['ACTIVE', 'PENDING', 'EXPIRED', 'PAYMENT PENDING', 'PAYMENT FAILED', 'SUSPENDED'],
    paymentStatuses: ['PAID', 'PENDING', 'FAILED', 'REFUNDED'],
    billingCycles: ['Monthly']
  });

  // Active filters
  const [search, setSearch] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedDivision, setSelectedDivision] = useState('all');
  const [selectedPincode, setSelectedPincode] = useState('all');
  const [selectedBusinessType, setSelectedBusinessType] = useState('all');
  const [selectedSubStatus, setSelectedSubStatus] = useState('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('all');
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('all');
  const [dateRange, setDateRange] = useState('all'); // all, today, this_month, last_month, this_year, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Selected subscription for Drawer / Modal View
  const [viewingSubscription, setViewingSubscription] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Helper toast notification
  const notify = useCallback((msg, type = 'info') => {
    if (typeof onToast === 'function') {
      onToast(msg, type);
    } else {
      console.log(`[Toast ${type}]: ${msg}`);
    }
  }, [onToast]);

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    notify(`Copied ${fieldName} to clipboard`, 'success');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ── 1. Fetch Filter Options ──
  const fetchFilterOptions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vendor-subscriptions/filters`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.filters) {
          setFilterOptions(prev => ({
            ...prev,
            ...data.filters
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to load filter options:', err);
    }
  }, [API_BASE, token]);

  // ── 2. Fetch Summary Metrics ──
  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/vendor-subscriptions/summary`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch summary metrics:', err);
    }
  }, [API_BASE, token]);

  // ── 3. Fetch Subscriptions List ──
  const fetchSubscriptions = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const query = new URLSearchParams();
      query.set('page', currentPage.toString());
      query.set('limit', limit.toString());

      if (search.trim()) query.set('search', search.trim());
      if (selectedState !== 'all') query.set('state', selectedState);
      if (selectedDistrict !== 'all') query.set('district', selectedDistrict);
      if (selectedDivision !== 'all') query.set('division', selectedDivision);
      if (selectedPincode !== 'all') query.set('pincode', selectedPincode);
      if (selectedBusinessType !== 'all') query.set('businessType', selectedBusinessType);
      if (selectedSubStatus !== 'all') query.set('subscriptionStatus', selectedSubStatus);
      if (selectedPaymentStatus !== 'all') query.set('paymentStatus', selectedPaymentStatus);
      if (selectedBillingCycle !== 'all') query.set('billingCycle', selectedBillingCycle);

      if (dateRange !== 'all') {
        query.set('dateRange', dateRange);
        if (dateRange === 'custom') {
          if (customStartDate) query.set('startDate', customStartDate);
          if (customEndDate) query.set('endDate', customEndDate);
        }
      }

      const res = await fetch(`${API_BASE}/admin/vendor-subscriptions?${query.toString()}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`Failed to load vendor subscriptions (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
        setTotalRecords(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error(data.message || 'Error retrieving records');
      }
    } catch (err) {
      console.error('Fetch subscriptions error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    API_BASE, token, currentPage, limit, search,
    selectedState, selectedDistrict, selectedDivision, selectedPincode,
    selectedBusinessType, selectedSubStatus, selectedPaymentStatus,
    selectedBillingCycle, dateRange, customStartDate, customEndDate
  ]);

  // Initial load
  useEffect(() => {
    fetchFilterOptions();
    fetchSummary();
  }, [fetchFilterOptions, fetchSummary]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  // Fetch full details for a subscription view drawer
  const handleOpenDetails = async (sub) => {
    setDrawerLoading(true);
    setViewingSubscription(sub); // preliminary display
    try {
      const res = await fetch(`${API_BASE}/admin/vendor-subscriptions/${sub.subscriptionId || sub._id}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.subscription) {
          setViewingSubscription(data.subscription);
        }
      }
    } catch (e) {
      console.warn('Error loading detail drawer:', e);
    } finally {
      setDrawerLoading(false);
    }
  };

  // ── Cascading Dropdown Logic ──
  const availableDistricts = useMemo(() => {
    if (selectedState === 'all' || !filterOptions.districts[selectedState]) {
      // If all states, return union of all districts
      const allDistricts = new Set();
      Object.values(filterOptions.districts || {}).forEach(arr => arr.forEach(d => allDistricts.add(d)));
      return Array.from(allDistricts).sort();
    }
    return filterOptions.districts[selectedState] || [];
  }, [selectedState, filterOptions.districts]);

  const availableDivisions = useMemo(() => {
    if (selectedDistrict === 'all' || !filterOptions.divisions[selectedDistrict]) {
      const allDivs = new Set();
      Object.values(filterOptions.divisions || {}).forEach(arr => arr.forEach(d => allDivs.add(d)));
      return Array.from(allDivs).sort();
    }
    return filterOptions.divisions[selectedDistrict] || [];
  }, [selectedDistrict, filterOptions.divisions]);

  const availablePincodes = useMemo(() => {
    if (selectedDivision === 'all' || !filterOptions.pincodes[selectedDivision]) {
      const allPins = new Set();
      Object.values(filterOptions.pincodes || {}).forEach(arr => arr.forEach(p => allPins.add(p)));
      return Array.from(allPins).sort();
    }
    return filterOptions.pincodes[selectedDivision] || [];
  }, [selectedDivision, filterOptions.pincodes]);

  // When State changes, reset dependent dropdowns
  const handleStateChange = (val) => {
    setSelectedState(val);
    setSelectedDistrict('all');
    setSelectedDivision('all');
    setSelectedPincode('all');
    setCurrentPage(1);
  };

  const handleDistrictChange = (val) => {
    setSelectedDistrict(val);
    setSelectedDivision('all');
    setSelectedPincode('all');
    setCurrentPage(1);
  };

  const handleDivisionChange = (val) => {
    setSelectedDivision(val);
    setSelectedPincode('all');
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedState('all');
    setSelectedDistrict('all');
    setSelectedDivision('all');
    setSelectedPincode('all');
    setSelectedBusinessType('all');
    setSelectedSubStatus('all');
    setSelectedPaymentStatus('all');
    setSelectedBillingCycle('all');
    setDateRange('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
    selectedState !== 'all' ||
    selectedDistrict !== 'all' ||
    selectedDivision !== 'all' ||
    selectedPincode !== 'all' ||
    selectedBusinessType !== 'all' ||
    selectedSubStatus !== 'all' ||
    selectedPaymentStatus !== 'all' ||
    selectedBillingCycle !== 'all' ||
    dateRange !== 'all'
  );

  // Status Badge Styling Helper
  const renderStatusBadge = (statusStr) => {
    const s = String(statusStr || 'PENDING').toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          ACTIVE
        </span>
      );
    }
    if (s === 'EXPIRED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <AlertCircle className="w-3 h-3 text-rose-500" />
          EXPIRED
        </span>
      );
    }
    if (s === 'PAYMENT PENDING' || s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-3 h-3 text-amber-500" />
          {s === 'PAYMENT PENDING' ? 'PAYMENT PENDING' : 'PENDING'}
        </span>
      );
    }
    if (s === 'PAYMENT FAILED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
          <Ban className="w-3 h-3 text-red-500" />
          PAYMENT FAILED
        </span>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
          <AlertTriangle className="w-3 h-3 text-slate-500" />
          SUSPENDED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
        {s}
      </span>
    );
  };

  // Payment Status Badge Helper
  const renderPaymentStatusBadge = (pStatus) => {
    const s = String(pStatus || '').toUpperCase();
    if (s === 'PAID' || s === 'SUCCESS') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
          PAID
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
          FAILED
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
          PENDING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        {s || 'UNPAID'}
      </span>
    );
  };

  // Business Type Badge Helper
  const renderBusinessTypeBadge = (type) => {
    const t = String(type || 'Products').trim();
    const colors = {
      Products: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
      Services: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
      Stay: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
      Food: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
      General: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20'
    };
    const c = colors[t] || colors.General;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${c}`}>
        {t}
      </span>
    );
  };

  // Format Date Helper
  const formatDate = (dateVal) => {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── HEADER & TITLE ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-500/10 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Vendor Subscriptions
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Manage and monitor business-wise vendor subscriptions, payments, validity, approvals, and territory information.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Real Database Sync
          </div>
          <button
            onClick={() => {
              fetchSubscriptions(true);
              fetchSummary();
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all disabled:opacity-50"
            title="Refresh subscription records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-500' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. SUMMARY CARDS (Top Metrics Scoped to Territory) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Subscriptions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Subscriptions</span>
            <Store className="w-4 h-4 text-blue-500" />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalSubscriptions}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Unique Businesses</span>
        </div>

        {/* Active Subscriptions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Active Subscriptions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary.activeSubscriptions}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Valid & Paid</span>
        </div>

        {/* Pending Payments */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Payments</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {summary.pendingPayments}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Awaiting Gateway</span>
        </div>

        {/* Expired Subscriptions */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">Expired</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {summary.expiredSubscriptions}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Lapsed Validity</span>
        </div>

        {/* Monthly Subscription Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-primary-600 dark:text-primary-400">Monthly Revenue</span>
            <TrendingUp className="w-4 h-4 text-primary-500" />
          </div>
          <span className="text-2xl font-black text-primary-600 dark:text-primary-400">
            ₹{summary.monthlyRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">Current Calendar Month</span>
        </div>

        {/* Total Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            ₹{summary.totalRevenue.toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-1">All-Time Territory Income</span>
        </div>
      </div>

      {/* ── 2. SEARCH & CASCADING FILTERS TOOLBAR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">
        {/* Search row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Vendor Name, Business Name, Business ID, Vendor ID, Payment ID..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-9 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 font-medium text-slate-900 dark:text-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2">
              Found: <strong className="text-slate-900 dark:text-white">{totalRecords}</strong>
            </span>
          </div>
        </div>

        {/* Cascaded Territory & Attribute Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          {/* 1. State Filter */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">State</label>
            <select
              value={selectedState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All States</option>
              {filterOptions.states.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 2. District Filter (Cascaded on State) */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Districts</option>
              {availableDistricts.map((dist) => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>

          {/* 3. Division Filter (Cascaded on District) */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Division</label>
            <select
              value={selectedDivision}
              onChange={(e) => handleDivisionChange(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Divisions</option>
              {availableDivisions.map((div) => (
                <option key={div} value={div}>{div}</option>
              ))}
            </select>
          </div>

          {/* 4. Pincode Filter (Cascaded on Division) */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Pincode</label>
            <select
              value={selectedPincode}
              onChange={(e) => {
                setSelectedPincode(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Pincodes</option>
              {availablePincodes.map((pin) => (
                <option key={pin} value={pin}>{pin}</option>
              ))}
            </select>
          </div>

          {/* 5. Business Type */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Business Type</label>
            <select
              value={selectedBusinessType}
              onChange={(e) => {
                setSelectedBusinessType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Types</option>
              {filterOptions.businessTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* 6. Subscription Status */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Sub Status</label>
            <select
              value={selectedSubStatus}
              onChange={(e) => {
                setSelectedSubStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Statuses</option>
              {filterOptions.subscriptionStatuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* 7. Payment Status */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Payment</label>
            <select
              value={selectedPaymentStatus}
              onChange={(e) => {
                setSelectedPaymentStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Payments</option>
              {filterOptions.paymentStatuses.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 8. Date Range Preset */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Date Period</label>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 truncate"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (Shown only when dateRange === 'custom') */}
        {dateRange === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-400">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-400">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-800 dark:text-slate-200 font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 3. DATA VIEW: TABLE (Desktop/Laptop) & CARDS (Mobile) ── */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-500/10 text-primary-500 animate-spin mb-4">
            <RefreshCw className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Loading Vendor Subscriptions...</h3>
          <p className="text-xs text-slate-400 mt-1">Connecting directly to live database records</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-3xl p-8 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">{error}</h3>
          <button
            onClick={() => fetchSubscriptions()}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">No subscriptions found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
            No real vendor business subscriptions match your selected filters or territory scope.
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="mt-5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP / LAPTOP TABLE VIEW (Hidden on Mobile) */}
          <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                    <th className="py-4 px-4 text-center w-12">#</th>
                    <th className="py-4 px-4 min-w-[200px]">Vendor / Business</th>
                    <th className="py-4 px-3">Business Type</th>
                    <th className="py-4 px-3">State</th>
                    <th className="py-4 px-3">District</th>
                    <th className="py-4 px-3">Division</th>
                    <th className="py-4 px-3">Pincode</th>
                    <th className="py-4 px-3">Monthly Plan & Fee</th>
                    <th className="py-4 px-3">Payment Date</th>
                    <th className="py-4 px-3">Valid Until</th>
                    <th className="py-4 px-3 min-w-[150px]">Approved By</th>
                    <th className="py-4 px-3 text-center">Status</th>
                    <th className="py-4 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                  {subscriptions.map((sub, idx) => {
                    const rowNum = (currentPage - 1) * limit + idx + 1;
                    return (
                      <tr
                        key={sub._id || sub.subscriptionId || idx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* 1. # Index */}
                        <td className="py-4 px-4 text-center font-bold text-slate-400 text-xs">
                          {rowNum}
                        </td>

                        {/* 2. Vendor / Business */}
                        <td className="py-4 px-4">
                          <div className="space-y-0.5">
                            <span className="block font-black text-slate-900 dark:text-white text-xs truncate max-w-[220px]">
                              {sub.businessName || 'Business Outlet'}
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                              Vendor: {sub.vendorName || 'Vendor'}
                            </span>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={sub.businessId}>
                                ID: {sub.businessId ? String(sub.businessId).slice(-8) : '—'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Business Type */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          {renderBusinessTypeBadge(sub.businessType)}
                        </td>

                        {/* 4. State */}
                        <td className="py-4 px-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                          {sub.state || '—'}
                        </td>

                        {/* 5. District */}
                        <td className="py-4 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {sub.district || '—'}
                        </td>

                        {/* 6. Division */}
                        <td className="py-4 px-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {sub.division || '—'}
                        </td>

                        {/* 7. Pincode */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <span className="font-mono font-bold text-[11px] text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-800">
                            {sub.pincode || '—'}
                          </span>
                        </td>

                        {/* 8. Monthly Plan & Fee */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <div>
                            <span className="block font-black text-slate-900 dark:text-white">
                              ₹{(sub.monthlyFee || sub.amount || 1000).toLocaleString('en-IN')}{' '}
                              <span className="text-[10px] font-normal text-slate-400">/ mo</span>
                            </span>
                            <span className="block text-[10px] text-slate-400 uppercase tracking-wide">
                              {sub.planName || 'Monthly Subscription'}
                            </span>
                          </div>
                        </td>

                        {/* 9. Payment Date */}
                        <td className="py-4 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-medium">
                          {formatDate(sub.paymentDate || sub.startDate)}
                        </td>

                        {/* 10. Valid Until */}
                        <td className="py-4 px-3 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDate(sub.validUntil || sub.endDate)}
                          </span>
                        </td>

                        {/* 11. Approved By */}
                        <td className="py-4 px-3">
                          <div className="truncate max-w-[160px]" title={sub.approvedBy || sub.approvedByName}>
                            <span className="block font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">
                              {sub.approvedByName || sub.approvedBy || 'Authorized Admin'}
                            </span>
                            <span className="block text-[10px] text-slate-400 truncate">
                              {sub.approvedByRole || 'Admin Approval'}
                            </span>
                          </div>
                        </td>

                        {/* 12. Status */}
                        <td className="py-4 px-3 text-center whitespace-nowrap">
                          {renderStatusBadge(sub.calculatedStatus || sub.status)}
                        </td>

                        {/* 13. Actions */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenDetails(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-primary-50 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-700 hover:text-primary-600 dark:text-slate-200 dark:hover:text-primary-400 font-bold text-xs transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MOBILE & TABLET CARD VIEW (Visible on small & medium screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-4">
            {subscriptions.map((sub, idx) => {
              const rowNum = (currentPage - 1) * limit + idx + 1;
              return (
                <div
                  key={sub._id || sub.subscriptionId || idx}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {rowNum}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white leading-snug">
                          {sub.businessName || 'Business Outlet'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Vendor: <span className="font-semibold text-slate-700 dark:text-slate-300">{sub.vendorName}</span>
                        </p>
                      </div>
                    </div>
                    <div>
                      {renderStatusBadge(sub.calculatedStatus || sub.status)}
                    </div>
                  </div>

                  {/* Territory Hierarchy in exact order: State ↓ District ↓ Division ↓ Pincode */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-primary-500" />
                      Location Hierarchy
                    </span>
                    <div className="flex items-center flex-wrap gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                      <span>{sub.state}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>{sub.district}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span>{sub.division}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400" />
                      <span className="text-primary-600 dark:text-primary-400">{sub.pincode}</span>
                    </div>
                  </div>

                  {/* Plan & Payment Meta */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Plan & Fee</span>
                      <span className="font-black text-slate-900 dark:text-white">
                        ₹{(sub.monthlyFee || sub.amount || 1000).toLocaleString('en-IN')}/mo
                      </span>
                      <span className="block text-[10px] text-slate-500">{sub.billingCycle || 'Monthly'}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Business Type</span>
                      {renderBusinessTypeBadge(sub.businessType)}
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Payment Date</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(sub.paymentDate || sub.startDate)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Valid Until</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {formatDate(sub.validUntil || sub.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Footer & Action */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500 truncate max-w-[60%]">
                      Approved: <strong className="text-slate-700 dark:text-slate-300">{sub.approvedByName || sub.approvedBy || 'Admin'}</strong>
                    </div>
                    <button
                      onClick={() => handleOpenDetails(sub)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary-600 text-white font-bold text-xs hover:bg-primary-700 transition-colors shadow-xs"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 shadow-xs text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400">Items per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-slate-400 ml-2">
                  Showing {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalRecords)} of {totalRecords}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-bold text-slate-700 dark:text-slate-200">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 4. DETAILED SUBSCRIPTION VIEW DRAWER / MODAL ── */}
      {viewingSubscription && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-slate-50/50 dark:bg-slate-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Subscription Details
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      ID: <strong className="font-mono text-slate-700 dark:text-slate-300">{viewingSubscription.subscriptionId}</strong>
                    </span>
                    <button
                      onClick={() => copyToClipboard(viewingSubscription.subscriptionId, 'Subscription ID')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Copy Subscription ID"
                    >
                      {copiedField === 'Subscription ID' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {renderStatusBadge(viewingSubscription.calculatedStatus || viewingSubscription.status)}
                <button
                  onClick={() => setViewingSubscription(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {drawerLoading && (
                <div className="text-center py-2 text-slate-400 text-xs font-semibold">
                  Refreshing latest database records...
                </div>
              )}

              {/* SECTION A & B: VENDOR & BUSINESS INFORMATION */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vendor Information */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                      Vendor Information
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor Name</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {viewingSubscription.vendorName || 'Vendor'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Vendor ID</span>
                      <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-400">
                        <span>{viewingSubscription.vendorId ? String(viewingSubscription.vendorId) : '—'}</span>
                        <button
                          onClick={() => copyToClipboard(viewingSubscription.vendorId, 'Vendor ID')}
                          className="hover:text-primary-500"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Mobile Phone</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {viewingSubscription.vendorPhone || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Email Address</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {viewingSubscription.vendorEmail || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Business Information */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <Store className="w-4 h-4 text-emerald-500" />
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                      Business Outlet Information
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Business Name</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {viewingSubscription.businessName}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Business ID</span>
                      <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-400">
                        <span>{viewingSubscription.businessId ? String(viewingSubscription.businessId) : '—'}</span>
                        <button
                          onClick={() => copyToClipboard(viewingSubscription.businessId, 'Business ID')}
                          className="hover:text-primary-500"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Business Type</span>
                      <div className="pt-1">
                        {renderBusinessTypeBadge(viewingSubscription.businessType)}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Relationship Rule</span>
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ 1 Business = 1 Independent Subscription
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION C: TERRITORY & LOCATION HIERARCHY */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <MapPin className="w-4 h-4 text-rose-500" />
                  <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    Territory / Location Hierarchy (Exact Order: State ↓ District ↓ Division ↓ Pincode)
                  </span>
                </div>
                
                {/* Visual Hierarchy Flow */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 font-bold">
                  <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs">
                    State: {viewingSubscription.state}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <div className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs">
                    District: {viewingSubscription.district}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <div className="px-3 py-1.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-lg text-xs">
                    Division: {viewingSubscription.division}
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-mono">
                    PIN: {viewingSubscription.pincode}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Full Business Address</span>
                  <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                    {viewingSubscription.fullBusinessAddress || viewingSubscription.address || '—'}
                  </p>
                </div>
              </div>

              {/* SECTION D & E: SUBSCRIPTION & PAYMENT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Subscription Details */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                      Subscription Plan & Validity
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Plan Name:</span>
                      <strong className="text-slate-900 dark:text-white font-bold">{viewingSubscription.planName || 'Monthly Subscription'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Monthly Subscription Fee:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                        ₹{(viewingSubscription.monthlyFee || viewingSubscription.amount || 1000).toLocaleString('en-IN')} / month
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Billing Cycle:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-semibold">{viewingSubscription.billingCycle || 'Monthly'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Start Date:</span>
                      <strong className="text-slate-800 dark:text-slate-200 font-semibold">{formatDate(viewingSubscription.startDate)}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Valid Until / Expiry:</span>
                      <strong className="text-slate-900 dark:text-white font-black">{formatDate(viewingSubscription.validUntil || viewingSubscription.endDate)}</strong>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-500">Subscription Status:</span>
                      {renderStatusBadge(viewingSubscription.calculatedStatus || viewingSubscription.status)}
                    </div>
                  </div>
                </div>

                {/* Payment Gateway Information */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                    <CreditCard className="w-4 h-4 text-primary-500" />
                    <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                      Payment Gateway Integration
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      {renderPaymentStatusBadge(viewingSubscription.paymentStatus)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Amount:</span>
                      <strong className="text-slate-900 dark:text-white font-bold">
                        ₹{(viewingSubscription.amount || viewingSubscription.monthlyFee || 1000).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Date:</span>
                      <strong className="text-slate-700 dark:text-slate-300 font-medium">
                        {formatDate(viewingSubscription.paymentDate || viewingSubscription.startDate)}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <strong className="text-slate-700 dark:text-slate-300 font-medium">
                        {viewingSubscription.paymentMethod || 'Online'}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Razorpay Payment ID</span>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        <span className="truncate">{viewingSubscription.razorpayPaymentId || '—'}</span>
                        {viewingSubscription.razorpayPaymentId && (
                          <button
                            onClick={() => copyToClipboard(viewingSubscription.razorpayPaymentId, 'Razorpay Payment ID')}
                            className="hover:text-primary-500 shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase font-bold">Razorpay Order ID</span>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate">
                        <span className="truncate">{viewingSubscription.razorpayOrderId || '—'}</span>
                        {viewingSubscription.razorpayOrderId && (
                          <button
                            onClick={() => copyToClipboard(viewingSubscription.razorpayOrderId, 'Razorpay Order ID')}
                            className="hover:text-primary-500 shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION F: APPROVAL DETAILS */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-black uppercase tracking-wider text-[11px] text-slate-700 dark:text-slate-300">
                    Territory Approver Details
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Approved By</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {viewingSubscription.approvedByName || viewingSubscription.approvedBy || 'Authorized Admin'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Approver Role</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {viewingSubscription.approvedByRole || 'Territory Admin'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Approver ID</span>
                    <span className="font-mono text-slate-500">
                      {viewingSubscription.approverId ? String(viewingSubscription.approverId) : 'System Verified'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">Approval Date</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDate(viewingSubscription.approvalDate || viewingSubscription.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-end shrink-0">
              <button
                onClick={() => setViewingSubscription(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
