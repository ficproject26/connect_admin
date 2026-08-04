import React, { useState, useEffect } from 'react';
import {
  CreditCard, Search, Filter, CheckCircle, XCircle, Download, Printer,
  Eye, RefreshCw, Sparkles, Award, Shield, User
} from 'lucide-react';

export const MembershipCardManagement = ({ token, API_BASE }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [membershipType, setMembershipType] = useState('all');
  const [paymentMode, setPaymentMode] = useState('all');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchMembershipRequests = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        membershipType,
        paymentMode,
        paymentStatus,
        status
      });

      const res = await fetch(`${API_BASE}/admin/enterprise/membership-requests?${query.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Fetch membership requests error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembershipRequests();
  }, [search, membershipType, paymentMode, paymentStatus, status]);

  const handleAction = async (requestId, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/membership-requests/action`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requestId, status: newStatus })
      });
      if (res.ok) {
        fetchMembershipRequests();
      }
    } catch (err) {
      console.error('Membership action error:', err);
    }
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
            Review customer card applications, verify payment modes, issue validities, and print digital membership cards.
          </p>
        </div>

        <button
          onClick={fetchMembershipRequests}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Cards
        </button>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search by Customer Name, Email, Card ID..."
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
            <option value="Premium">Premium</option>
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
            <option value="Pending">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">Total Requests: <strong>{requests.length}</strong></span>
      </div>

      {/* MEMBERSHIP REQUESTS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <th className="py-3 px-4">Customer Details</th>
              <th className="py-3 px-4">Membership ID & Tier</th>
              <th className="py-3 px-4">Payment Info</th>
              <th className="py-3 px-4">Validity Period</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
            {requests.map(req => (
              <tr key={req._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40">
                <td className="py-3 px-4">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{req.customerName}</span>
                  <span className="text-[11px] text-slate-400">{req.customerEmail} • {req.customerPhone}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block">{req.membershipId}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                    req.membershipType === 'Diamond' ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' :
                    req.membershipType === 'Gold' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {req.membershipType} Tier
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">₹{req.amount}</span>
                  <span className="text-[11px] text-slate-400">{req.paymentMode} • {req.paymentStatus}</span>
                </td>
                <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                  {new Date(req.validityStartDate).toLocaleDateString()} - {new Date(req.validityExpiryDate).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                    req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                    'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                  }`}>
                    {req.status}
                  </span>
                </td>
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
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 cursor-pointer"
                      title="View & Print Digital Card"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  <CreditCard className="w-10 h-10 text-purple-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No membership card requests found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DIGITAL CARD PREVIEW MODAL */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Membership Card Preview</h3>
              <button onClick={() => setSelectedCard(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                ✕
              </button>
            </div>

            {/* CARD FRONT DESIGN */}
            <div className="bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl space-y-6 relative overflow-hidden border border-purple-500/30">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block">FORGE INDIA CONNECT</span>
                  <span className="text-lg font-black tracking-tight">{selectedCard.membershipType} MEMBER</span>
                </div>
                <Award className="w-8 h-8 text-amber-400" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Card Number</span>
                <span className="text-lg font-mono font-bold tracking-wider text-purple-200">{selectedCard.membershipId}</span>
              </div>

              <div className="flex justify-between items-end pt-2 border-t border-purple-500/20 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">Member Name</span>
                  <span className="font-bold">{selectedCard.customerName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 uppercase block">Valid Thru</span>
                  <span className="font-bold">{new Date(selectedCard.validityExpiryDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print Card
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
