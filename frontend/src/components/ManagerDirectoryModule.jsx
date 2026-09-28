import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Users, ChevronRight, ChevronDown, Search, RefreshCw, X, User,
  Phone, Mail, CheckCircle, XCircle, Clock, Globe, Map, MapPin,
  ArrowRight, Eye, Building2, Layers, Award,
  ChevronLeft, UserCheck, AlertCircle, Plus, List,
  ShoppingBag, DollarSign, Calendar, TrendingUp
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────
const MANAGER_LIMITS = {
  state: 8,
  district: 2,
  division: 2,
  pincode: 2
};

const LEVEL_LABELS = {
  state: 'State Manager',
  district: 'District Manager',
  division: 'Division Manager',
  pincode: 'Pincode Manager'
};

export const normalizeManagerLevel = (level, role) => {
  if (level === 1 || level === '1') return 'state';
  if (level === 2 || level === '2') return 'district';
  if (level === 3 || level === '3') return 'division';
  if (level === 4 || level === '4') return 'pincode';

  const raw = String(level || role || '').trim().toLowerCase();
  if (!raw) return 'state';
  if (raw === '1' || raw === 'state' || raw === 'state_manager' || raw.includes('state')) return 'state';
  if (raw === '2' || raw === 'district' || raw === 'district_manager' || raw.includes('dist')) return 'district';
  if (raw === '3' || raw === 'division' || raw === 'divisional' || raw === 'division_manager' || raw.includes('div')) return 'division';
  if (raw === '4' || raw === 'pincode' || raw === 'pincode_manager' || raw.includes('pin')) return 'pincode';
  return raw;
};

const getLevelBadgeClass = (level) => {
  const l = normalizeManagerLevel(level);
  if (l === 'state')    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (l === 'district') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
  if (l === 'division') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
  if (l === 'pincode')  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
};

const getStatusBadgeClass = (status) => {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'active' || s === 'approved') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (s === 'inactive')                   return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
  if (s === 'suspended')                  return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
  if (s === 'pending')                    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  if (s === 'rejected')                   return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
  return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(Number(amount) || 0);
};

// ─────────────────────────────────────────────────────────────
// BADGE COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const s = String(status || '').trim().toLowerCase();
  const displayStatus = String(status || 'Active');
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${getStatusBadgeClass(status)}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        s === 'active' || s === 'approved' ? 'bg-emerald-500' :
        s === 'pending' ? 'bg-amber-500' :
        s === 'rejected' || s === 'suspended' ? 'bg-red-500' : 'bg-slate-500'
      }`} />
      {displayStatus}
    </span>
  );
};

const LevelBadge = ({ level }) => {
  const norm = normalizeManagerLevel(level);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${getLevelBadgeClass(norm)}`}>
      {LEVEL_LABELS[norm] || String(level || 'Manager')}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// MANAGER PERFORMANCE & ACTIVITY DRAWER
// ─────────────────────────────────────────────────────────────
const ManagerDrawer = ({ manager, onClose, API_BASE, token }) => {
  const [perfData, setPerfData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    if (!manager?._id) return;
    setLoading(true);

    fetch(`${API_BASE}/admin/manager-directory/managers/${manager._id}/performance`, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token || '',
        'Authorization': token ? `Bearer ${token}` : ''
      }
    })
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data?.success && data.performance) {
            setPerfData(data.performance);
          } else {
            setPerfData({
              totalShopsTiedUp: 0,
              todayShopsTiedUp: 0,
              thisWeekShopsTiedUp: 0,
              thisMonthShopsTiedUp: 0,
              totalRevenue: 0,
              todayRevenue: 0,
              thisMonthRevenue: 0,
              totalCustomers: 0,
              totalVendors: 0,
              totalOrders: 0,
              totalBookings: 0
            });
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setPerfData({
            totalShopsTiedUp: 0,
            todayShopsTiedUp: 0,
            thisWeekShopsTiedUp: 0,
            thisMonthShopsTiedUp: 0,
            totalRevenue: 0,
            todayRevenue: 0,
            thisMonthRevenue: 0,
            totalCustomers: 0,
            totalVendors: 0,
            totalOrders: 0,
            totalBookings: 0
          });
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [manager, API_BASE, token]);

  if (!manager) return null;

  const onboardedBy = manager.parentAdminId?.name || manager.requestingAdminName || '—';
  const approvedBy  = manager.approvedBy?.name || '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight .22s cubic-bezier(.4,0,.2,1)' }}
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50">
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-0.5">Manager Performance & Profile</p>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{manager.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{manager.managerId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors mt-0.5 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status + Level Badge Bar */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <StatusBadge status={manager.status} />
          <LevelBadge level={manager.level} />
        </div>

        <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
          {/* Performance Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Real Performance Metrics</p>
              {loading && <RefreshCw className="w-3.5 h-3.5 text-primary-500 animate-spin" />}
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary-500" /> Computing territory metrics…
              </div>
            ) : (
              <div className="space-y-3">
                {/* Shop Tie-Ups Grid */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Store className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Shop Tie-Ups / Vendors</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block">Today</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100">{perfData?.todayShopsTiedUp ?? 0}</strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block">This Week</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100">{perfData?.thisWeekShopsTiedUp ?? 0}</strong>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block">This Month</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-100">{perfData?.thisMonthShopsTiedUp ?? 0}</strong>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">Total</span>
                      <strong className="text-sm font-black text-emerald-600 dark:text-emerald-400">{perfData?.totalShopsTiedUp ?? 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Revenue Metrics */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-4 h-4 text-primary-500" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Revenue Generated</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block">Today</span>
                      <strong className="text-xs font-black text-slate-800 dark:text-slate-200">{formatCurrency(perfData?.todayRevenue)}</strong>
                    </div>
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-semibold block">This Month</span>
                      <strong className="text-xs font-black text-slate-800 dark:text-slate-200">{formatCurrency(perfData?.thisMonthRevenue)}</strong>
                    </div>
                    <div className="p-2.5 bg-primary-500/10 rounded-xl border border-primary-500/20">
                      <span className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold block">Total</span>
                      <strong className="text-xs font-black text-primary-600 dark:text-primary-400">{formatCurrency(perfData?.totalRevenue)}</strong>
                    </div>
                  </div>
                </div>

                {/* Operations Breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Customers</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-200">{perfData?.totalCustomers ?? 0}</strong>
                    </div>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">Orders</span>
                      <strong className="text-sm font-black text-slate-800 dark:text-slate-200">{perfData?.totalOrders ?? 0}</strong>
                    </div>
                    <ShoppingBag className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Contact Details */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Contact Details</p>
            <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800"><Phone className="w-3.5 h-3.5 text-slate-500" /></div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{manager.phone || '—'}</p>
                  {manager.altPhone && <p className="text-[10px] text-slate-400">{manager.altPhone} (Alt)</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800"><Mail className="w-3.5 h-3.5 text-slate-500" /></div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">{manager.email || '—'}</p>
              </div>
            </div>
          </section>

          {/* Assigned Territory Scope */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Assigned Geographic Scope</p>
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2">
              {manager.assignedState && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{manager.assignedState}</span>
                </div>
              )}
              {manager.assignedDistrict && (
                <div className="flex items-center gap-2 pl-4">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{manager.assignedDistrict}</span>
                </div>
              )}
              {manager.assignedDivision && (
                <div className="flex items-center gap-2 pl-8">
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{manager.assignedDivision}</span>
                </div>
              )}
              {manager.assignedPincode && (
                <div className="flex items-center gap-2 pl-12">
                  <ArrowRight className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">{manager.assignedPincode}</span>
                </div>
              )}
            </div>
          </section>

          {/* Administration Onboarding Info */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Administration & Timeline</p>
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800">
              {[
                { label: 'Nominated By', value: onboardedBy },
                { label: 'Approved By',  value: approvedBy },
                { label: 'Onboarded Date', value: manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-800 last:border-0">
                  <span className="text-xs text-slate-400 font-medium">{r.label}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {manager.notes && (
            <section>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Notes</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200/80 dark:border-slate-800">{manager.notes}</p>
            </section>
          )}
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// REQUEST CARD (Admin Onboarding Request Review)
// ─────────────────────────────────────────────────────────────
const RequestCard = ({ request, onApprove, onReject, approving, rejecting }) => {
  const normLevel = normalizeManagerLevel(request.level);
  const limit = MANAGER_LIMITS[normLevel] || 2;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{request.name}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-[10px] text-slate-400 font-mono">{request.requestId}</span>
            <LevelBadge level={request.level} />
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />{request.phone}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 min-w-0">
          <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" /><span className="truncate">{request.email}</span>
        </div>
      </div>

      {/* Territory Scope */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3 mb-3 border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-extrabold uppercase text-slate-400">Assigned Territory</p>
          <span className="text-[10px] font-mono font-bold text-slate-500">Limit: {limit}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {request.assignedState && (
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold border border-emerald-500/20">{request.assignedState}</span>
          )}
          {request.assignedDistrict && (
            <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-semibold border border-blue-500/20">{request.assignedDistrict}</span></>
          )}
          {request.assignedDivision && (
            <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full font-semibold border border-purple-500/20">{request.assignedDivision}</span></>
          )}
          {request.assignedPincode && (
            <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold border border-amber-500/20 font-mono">{request.assignedPincode}</span></>
          )}
        </div>
      </div>

      {request.requestingAdminName && (
        <p className="text-[11px] text-slate-400 mb-3">
          Requested by <span className="text-slate-600 dark:text-slate-300 font-semibold">{request.requestingAdminName}</span>
        </p>
      )}

      {request.status === 'Rejected' && request.rejectionReason && (
        <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 mb-3">
          Reason: {request.rejectionReason}
        </p>
      )}

      {request.status === 'Pending' && (
        <div className="flex gap-2 mt-1">
          <button
            onClick={() => onApprove(request)}
            disabled={approving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <CheckCircle className="w-4 h-4" />
            {approving ? 'Approving…' : 'Direct Approve'}
          </button>
          <button
            onClick={() => onReject(request)}
            disabled={rejecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 text-slate-600 dark:text-slate-300 text-xs font-black rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            {rejecting ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// NOMINATE / ONBOARD MANAGER MODAL
// ─────────────────────────────────────────────────────────────
const NominateModal = ({ territory, onClose, onSubmit, submitting, territoryOptions }) => {
  const [level, setLevel] = useState(territory?.level || 'state');
  const [stateName, setStateName] = useState(territory?.state || '');
  const [districtName, setDistrictName] = useState(territory?.district || '');
  const [divisionName, setDivisionName] = useState(territory?.division || '');
  const [pincodeVal, setPincodeVal] = useState(territory?.pincode || '');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    altPhone: '',
    notes: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError('Name, email, and mobile phone number are required.');
      return;
    }
    if (!stateName.trim()) {
      setError('Assigned State is required.');
      return;
    }
    if (['district', 'division', 'pincode'].includes(level) && !districtName.trim()) {
      setError('Assigned District is required for this manager level.');
      return;
    }
    if (['division', 'pincode'].includes(level) && !divisionName.trim()) {
      setError('Assigned Division is required for this manager level.');
      return;
    }
    if (level === 'pincode' && !pincodeVal.trim()) {
      setError('Assigned Pincode is required for Pincode Manager.');
      return;
    }

    onSubmit({
      ...form,
      level,
      assignedState: stateName.trim(),
      assignedDistrict: districtName.trim(),
      assignedDivision: divisionName.trim(),
      assignedPincode: pincodeVal.trim()
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl p-6 my-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              Request Manager Onboarding
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Submit a new manager nomination for administrative approval
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl px-3.5 py-2.5 mb-4 font-medium">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Manager Role Level Selection */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Manager Role / Level *</label>
            <select
              value={level}
              onChange={e => setLevel(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="state">State Manager (Max 8 per State)</option>
              <option value="district">District Manager (Max 2 per District)</option>
              <option value="division">Division Manager (Max 2 per Division)</option>
              <option value="pincode">Pincode Manager (Max 2 per Pincode)</option>
            </select>
          </div>

          {/* Territory Geographic Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Assigned State *</label>
              <input
                type="text"
                required
                value={stateName}
                onChange={e => setStateName(e.target.value)}
                placeholder="e.g. Tamil Nadu"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {['district', 'division', 'pincode'].includes(level) && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Assigned District *</label>
                <input
                  type="text"
                  required
                  value={districtName}
                  onChange={e => setDistrictName(e.target.value)}
                  placeholder="e.g. Krishnagiri"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          {['division', 'pincode'].includes(level) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Assigned Division *</label>
                <input
                  type="text"
                  required
                  value={divisionName}
                  onChange={e => setDivisionName(e.target.value)}
                  placeholder="e.g. Central"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {level === 'pincode' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Assigned Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincodeVal}
                    onChange={e => setPincodeVal(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 635109"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Candidate Full Name"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="manager@example.com"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Primary Mobile *</label>
              <input
                type="tel"
                required
                maxLength={10}
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '') }))}
                placeholder="10-digit mobile"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Alternate Contact (Optional)</label>
            <input
              type="tel"
              maxLength={10}
              value={form.altPhone}
              onChange={e => setForm(f => ({ ...f, altPhone: e.target.value.replace(/\D/g, '') }))}
              placeholder="Alternate phone number"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Notes / Onboarding Purpose</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Administrative notes or onboarding reason…"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm"
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN MANAGERS COMPONENT
// ─────────────────────────────────────────────────────────────
const ManagerDirectoryModule = ({ token, API_BASE, onToast }) => {
  const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');

  const notify = useCallback((msg, type = 'info') => {
    if (typeof onToast === 'function') onToast(msg, type);
    else console.log(`[Toast ${type}]:`, msg);
  }, [onToast]);

  // Tab State: 'hierarchy' (default) | 'list' | 'requests'
  const [activeTab, setActiveTab] = useState('hierarchy');

  // Summary KPIs
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, inactive: 0 });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Hierarchy Data
  const [hierarchyStates, setHierarchyStates] = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [totalManagersCount, setTotalManagersCount] = useState(0);

  // Expand / Collapse State for Tree Nodes
  // key format: 'state-Tamil Nadu', 'dist-Tamil Nadu-Krishnagiri', 'div-Tamil Nadu-Krishnagiri-Central'
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNode = useCallback((nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  }, []);

  // Manager Requests
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState('Pending');
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // List View Flat Data & Pagination
  const [flatManagers, setFlatManagers] = useState([]);
  const [flatLoading, setFlatLoading] = useState(false);
  const [flatTotal, setFlatTotal] = useState(0);
  const [flatPage, setFlatPage] = useState(1);

  // Search & Dependent Filters
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterPincode, setFilterPincode] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [territoryOptions, setTerritoryOptions] = useState({ states: [], districts: [], divisions: [], pincodes: [] });

  // Selected Manager for Performance Drawer
  const [selectedManager, setSelectedManager] = useState(null);

  // Nominate / Request Modal
  const [nominateTerritory, setNominateTerritory] = useState(null);
  const [submittingNomination, setSubmittingNomination] = useState(false);

  const searchTimerRef = useRef(null);

  // ── Unified API Fetch Helper
  const apiFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': activeToken || '',
        'Authorization': activeToken ? `Bearer ${activeToken}` : '',
        ...(options.headers || {})
      }
    });
    let data = {};
    try { data = await res.json(); } catch { data = { msg: `HTTP ${res.status}` }; }
    if (!res.ok) throw new Error(data.msg || data.message || `HTTP ${res.status}`);
    return data;
  }, [API_BASE, activeToken]);

  // ── Loaders
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await apiFetch('/admin/manager-directory/summary');
      if (data?.summary) {
        setSummary(data.summary);
      }
    } catch {
      setSummary({ total: 0, active: 0, pending: 0, inactive: 0 });
    } finally {
      setSummaryLoading(false);
    }
  }, [apiFetch]);

  const loadTerritoryOptions = useCallback(async (state, district, division) => {
    try {
      const params = new URLSearchParams();
      if (state && state !== 'All') params.set('state', state);
      if (district && district !== 'All') params.set('district', district);
      if (division && division !== 'All') params.set('division', division);

      const data = await apiFetch(`/admin/manager-directory/territory-options?${params.toString()}`);
      if (data?.success) {
        setTerritoryOptions({
          states: Array.isArray(data.states) ? data.states : [],
          districts: Array.isArray(data.districts) ? data.districts : [],
          divisions: Array.isArray(data.divisions) ? data.divisions : [],
          pincodes: Array.isArray(data.pincodes) ? data.pincodes : []
        });
      }
    } catch {
      setTerritoryOptions({ states: [], districts: [], divisions: [], pincodes: [] });
    }
  }, [apiFetch]);

  const loadHierarchy = useCallback(async () => {
    setHierarchyLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (filterState && filterState !== 'All') params.set('state', filterState);
      if (filterDistrict && filterDistrict !== 'All') params.set('district', filterDistrict);
      if (filterDivision && filterDivision !== 'All') params.set('division', filterDivision);
      if (filterPincode && filterPincode !== 'All') params.set('pincode', filterPincode);
      if (filterLevel && filterLevel !== 'All') params.set('level', filterLevel);
      if (filterStatus && filterStatus !== 'All') params.set('status', filterStatus);

      const data = await apiFetch(`/admin/manager-directory/hierarchy?${params.toString()}`);
      if (data?.success && Array.isArray(data.states)) {
        setHierarchyStates(data.states);
        setTotalManagersCount(data.totalManagers || 0);

        // If search or filter is active, auto-expand matching nodes for convenience
        if (search.trim() || filterDistrict !== 'All' || filterDivision !== 'All' || filterPincode !== 'All') {
          const autoExpand = {};
          data.states.forEach(st => {
            autoExpand[`state-${st.state}`] = true;
            (st.districts || []).forEach(d => {
              autoExpand[`dist-${st.state}-${d.district}`] = true;
              (d.divisions || []).forEach(div => {
                autoExpand[`div-${st.state}-${d.district}-${div.division}`] = true;
              });
            });
          });
          setExpandedNodes(prev => ({ ...prev, ...autoExpand }));
        }
      } else {
        setHierarchyStates([]);
        setTotalManagersCount(0);
      }
    } catch {
      setHierarchyStates([]);
      setTotalManagersCount(0);
    } finally {
      setHierarchyLoading(false);
    }
  }, [apiFetch, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  const loadFlatManagers = useCallback(async (page = 1) => {
    setFlatLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '30',
        search: search.trim(),
        state: filterState,
        district: filterDistrict,
        division: filterDivision,
        pincode: filterPincode,
        level: filterLevel,
        status: filterStatus
      });
      const data = await apiFetch(`/admin/manager-directory/managers?${params.toString()}`);
      const list = data?.managers || (Array.isArray(data) ? data : []);
      setFlatManagers(list);
      setFlatTotal(data?.total || list.length);
      setFlatPage(page);
    } catch {
      setFlatManagers([]);
      setFlatTotal(0);
    } finally {
      setFlatLoading(false);
    }
  }, [apiFetch, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const data = await apiFetch(`/admin/manager-directory/requests?status=${encodeURIComponent(requestStatusFilter)}`);
      const list = data?.requests || (Array.isArray(data) ? data : []);
      setRequests(list);
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [apiFetch, requestStatusFilter]);

  // Initial Load
  useEffect(() => {
    loadSummary();
    loadHierarchy();
    loadTerritoryOptions();
  }, []);

  // Hierarchy Reload when filters/search change
  useEffect(() => {
    if (activeTab === 'hierarchy') {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        loadHierarchy();
      }, 350);
      return () => clearTimeout(searchTimerRef.current);
    }
  }, [activeTab, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus, loadHierarchy]);

  // List Reload
  useEffect(() => {
    if (activeTab === 'list') {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        loadFlatManagers(1);
      }, 350);
      return () => clearTimeout(searchTimerRef.current);
    }
  }, [activeTab, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus, loadFlatManagers]);

  // Requests Reload
  useEffect(() => {
    if (activeTab === 'requests') {
      loadRequests();
    }
  }, [activeTab, requestStatusFilter, loadRequests]);

  // Cascading territory filter triggers
  useEffect(() => {
    loadTerritoryOptions(filterState, 'All', 'All');
    setFilterDistrict('All'); setFilterDivision('All'); setFilterPincode('All');
  }, [filterState]);

  useEffect(() => {
    loadTerritoryOptions(filterState, filterDistrict, 'All');
    setFilterDivision('All'); setFilterPincode('All');
  }, [filterDistrict]);

  useEffect(() => {
    loadTerritoryOptions(filterState, filterDistrict, filterDivision);
    setFilterPincode('All');
  }, [filterDivision]);

  // ── Nominate / Onboard Handler
  const handleNominateSubmit = async (formData) => {
    setSubmittingNomination(true);
    try {
      const res = await apiFetch('/admin/manager-directory/requests/nominate', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      notify(res.msg || `Manager onboarding request submitted for ${formData.name}!`, 'success');
      setNominateTerritory(null);
      loadRequests();
      loadSummary();
      loadHierarchy();
    } catch (err) {
      notify(err.message || 'Error submitting manager request.', 'error');
    } finally {
      setSubmittingNomination(false);
    }
  };

  // ── Approval / Rejection Handlers
  const handleApprove = useCallback(async (request) => {
    setActionLoading(prev => ({ ...prev, [request._id]: 'approve' }));
    try {
      await apiFetch(`/admin/manager-directory/requests/${request._id}/approve`, { method: 'PUT' });
      notify(`Manager onboarding for ${request.name} approved!`, 'success');
      loadRequests();
      loadSummary();
      loadHierarchy();
      if (activeTab === 'list') loadFlatManagers(flatPage);
    } catch (err) {
      notify(err.message || 'Approval failed', 'error');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[request._id]; return n; });
    }
  }, [apiFetch, notify, loadRequests, loadSummary, loadHierarchy, activeTab, loadFlatManagers, flatPage]);

  const handleReject = useCallback(async () => {
    if (!rejectingRequest) return;
    setActionLoading(prev => ({ ...prev, [rejectingRequest._id]: 'reject' }));
    try {
      await apiFetch(`/admin/manager-directory/requests/${rejectingRequest._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectionReason })
      });
      notify(`Request for ${rejectingRequest.name} rejected.`, 'info');
      setRejectingRequest(null);
      setRejectionReason('');
      loadRequests();
      loadSummary();
    } catch (err) {
      notify(err.message || 'Rejection failed', 'error');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[rejectingRequest._id]; return n; });
    }
  }, [apiFetch, notify, loadRequests, loadSummary, rejectingRequest, rejectionReason]);

  const handleStatusUpdate = useCallback(async (mgr, status) => {
    try {
      await apiFetch(`/admin/manager-directory/managers/${mgr._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      notify(`Status updated to ${status}`, 'success');
      loadHierarchy();
      loadSummary();
      if (activeTab === 'list') loadFlatManagers(flatPage);
    } catch (err) {
      notify(err.message || 'Status update failed', 'error');
    }
  }, [apiFetch, notify, loadHierarchy, loadSummary, activeTab, loadFlatManagers, flatPage]);

  const pendingCount = summary.pending || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Managers</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs">
              Live Database Verified
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                ⚠ {pendingCount} Pending Requests
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Hierarchical Geographic Flow: State Manager → District Manager → Division Manager → Pincode Manager
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadSummary();
              loadHierarchy();
              loadTerritoryOptions();
              if (activeTab === 'requests') loadRequests();
              if (activeTab === 'list') loadFlatManagers(1);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0"
            title="Refresh Manager Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setNominateTerritory({ level: 'state', state: '', currentCount: 0 })}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" /> Request Manager
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Managers', value: summary.total,    icon: Users,        color: 'emerald', sub: 'Active & inactive' },
          { label: 'Active Managers',value: summary.active,   icon: UserCheck,    color: 'teal',    sub: 'Currently operational' },
          { label: 'Pending Requests',value: summary.pending, icon: Clock,        color: 'amber',   sub: 'Awaiting Admin review' },
          { label: 'Inactive / Suspended',value: summary.inactive, icon: AlertCircle, color: 'red', sub: 'Disabled records' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${
                card.color === 'teal'    ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400' :
                card.color === 'amber'   ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                card.color === 'red'     ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                           'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{summaryLoading ? '…' : (card.value ?? 0)}</h3>
            <p className={`text-[10px] font-bold mt-0.5 ${
              card.color === 'teal'    ? 'text-teal-500' :
              card.color === 'amber'   ? 'text-amber-500' :
              card.color === 'red'     ? 'text-red-500' : 'text-emerald-500'
            }`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── TOP CONTROLS & TABS ── */}
      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-850 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 w-fit">
        {[
          { id: 'hierarchy', label: 'Hierarchy View', icon: Layers },
          { id: 'list',      label: 'All Managers List', icon: List },
          { id: 'requests',  label: `Onboarding Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: Clock },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── SEARCH & DEPENDENT REAL FILTERS (Active on both Hierarchy and List) ── */}
      {activeTab !== 'requests' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs space-y-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, mobile, email or Manager ID…"
              className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200 font-medium"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {/* State Filter */}
            <select
              value={filterState}
              onChange={e => setFilterState(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All States</option>
              {territoryOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* District Filter (Cascaded strictly from real records) */}
            <select
              value={filterDistrict}
              onChange={e => setFilterDistrict(e.target.value)}
              disabled={filterState === 'All'}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer disabled:opacity-40"
            >
              <option value="All">All Districts</option>
              {territoryOptions.districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Division Filter */}
            <select
              value={filterDivision}
              onChange={e => setFilterDivision(e.target.value)}
              disabled={filterDistrict === 'All'}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer disabled:opacity-40"
            >
              <option value="All">All Divisions</option>
              {territoryOptions.divisions.map(v => <option key={v} value={v}>{v}</option>)}
            </select>

            {/* Pincode Filter */}
            <select
              value={filterPincode}
              onChange={e => setFilterPincode(e.target.value)}
              disabled={filterDivision === 'All'}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer disabled:opacity-40"
            >
              <option value="All">All Pincodes</option>
              {territoryOptions.pincodes.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            {/* Role Filter */}
            <select
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Types</option>
              <option value="state">State Manager</option>
              <option value="district">District Manager</option>
              <option value="division">Division Manager</option>
              <option value="pincode">Pincode Manager</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
            </select>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. HIERARCHICAL EXPANDABLE DISPLAY (DEFAULT VIEW) */}
      {/* State Manager [ > ] -> District Manager [ > ] -> Division Manager [ > ] -> Pincode Manager */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {hierarchyLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-500" /> Loading manager hierarchy…
            </div>
          ) : hierarchyStates.length === 0 ? (
            /* Requirement 9: Empty Database Behavior -> "No managers found" */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center shadow-xs">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">No managers found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                No manager records currently exist in the database. When new managers are onboarded and approved, they will appear here in their assigned geographic hierarchy.
              </p>
              <button
                onClick={() => setNominateTerritory({ level: 'state', state: '', currentCount: 0 })}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Request Manager
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {hierarchyStates.map(stateGroup => {
                const stateNodeKey = `state-${stateGroup.state}`;
                const isStateExpanded = !!expandedNodes[stateNodeKey];
                const stateManagers = stateGroup.stateManagers || [];
                const districtList = stateGroup.districts || [];

                return (
                  <div
                    key={stateGroup.state}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden transition-all"
                  >
                    {/* ── STATE MANAGERS LEVEL ── */}
                    {stateManagers.length > 0 ? (
                      stateManagers.map(stateMgr => {
                        return (
                          <div
                            key={stateMgr._id}
                            onClick={() => setSelectedManager(stateMgr)}
                            className="flex items-center justify-between p-5 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                                <Globe className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">{stateMgr.name}</h4>
                                  <LevelBadge level="state" />
                                  <span className="text-[11px] font-mono text-slate-400 font-semibold">{stateMgr.managerId}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{stateGroup.state}</span>
                                  <span>·</span>
                                  <span>{stateMgr.phone}</span>
                                  <span>·</span>
                                  <span className="truncate">{stateMgr.email}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-shrink-0">
                              <StatusBadge status={stateMgr.status} />

                              {/* Separate Arrow Button for Expansion (Requirement 5) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleNode(stateNodeKey);
                                }}
                                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                                  isStateExpanded
                                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                                title={isStateExpanded ? 'Collapse District Managers' : 'Expand District Managers'}
                              >
                                {isStateExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      /* Virtual State Group Card if no State Manager appointed yet */
                      <div
                        onClick={() => toggleNode(stateNodeKey)}
                        className="flex items-center justify-between p-5 hover:bg-slate-50/80 dark:hover:bg-slate-850/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                            <Globe className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">{stateGroup.state}</h4>
                              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">STATE</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 italic">No State Manager appointed yet</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleNode(stateNodeKey);
                            }}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          >
                            {isStateExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── DISTRICT MANAGERS EXPANSION (Requirement 2 & 3) ── */}
                    {isStateExpanded && (
                      <div className="bg-slate-50/70 dark:bg-slate-850/40 border-t border-slate-100 dark:border-slate-800/80 p-4 sm:p-5 space-y-3">
                        {districtList.length === 0 ? (
                          /* Requirement 2: "No district managers assigned" */
                          <div className="py-4 px-5 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-400 italic font-semibold text-center">
                            No district managers assigned
                          </div>
                        ) : (
                          districtList.map(distGroup => {
                            const distNodeKey = `dist-${stateGroup.state}-${distGroup.district}`;
                            const isDistExpanded = !!expandedNodes[distNodeKey];
                            const districtManagers = distGroup.districtManagers || [];
                            const divisionList = distGroup.divisions || [];

                            return (
                              <div
                                key={distGroup.district}
                                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden ml-2 sm:ml-6"
                              >
                                {districtManagers.length > 0 ? (
                                  districtManagers.map(distMgr => (
                                    <div
                                      key={distMgr._id}
                                      onClick={() => setSelectedManager(distMgr)}
                                      className="flex items-center justify-between p-4 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/80 last:border-b-0 group"
                                    >
                                      <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                                          <Building2 className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <h5 className="text-xs font-black text-slate-900 dark:text-white">{distMgr.name}</h5>
                                            <LevelBadge level="district" />
                                            <span className="text-[10px] font-mono text-slate-400">{distMgr.managerId}</span>
                                          </div>
                                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{distGroup.district}</span>
                                            <span>·</span>
                                            <span>{distMgr.phone}</span>
                                            <span>·</span>
                                            <span className="truncate">{distMgr.email}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2.5 flex-shrink-0">
                                        <StatusBadge status={distMgr.status} />
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleNode(distNodeKey);
                                          }}
                                          className={`p-1.5 rounded-lg transition-all cursor-pointer border ${
                                            isDistExpanded
                                              ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                          }`}
                                          title={isDistExpanded ? 'Collapse Division Managers' : 'Expand Division Managers'}
                                        >
                                          {isDistExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div
                                    onClick={() => toggleNode(distNodeKey)}
                                    className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500">
                                        <Building2 className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-200">{distGroup.district}</p>
                                        <p className="text-[10px] text-slate-400 italic">No District Manager assigned</p>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleNode(distNodeKey);
                                      }}
                                      className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                    >
                                      {isDistExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                )}

                                {/* ── DIVISION MANAGERS EXPANSION (Requirement 3 & 4) ── */}
                                {isDistExpanded && (
                                  <div className="bg-slate-50/50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800 p-3 sm:p-4 space-y-2.5">
                                    {divisionList.length === 0 ? (
                                      /* Requirement 3: "No division managers assigned" */
                                      <div className="py-3 px-4 rounded-xl bg-white/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400 italic font-semibold text-center">
                                        No division managers assigned
                                      </div>
                                    ) : (
                                      divisionList.map(divGroup => {
                                        const divNodeKey = `div-${stateGroup.state}-${distGroup.district}-${divGroup.division}`;
                                        const isDivExpanded = !!expandedNodes[divNodeKey];
                                        const divisionManagers = divGroup.divisionManagers || [];
                                        const pincodeList = divGroup.pincodes || [];

                                        return (
                                          <div
                                            key={divGroup.division}
                                            className="bg-white dark:bg-slate-850 border border-slate-200/70 dark:border-slate-750 rounded-xl shadow-xs overflow-hidden ml-2 sm:ml-6"
                                          >
                                            {divisionManagers.length > 0 ? (
                                              divisionManagers.map(divMgr => (
                                                <div
                                                  key={divMgr._id}
                                                  onClick={() => setSelectedManager(divMgr)}
                                                  className="flex items-center justify-between p-3.5 hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-b-0 group"
                                                >
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                      <Map className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                        <h6 className="text-xs font-black text-slate-900 dark:text-white">{divMgr.name}</h6>
                                                        <LevelBadge level="division" />
                                                        <span className="text-[10px] font-mono text-slate-400">{divMgr.managerId}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                                        <span className="font-bold text-purple-600 dark:text-purple-400">{divGroup.division}</span>
                                                        <span>·</span>
                                                        <span>{divMgr.phone}</span>
                                                        <span>·</span>
                                                        <span className="truncate">{divMgr.email}</span>
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-2 flex-shrink-0">
                                                    <StatusBadge status={divMgr.status} />
                                                    <button
                                                      type="button"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleNode(divNodeKey);
                                                      }}
                                                      className={`p-1 rounded-md transition-all cursor-pointer border ${
                                                        isDivExpanded
                                                          ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                                                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                                      }`}
                                                      title={isDivExpanded ? 'Collapse Pincode Managers' : 'Expand Pincode Managers'}
                                                    >
                                                      {isDivExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                    </button>
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div
                                                onClick={() => toggleNode(divNodeKey)}
                                                className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                                              >
                                                <div className="flex items-center gap-2.5">
                                                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                    <Map className="w-3.5 h-3.5" />
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-black text-slate-800 dark:text-slate-200">{divGroup.division}</p>
                                                    <p className="text-[10px] text-slate-400 italic">No Division Manager assigned</p>
                                                  </div>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleNode(divNodeKey);
                                                  }}
                                                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                                                >
                                                  {isDivExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                </button>
                                              </div>
                                            )}

                                            {/* ── PINCODE MANAGERS EXPANSION (Requirement 4) ── */}
                                            {isDivExpanded && (
                                              <div className="bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 p-2.5 sm:p-3 space-y-2">
                                                {pincodeList.length === 0 ? (
                                                  /* Requirement 4: "No pincode managers assigned" */
                                                  <div className="py-2.5 px-3 rounded-lg bg-white/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 text-[10px] text-slate-400 italic font-semibold text-center">
                                                    No pincode managers assigned
                                                  </div>
                                                ) : (
                                                  pincodeList.map(pinGroup => {
                                                    const pincodeManagers = pinGroup.pincodeManagers || [];

                                                    return (
                                                      <div key={pinGroup.pincode} className="space-y-1.5 ml-2 sm:ml-4">
                                                        {pincodeManagers.map(pinMgr => (
                                                          <div
                                                            key={pinMgr._id}
                                                            onClick={() => setSelectedManager(pinMgr)}
                                                            className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700 rounded-xl hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition-colors cursor-pointer group shadow-2xs"
                                                          >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                              <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                                                                <MapPin className="w-3 h-3" />
                                                              </div>
                                                              <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                  <span className="text-xs font-black text-slate-900 dark:text-white">{pinMgr.name}</span>
                                                                  <LevelBadge level="pincode" />
                                                                  <span className="text-[10px] font-mono text-slate-400">{pinMgr.managerId}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                                                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{pinGroup.pincode}</span>
                                                                  <span>·</span>
                                                                  <span>{pinMgr.phone}</span>
                                                                  <span>·</span>
                                                                  <span className="truncate">{pinMgr.email}</span>
                                                                </div>
                                                              </div>
                                                            </div>
                                                            <StatusBadge status={pinMgr.status} />
                                                          </div>
                                                        ))}
                                                      </div>
                                                    );
                                                  })
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. FLAT LIST VIEW TAB (Alternative View) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="text-[11px] text-slate-400 font-medium px-1">
            {flatLoading ? 'Loading…' : `${flatTotal} manager${flatTotal !== 1 ? 's' : ''} found`}
          </div>

          {flatLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-500" /> Loading managers…
            </div>
          ) : flatManagers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">No managers found</p>
              <p className="text-xs text-slate-400 mt-1">No database records matched your criteria.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden">
              {flatManagers.map((mgr, idx) => (
                <div
                  key={mgr._id}
                  onClick={() => setSelectedManager(mgr)}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
                    idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                  }`}
                >
                  <div className={`p-2 rounded-xl flex-shrink-0 ${getLevelBadgeClass(mgr.level).split(' ').slice(0, 2).join(' ')}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{mgr.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{mgr.managerId}</span>
                      <LevelBadge level={mgr.level} />
                    </div>
                    <p className="text-xs text-slate-500">{mgr.phone || '—'} · <span className="truncate">{mgr.email}</span></p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px]">
                      {mgr.assignedState && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{mgr.assignedState}</span>}
                      {mgr.assignedDistrict && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-blue-600 dark:text-blue-400">{mgr.assignedDistrict}</span></>}
                      {mgr.assignedDivision && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-purple-600 dark:text-purple-400">{mgr.assignedDivision}</span></>}
                      {mgr.assignedPincode && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-amber-600 dark:text-amber-400 font-mono">{mgr.assignedPincode}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <StatusBadge status={mgr.status} />
                    <button
                      onClick={() => setSelectedManager(mgr)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                      title="View Profile & Performance"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {['Active', 'approved', 'Approved'].includes(mgr.status) ? (
                      <button
                        onClick={() => handleStatusUpdate(mgr, 'Inactive')}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                        title="Deactivate"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStatusUpdate(mgr, 'Active')}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                        title="Activate"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {flatTotal > 30 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => loadFlatManagers(flatPage - 1)}
                disabled={flatPage <= 1}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-400 font-semibold">
                Page {flatPage} of {Math.ceil(flatTotal / 30)}
              </span>
              <button
                onClick={() => loadFlatManagers(flatPage + 1)}
                disabled={flatPage >= Math.ceil(flatTotal / 30)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. REQUESTS TAB (Administrative Onboarding Approvals) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['Pending', 'Approved', 'Rejected', 'All'].map(s => (
              <button
                key={s}
                onClick={() => setRequestStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  requestStatusFilter === s
                    ? 'bg-primary-600 text-white border-primary-500 shadow-xs'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin text-primary-500" /> Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 text-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-700 dark:text-slate-300">No {requestStatusFilter !== 'All' ? requestStatusFilter.toLowerCase() : ''} requests found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {requests.map(req => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onApprove={handleApprove}
                  onReject={r => { setRejectingRequest(r); setRejectionReason(''); }}
                  approving={actionLoading[req._id] === 'approve'}
                  rejecting={actionLoading[req._id] === 'reject'}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MANAGER PERFORMANCE & DETAILS DRAWER ── */}
      {selectedManager && (
        <ManagerDrawer
          manager={selectedManager}
          onClose={() => setSelectedManager(null)}
          API_BASE={API_BASE}
          token={activeToken}
        />
      )}

      {/* ── NOMINATE / ONBOARD MANAGER MODAL ── */}
      {nominateTerritory && (
        <NominateModal
          territory={nominateTerritory}
          onClose={() => setNominateTerritory(null)}
          onSubmit={handleNominateSubmit}
          submitting={submittingNomination}
          territoryOptions={territoryOptions}
        />
      )}

      {/* ── REJECTION REASON MODAL ── */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setRejectingRequest(null)}>
          <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">Reject Manager Request</h3>
            <p className="text-xs text-slate-400 mb-4">Rejecting onboarding for <span className="text-slate-700 dark:text-slate-200 font-bold">{rejectingRequest.name}</span></p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectingRequest(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading[rejectingRequest._id]}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
              >
                {actionLoading[rejectingRequest._id] ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDirectoryModule;
