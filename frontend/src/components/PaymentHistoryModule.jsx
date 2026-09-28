import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Search, Filter, RefreshCw,
  Calendar, CheckCircle, Clock, AlertTriangle, ArrowUpRight, ArrowDownRight,
  Eye, FileText, Printer, X, Download, Shield, MapPin, Building, CreditCard
} from 'lucide-react';

export const PaymentHistoryModule = React.memo(({ token, API_BASE, onToast }) => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('all'); // all | CREDIT | DEBIT
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Transaction for Detail Modal
  const [selectedTxn, setSelectedTxn] = useState(null);

  const toast = useCallback((msg, type = 'info') => {
    if (onToast) onToast(msg, type);
    else console.log(`[${type.toUpperCase()}] ${msg}`);
  }, [onToast]);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort: 'date_desc'
      });

      if (search.trim()) query.set('search', search.trim());
      if (direction !== 'all') query.set('direction', direction);
      if (category !== 'all') query.set('category', category);
      if (status !== 'all') query.set('status', status);
      if (startDate) query.set('startDate', startDate);
      if (endDate) query.set('endDate', endDate);
      if (isRefresh) query.set('_t', Date.now().toString());

      const res = await fetch(`${API_BASE}/admin/enterprise/payments/transactions?${query.toString()}`, {
        headers: {
          'x-auth-token': token,
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Fetch transaction history error:', err);
      toast('Failed to load transaction history', 'error');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, page, limit, search, direction, category, status, startDate, endDate, toast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Derived KPI calculations from current transaction batch
  const kpiSummary = useMemo(() => {
    let creditTotal = 0;
    let debitTotal = 0;
    transactions.forEach(t => {
      const amt = Number(t.amount || 0);
      const isCredit = (t.direction === 'CREDIT' || t.paymentType === 'received');
      if (isCredit) creditTotal += amt;
      else debitTotal += amt;
    });
    return {
      creditTotal,
      debitTotal,
      netFlow: creditTotal - debitTotal
    };
  }, [transactions]);

  const getCategoryLabel = (cat) => {
    const map = {
      customer_payment: 'Customer Order',
      vendor_subscription: 'Vendor Registration',
      vendor_tieup: 'Vendor Tie-up Fee',
      membership_card: 'Membership Card',
      agent_commission: 'Agent Commission',
      vendor_payout: 'Vendor Payout',
      payroll_payment: 'Payroll Disbursement',
      delivery_payout: 'Delivery Partner Payout',
      technician_payout: 'Technician Payout',
      operational_expense: 'Operational Expense'
    };
    return map[cat] || cat?.replace(/_/g, ' ') || 'General Transaction';
  };

  const getStatusBadge = (st) => {
    const s = (st || 'PAID').toUpperCase();
    if (s === 'PAID') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          PAID
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
          PENDING
        </span>
      );
    }
    if (s === 'HELD') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 border border-purple-500/20">
          HELD
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
          CANCELLED
        </span>
      );
    }
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      
      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Payment & Transaction History</h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Audit Ledger
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Comprehensive financial audit ledger distinguishing incoming Credit (+) and outgoing Debit (-) disbursements.
          </p>
        </div>

        <button
          onClick={() => fetchTransactions(true)}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
          title="Refresh real transactions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh History
        </button>
      </div>

      {/* 2. FINANCIAL FLOW KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Transactions</span>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">
            {totalCount.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Recorded Events</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Total Inflow (Credit +)</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="block text-2xl font-black text-emerald-600 dark:text-emerald-400">
            +₹{kpiSummary.creditTotal.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Current View Batch</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Total Outflow (Debit -)</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <span className="block text-2xl font-black text-rose-600 dark:text-rose-400">
            -₹{kpiSummary.debitTotal.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Current View Batch</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Net Balance Flow</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <span className={`block text-2xl font-black ${kpiSummary.netFlow >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {kpiSummary.netFlow >= 0 ? '+' : ''}₹{kpiSummary.netFlow.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-slate-400">Inflow vs Outflow</span>
        </div>
      </div>

      {/* 3. FILTERS TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search Reference, ID, Party..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          {/* Direction Filter (Credit / Debit) */}
          <select
            value={direction}
            onChange={e => { setDirection(e.target.value); setPage(1); }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Flows (Credit & Debit)</option>
            <option value="CREDIT">Credit Only (+ Inflow)</option>
            <option value="DEBIT">Debit Only (- Outflow)</option>
          </select>

          {/* Category Filter */}
          <select
            value={category}
            onChange={e => { setCategory(e.target.value); setPage(1); }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="customer_payment">Customer Orders</option>
            <option value="membership_card">Membership Cards</option>
            <option value="vendor_subscription">Vendor Fees</option>
            <option value="agent_commission">Agent Payouts</option>
            <option value="vendor_payout">Vendor Disbursements</option>
            <option value="payroll_payment">Payroll Disbursements</option>
            <option value="delivery_payout">Delivery Payouts</option>
            <option value="technician_payout">Technician Payouts</option>
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="PAID">Paid / Completed</option>
            <option value="PENDING">Pending</option>
            <option value="HELD">Held</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">Total Records: <strong>{totalCount}</strong></span>
      </div>

      {/* 4. TRANSACTIONS TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <th className="py-3 px-3 text-center w-12">S.No</th>
              <th className="py-3 px-4">Transaction Ref & ID</th>
              <th className="py-3 px-4">Date & Time</th>
              <th className="py-3 px-4">Party / Recipient</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Direction</th>
              <th className="py-3 px-4">Amount</th>
              <th className="py-3 px-4">Payment Mode</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
            {transactions.map((txn, idx) => {
              const isCredit = (txn.direction === 'CREDIT' || txn.paymentType === 'received');
              return (
                <tr key={txn._id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                  {/* S.No */}
                  <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">
                    {(page - 1) * limit + idx + 1}
                  </td>

                  {/* Ref & ID */}
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-100 block text-xs">
                      {txn.transactionReference || txn.paymentId || 'N/A'}
                    </span>
                    {txn.transactionReference && txn.paymentId && txn.transactionReference !== txn.paymentId && (
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                        ID: {txn.paymentId}
                      </span>
                    )}
                  </td>

                  {/* Date & Time */}
                  <td className="py-3 px-4 font-medium text-slate-600 dark:text-slate-400 text-xs">
                    {txn.paymentDate ? new Date(txn.paymentDate).toLocaleString() : new Date(txn.createdAt).toLocaleString()}
                  </td>

                  {/* Party Details */}
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block text-xs">
                      {txn.recipientName || 'Member / Customer'}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {txn.recipientType || 'Party'} {txn.recipientPhone ? `• ${txn.recipientPhone}` : ''}
                    </span>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block text-xs">
                      {getCategoryLabel(txn.paymentCategory)}
                    </span>
                  </td>

                  {/* Direction Badge */}
                  <td className="py-3 px-4 text-center">
                    {isCredit ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        <ArrowDownRight className="w-3 h-3" /> CREDIT
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
                        <ArrowUpRight className="w-3 h-3" /> DEBIT
                      </span>
                    )}
                  </td>

                  {/* Amount with +/- distinction */}
                  <td className="py-3 px-4">
                    <span className={`font-black text-sm block ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isCredit ? '+' : '-'}₹{Number(txn.amount || 0).toLocaleString()}
                    </span>
                  </td>

                  {/* Payment Mode */}
                  <td className="py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">
                    {txn.paymentMethod || txn.paymentMode || 'Bank Transfer'}
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {getStatusBadge(txn.status)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => setSelectedTxn(txn)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-[11px] cursor-pointer"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5 inline mr-1" /> View
                    </button>
                  </td>
                </tr>
              );
            })}

            {transactions.length === 0 && !loading && (
              <tr>
                <td colSpan={10} className="text-center py-16 text-slate-400">
                  <CreditCard className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs font-bold">No transactions match your search and filter criteria.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-3 mt-2">
            <span className="text-xs text-slate-400">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. TRANSACTION DETAIL MODAL */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Transaction Audit Record
                </h3>
              </div>
              <button onClick={() => setSelectedTxn(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-850">
                <div>
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Amount Transacted</span>
                  <span className={`text-2xl font-black block mt-0.5 ${
                    (selectedTxn.direction === 'CREDIT' || selectedTxn.paymentType === 'received')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {(selectedTxn.direction === 'CREDIT' || selectedTxn.paymentType === 'received') ? '+' : '-'}₹{Number(selectedTxn.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedTxn.status)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Transaction Ref</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 block text-xs mt-0.5">
                    {selectedTxn.transactionReference || selectedTxn.paymentId}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Flow Type</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs mt-0.5">
                    {selectedTxn.direction === 'CREDIT' || selectedTxn.paymentType === 'received' ? 'INFLOW (CREDIT)' : 'OUTFLOW (DEBIT)'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Party / Recipient</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{selectedTxn.recipientName}</span>
                  <span className="text-[11px] text-slate-400">{selectedTxn.recipientPhone || selectedTxn.recipientEmail || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] text-slate-400 font-black uppercase block">Category & Method</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{getCategoryLabel(selectedTxn.paymentCategory)}</span>
                  <span className="text-[11px] text-slate-400">{selectedTxn.paymentMethod || 'Bank Transfer'}</span>
                </div>
              </div>

              {selectedTxn.bankAccountNumber && (
                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850 font-mono">
                  <span className="text-[10px] text-slate-400 font-black uppercase block font-sans">Bank Details</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">{selectedTxn.maskedAccountNumber || selectedTxn.bankAccountNumber}</span>
                  <span className="text-[10px] text-slate-400 font-sans block">{selectedTxn.bankIfsc || 'SBIN0001001'} ({selectedTxn.bankName || 'State Bank'})</span>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedTxn(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs cursor-pointer"
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

export default PaymentHistoryModule;
