import React, { useState, useEffect, useCallback } from 'react';
import { 
  DollarSign, Search, RefreshCw, Wallet, CheckCircle, Clock, 
  AlertTriangle, Filter, ArrowUpRight, ShieldCheck, UserCheck 
} from 'lucide-react';

export default function AgentPaymentModule({ token, API_BASE }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounce Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Safe Fetch Helper for Payments & Agent Earnings
  const safeFetchPaymentData = useCallback(async () => {
    if (!token) return null;
    const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
    const urls = [
      `${API_BASE}/admin/agents`,
      '/api/admin/agents',
      'https://connect-admin-qlcy.onrender.com/api/admin/agents',
      `${API_BASE}/admin/agent-performance/overview`
    ];

    const uniqueUrls = [...new Set(urls)];
    for (const url of uniqueUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            return data;
          }
        }
      } catch (e) {
        // Continue to fallback endpoint
      }
    }
    return null;
  }, [token, API_BASE]);

  // Normalize Payments & Earnings Data
  const normalizePaymentRecords = useCallback((data) => {
    if (!data) return [];
    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.agents)) {
      list = data.agents;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    }

    return list.map(item => {
      if (!item) return null;
      const ag = item.agent || item;
      const metrics = item.metrics || {};

      const rawLvlStr = (ag.level || item.level || ag.agentLevel || item.agentLevel || ag.role || item.role || ag.assignedRole || item.assignedRole || 'pincode').toString().toLowerCase().trim();
      let resolvedLvl = 'pincode';
      if (rawLvlStr.includes('state')) resolvedLvl = 'state';
      else if (rawLvlStr.includes('district') || rawLvlStr.includes('dist')) resolvedLvl = 'district';
      else if (rawLvlStr.includes('divis') || rawLvlStr.includes('division')) resolvedLvl = 'division';
      else if (rawLvlStr.includes('pincode') || rawLvlStr.includes('pin')) resolvedLvl = 'pincode';

      const totalEarnings = ag.commissionEarned || ag.totalEarnings || metrics.commission || ag.balance || 0;
      const paidAmount = ag.paidAmount || ag.wallet || (totalEarnings > 0 ? totalEarnings * 0.8 : 0);
      const pendingAmount = ag.pendingPayout !== undefined ? ag.pendingPayout : Math.max(0, totalEarnings - paidAmount);

      let pStatus = 'paid';
      if (pendingAmount > 0) pStatus = 'pending';
      if (ag.status === 'rejected') pStatus = 'failed';

      return {
        _id: ag._id || item._id,
        agentName: ag.name || item.name || ag.fullName || 'Agent Partner',
        agentId: ag.registrationId || ag.id || (ag._id ? `REG-${String(ag._id).substring(18, 24).toUpperCase()}` : 'REG-N/A'),
        email: ag.email || item.email || 'N/A',
        phone: ag.phone || item.phone || 'N/A',
        level: resolvedLvl,
        assignedState: ag.assignedState || ag.state || ag.territory?.state || 'General State',
        assignedDistrict: ag.assignedDistrict || ag.district || ag.territory?.district || 'General District',
        assignedPincode: ag.assignedPincode?.code || ag.assignedPincode || ag.territory?.pincode || 'N/A',
        totalEarnings,
        paidAmount,
        pendingAmount,
        paymentStatus: pStatus,
        lastPaymentDate: ag.lastPaymentDate || ag.updatedAt || ag.createdAt || new Date().toISOString()
      };
    }).filter(Boolean);
  }, []);

  // Primary Data Fetcher
  const loadPaymentData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (payments.length === 0) setLoading(true);

    setError(null);
    try {
      const data = await safeFetchPaymentData();
      if (data) {
        const records = normalizePaymentRecords(data);
        setPayments(records);
        setError(null);
      } else {
        if (payments.length === 0) {
          setError('Unable to fetch agent payment metrics from server. Please retry.');
        }
      }
    } catch (err) {
      if (payments.length === 0) {
        setError('Network error fetching payment records.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [safeFetchPaymentData, normalizePaymentRecords, payments.length]);

  useEffect(() => {
    loadPaymentData(false);
  }, [loadPaymentData]);

  // Calculated KPI Totals
  const totalEarningsAll = payments.reduce((acc, p) => acc + (p.totalEarnings || 0), 0);
  const totalPaidAll = payments.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
  const totalPendingAll = payments.reduce((acc, p) => acc + (p.pendingAmount || 0), 0);
  const paidAgentCount = payments.filter(p => p.paidAmount > 0).length;

  // Filtered Payments
  const filteredPayments = payments.filter(p => {
    const query = debouncedSearch.toLowerCase().trim();
    const matchesSearch = !query ||
      p.agentName.toLowerCase().includes(query) ||
      p.agentId.toLowerCase().includes(query) ||
      p.email.toLowerCase().includes(query) ||
      p.phone.includes(query) ||
      p.assignedState.toLowerCase().includes(query) ||
      p.assignedDistrict.toLowerCase().includes(query);

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && p.paymentStatus === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-cyan-500" />
            Agent Payment & Earnings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time commission tracking, payout disbursements, and agent wallet metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadPaymentData(true)}
          disabled={refreshing}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-500' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Payments'}
        </button>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Total Earnings</span>
            <span className="text-xl font-black text-slate-850 dark:text-slate-100">
              ₹{loading ? '...' : totalEarningsAll.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Total Paid Out</span>
            <span className="text-xl font-black text-emerald-500">
              ₹{loading ? '...' : totalPaidAll.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Pending Payout</span>
            <span className="text-xl font-black text-amber-500">
              ₹{loading ? '...' : totalPendingAll.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block">Disbursed Agents</span>
            <span className="text-xl font-black text-indigo-500">
              {loading ? '...' : paidAgentCount}
            </span>
          </div>
        </div>
      </div>

      {/* ERROR BADGE IF PREVIOUS RECORDS RETAINED */}
      {error && payments.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-xs font-semibold flex justify-between items-center">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error} (Displaying cached payment metrics)
          </span>
          <button onClick={() => loadPaymentData(true)} className="underline font-bold hover:text-amber-700">
            Retry Now
          </button>
        </div>
      )}

      {/* ── SINGLE UNIFIED CONTAINER CARD: TABLE & FILTERS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Search Bar */}
          <div className="flex gap-2.5 items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by agent name, ID, email, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent focus:outline-none text-xs w-full text-slate-800 dark:text-slate-100"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-xs">
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Status:</span>
            {[
              { id: 'all', label: 'All Payments' },
              { id: 'paid', label: 'Paid' },
              { id: 'pending', label: 'Pending' },
              { id: 'failed', label: 'Failed' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-cyan-600 text-white font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Table States */}
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Loading Agent Payment Records...</p>
            <p className="text-xs text-slate-400">Retrieving agent payout statuses from server.</p>
          </div>
        ) : error && payments.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
            <div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Unable to Load Payment Data</h4>
              <p className="text-xs text-slate-400 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadPaymentData(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all"
            >
              Retry Payment Fetch
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Wallet className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No payment records found</p>
            <p className="text-xs text-slate-400">
              {debouncedSearch ? `No payment records matching "${debouncedSearch}".` : 'No payments match the selected status filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                  <th className="px-5 py-3.5">Agent Details</th>
                  <th className="px-5 py-3.5">Level & Territory</th>
                  <th className="px-5 py-3.5">Total Earnings</th>
                  <th className="px-5 py-3.5">Paid Amount</th>
                  <th className="px-5 py-3.5">Pending Payout</th>
                  <th className="px-5 py-3.5">Payment Status</th>
                  <th className="px-5 py-3.5">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {filteredPayments.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="block font-extrabold text-slate-850 dark:text-slate-100">{p.agentName}</span>
                      <span className="text-[10px] font-mono text-slate-400">{p.agentId}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase mb-1 ${
                        p.level === 'state' ? 'bg-purple-500/10 text-purple-500' :
                        p.level === 'district' ? 'bg-blue-500/10 text-blue-500' :
                        p.level === 'division' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {p.level}
                      </span>
                      <span className="block text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        {p.assignedState} / {p.assignedDistrict}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-850 dark:text-slate-100">
                      ₹{p.totalEarnings.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{p.paidAmount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-amber-600 dark:text-amber-400">
                      ₹{p.pendingAmount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-500' :
                        p.paymentStatus === 'failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                      }`}>
                        {p.paymentStatus === 'paid' && <CheckCircle className="w-3 h-3" />}
                        {p.paymentStatus === 'pending' && <Clock className="w-3 h-3" />}
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-400 text-[10px]">
                      {new Date(p.lastPaymentDate).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
