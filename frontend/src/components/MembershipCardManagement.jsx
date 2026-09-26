import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Search, CheckCircle, XCircle, Printer,
  Eye, RefreshCw, Sparkles, Award, Shield, User, ArrowUpRight,
  Calendar, AlertCircle
} from 'lucide-react';

export const MembershipCardManagement = React.memo(({ token, API_BASE }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [membershipType, setMembershipType] = useState('all');
  const [paymentMode, setPaymentMode] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchMembershipRequests = useCallback(async (isManualRefresh = false) => {
    setLoading(true);
    setFetchError(null);
    try {
      const query = new URLSearchParams({
        search: search.trim(),
        membershipType,
        paymentMode,
        paymentStatus,
        status
      });

      if (isManualRefresh) {
        query.set('refresh', 'true');
      }

      const res = await fetch(`${API_BASE}/admin/enterprise/membership-requests?${query.toString()}`, {
        headers: {
          'x-auth-token': token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || '') : '')
        }
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch membership requests error:', err);
      setFetchError(err.message || 'Failed to load membership cards');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, search, membershipType, paymentMode, paymentStatus, status]);

  useEffect(() => {
    fetchMembershipRequests();
  }, [fetchMembershipRequests]);

  // Periodic background refresh when page is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchMembershipRequests();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchMembershipRequests]);

  const handleAction = async (requestId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/membership-requests/action`, {
        method: 'POST',
        headers: {
          'x-auth-token': token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || '') : ''),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, status: newStatus })
      });
      if (res.ok) {
        fetchMembershipRequests(true);
      }
    } catch (err) {
      console.error('Membership action error:', err);
    }
  };

  const getTierBadgeStyle = (tier) => {
    const norm = (tier || '').toLowerCase();
    if (norm.includes('diamond')) {
      return 'bg-purple-500/10 text-purple-600 border border-purple-500/20';
    }
    if (norm.includes('gold')) {
      return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
    }
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700';
  };

  const getStatusBadge = (req) => {
    const isUp = req.isUpgraded || (req.status || '').toLowerCase() === 'upgraded';
    if (isUp) {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 w-fit">
          <Sparkles className="w-3 h-3" /> UPGRADED
        </span>
      );
    }

    const st = (req.status || 'Approved').toLowerCase();
    if (st === 'approved' || st === 'active') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 w-fit block">
          APPROVED
        </span>
      );
    }
    if (st === 'pending') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 w-fit block">
          PENDING
        </span>
      );
    }
    if (st === 'rejected' || st === 'cancelled') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 w-fit block">
          REJECTED
        </span>
      );
    }
    if (st === 'expired') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-600 border border-slate-500/20 w-fit block">
          EXPIRED
        </span>
      );
    }
    if (st.includes('fail')) {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 border border-red-500/20 w-fit block">
          PAYMENT FAILED
        </span>
      );
    }

    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 w-fit block">
        {req.status}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Membership Card Management</h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
              Customer Loyalty
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Review customer card applications, verify payment modes, issue validities, and track membership upgrades.
          </p>
        </div>

        <button
          onClick={() => fetchMembershipRequests(true)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
          title="Refresh real membership records from database"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Cards
        </button>
      </div>

      {/* ERROR BANNER */}
      {fetchError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{fetchError}</span>
          </div>
          <button
            onClick={() => fetchMembershipRequests(true)}
            className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* FILTERS TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search by Name, Customer ID, Email, Card ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          {/* Membership Tier Filter */}
          <select
            value={membershipType}
            onChange={e => setMembershipType(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Tiers</option>
            <option value="Silver">Silver</option>
            <option value="Gold">Gold</option>
            <option value="Diamond">Diamond</option>
          </select>

          {/* Payment Mode Filter */}
          <select
            value={paymentMode}
            onChange={e => setPaymentMode(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Payment Modes</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Net Banking">Net Banking</option>
            <option value="Wallet">Wallet</option>
            <option value="Cash">Cash</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Approved">Approved / Active</option>
            <option value="Upgraded">Upgraded</option>
            <option value="Pending">Pending Approval</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">Total Cards: <strong>{requests.length}</strong></span>
      </div>

      {/* MEMBERSHIP REQUESTS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <th className="py-3 px-3 text-center w-12">S.No</th>
              <th className="py-3 px-4">Customer Details</th>
              <th className="py-3 px-4">Membership ID & Tier</th>
              <th className="py-3 px-4">Payment Info</th>
              <th className="py-3 px-4">Validity Period</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
            {requests.map((req, idx) => (
              <tr key={req._id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                {/* S.NO */}
                <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                  {idx + 1}
                </td>

                {/* CUSTOMER DETAILS */}
                <td className="py-3 px-4">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 block text-[13px]">
                    {req.customerName || 'Customer Member'}
                  </span>
                  {(req.customerCode || req.customerId) && (
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                      {req.customerCode || req.customerId}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {req.customerEmail || 'No Email'} {req.customerPhone ? `• ${req.customerPhone}` : ''}
                  </span>
                </td>

                {/* MEMBERSHIP ID & TIER */}
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    {req.membershipId}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${getTierBadgeStyle(req.membershipType)}`}>
                      {req.membershipType} Tier
                    </span>
                    {(req.isUpgraded || req.previousTier) && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" /> Upgraded {req.previousTier ? `from ${req.previousTier}` : ''}
                      </span>
                    )}
                  </div>
                </td>

                {/* PAYMENT INFO */}
                <td className="py-3 px-4">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block text-xs">
                    ₹{Number(req.amount || 0).toLocaleString()}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {req.paymentMode || 'UPI'} • {req.paymentStatus || 'Paid'}
                  </span>
                  {req.transactionId && (
                    <span className="font-mono text-[10px] text-slate-400 block truncate max-w-[150px] mt-0.5" title={req.transactionId}>
                      Tx: {req.transactionId}
                    </span>
                  )}
                </td>

                {/* VALIDITY PERIOD */}
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                  {req.validityStartDate ? new Date(req.validityStartDate).toLocaleDateString() : 'N/A'} - {req.validityExpiryDate ? new Date(req.validityExpiryDate).toLocaleDateString() : 'N/A'}
                </td>

                {/* STATUS */}
                <td className="py-3 px-4">
                  {getStatusBadge(req)}
                </td>

                {/* ACTIONS */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {req.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleAction(req._id, 'Approved')}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px] hover:bg-emerald-700 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(req._id, 'Rejected')}
                          className="px-2.5 py-1 bg-rose-600 text-white rounded-lg font-bold text-[11px] hover:bg-rose-700 cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedCard(req)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                      title="View Customer & Card Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {requests.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <CreditCard className="w-10 h-10 text-purple-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No membership card records found.</p>
                </td>
              </tr>
            )}

            {loading && requests.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <RefreshCw className="w-8 h-8 text-purple-500 mx-auto mb-2 animate-spin opacity-50" />
                  <p className="text-xs font-bold">Loading real membership records...</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DIGITAL CARD PREVIEW & FULL DETAILS MODAL */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Membership Card & Customer Details</h3>
                <span className="text-[11px] text-slate-400 font-mono">Reference: {selectedCard.membershipId}</span>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* CARD FRONT DESIGN */}
            <div className={`p-6 rounded-3xl text-white shadow-xl space-y-6 relative overflow-hidden border ${
              (selectedCard.membershipType || '').toLowerCase().includes('diamond')
                ? 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 border-purple-500/40 shadow-purple-900/20'
                : (selectedCard.membershipType || '').toLowerCase().includes('gold')
                ? 'bg-gradient-to-br from-amber-950 via-slate-900 to-amber-900 border-amber-500/40 shadow-amber-900/20'
                : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border-slate-600/40'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block">FORGE INDIA CONNECT</span>
                  <span className="text-lg font-black tracking-tight">{selectedCard.membershipType?.toUpperCase()} MEMBER</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(selectedCard.isUpgraded || selectedCard.status === 'Upgraded') && (
                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full shadow-xs">
                      UPGRADED
                    </span>
                  )}
                  <Award className="w-8 h-8 text-amber-400" />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-300 uppercase font-mono block">Card Number</span>
                <span className="text-lg font-mono font-bold tracking-wider text-purple-100">{selectedCard.membershipId}</span>
              </div>

              <div className="flex justify-between items-end pt-2 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[9px] text-slate-300 uppercase block">Member Name</span>
                  <span className="font-bold text-sm">{selectedCard.customerName || 'Customer Member'}</span>
                  {(selectedCard.customerCode || selectedCard.customerId) && (
                    <span className="font-mono text-[10px] text-purple-200 block opacity-90">
                      {selectedCard.customerCode || selectedCard.customerId}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-300 uppercase block">Valid Thru</span>
                  <span className="font-bold text-sm">
                    {selectedCard.validityExpiryDate ? new Date(selectedCard.validityExpiryDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* DETAILED VERIFIED INFORMATION SECTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* CUSTOMER VERIFICATION */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase text-[11px] pb-1 border-b border-slate-200/50 dark:border-slate-800">
                  <User className="w-3.5 h-3.5 text-indigo-500" /> Customer Information
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Full Name:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{selectedCard.customerName || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer ID:</span>
                    <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                      {selectedCard.customerCode || selectedCard.customerId || 'N/A'}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email Address:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedCard.customerEmail || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mobile Number:</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{selectedCard.customerPhone || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* PAYMENT & VALIDITY */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-black uppercase text-[11px] pb-1 border-b border-slate-200/50 dark:border-slate-800">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Payment & Validity
                </div>
                <div className="space-y-1 text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Paid:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400 text-xs">
                      ₹{Number(selectedCard.amount || 0).toLocaleString()}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Mode:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedCard.paymentMode || 'UPI'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Status:</span>
                    <span className="font-bold text-emerald-600">{selectedCard.paymentStatus || 'Paid'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction ID:</span>
                    <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={selectedCard.transactionId}>
                      {selectedCard.transactionId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    <span className="text-slate-400">Valid From:</span>
                    <span>{selectedCard.validityStartDate ? new Date(selectedCard.validityStartDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Valid Until:</span>
                    <span>{selectedCard.validityExpiryDate ? new Date(selectedCard.validityExpiryDate).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* UPGRADE DETAILS & AUDIT HISTORY */}
            {(selectedCard.isUpgraded || selectedCard.previousTier || (selectedCard.history && selectedCard.history.length > 0)) && (
              <div className="bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-amber-500/5 p-4 rounded-2xl border border-indigo-200/50 dark:border-indigo-900/40 space-y-3">
                <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black uppercase text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Membership Upgrade & Purchase History
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Previous Tier</span>
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">
                      {selectedCard.previousTier || 'Initial Plan'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Current Tier</span>
                    <span className="font-extrabold text-purple-600 dark:text-purple-400">
                      {selectedCard.membershipType}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Upgrade Date</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedCard.upgradeDate ? new Date(selectedCard.upgradeDate).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase block">Upgrade Payment</span>
                    <span className="font-extrabold text-emerald-600">
                      ₹{Number(selectedCard.upgradeAmount || selectedCard.amount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Audit Timeline */}
                {Array.isArray(selectedCard.history) && selectedCard.history.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/40 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Chronological History:</span>
                    {selectedCard.history.map((h, hIdx) => (
                      <div key={hIdx} className="flex items-center justify-between text-[11px] bg-white/70 dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200/40 dark:border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                          <span className="font-bold text-slate-800 dark:text-slate-200">{h.plan || 'Plan'}</span>
                          {h.previousPlan && h.previousPlan !== 'None' && (
                            <span className="text-slate-400">(from {h.previousPlan})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600">₹{h.amount}</span>
                          <span className="text-slate-400 font-mono text-[10px]">{h.date ? new Date(h.date).toLocaleDateString() : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* MODAL FOOTER */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setSelectedCard(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" /> Print Card
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
});

export default MembershipCardManagement;
