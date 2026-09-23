import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, ChevronRight, ChevronDown, Search, RefreshCw, X, User,
  Phone, Mail, CheckCircle, XCircle, Clock, Globe, Map, MapPin,
  ArrowRight, Eye, Building2, Layers, Navigation, Shield, Building,
  ChevronLeft, UserCheck, AlertCircle, Plus
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LEVEL_LABELS = {
  state: 'State Manager', district: 'District Manager',
  division: 'Division Manager', pincode: 'Pincode Manager'
};

const getLevelBadge = (level) => {
  const l = (level || '').toLowerCase();
  if (l === 'state')    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (l === 'district') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
  if (l === 'division') return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20';
  if (l === 'pincode')  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
};

const getStatusBadge = (status) => {
  if (status === 'Active')    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (status === 'Inactive')  return 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-500/20';
  if (status === 'Suspended') return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
  if (status === 'Pending')   return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
  if (status === 'Approved')  return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
  if (status === 'Rejected')  return 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20';
  return 'bg-slate-500/10 text-slate-500 border border-slate-500/20';
};

// ─────────────────────────────────────────────────────────────
// SMALL REUSABLE COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${getStatusBadge(status)}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${
      status === 'Active' || status === 'Approved' ? 'bg-emerald-500' :
      status === 'Pending' ? 'bg-amber-500' :
      status === 'Rejected' || status === 'Suspended' ? 'bg-red-500' : 'bg-slate-500'
    }`} />
    {status}
  </span>
);

const LevelBadge = ({ level }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${getLevelBadge(level)}`}>
    {LEVEL_LABELS[level] || level}
  </span>
);

const ManagerCountPill = ({ count, color = 'indigo' }) => (
  <span className={`flex-shrink-0 inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-black
    ${color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
      color === 'blue' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
      color === 'purple' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
      color === 'amber' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
      'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
    }`}>
    {count}
  </span>
);

// ─────────────────────────────────────────────────────────────
// MANAGER DETAIL DRAWER
// ─────────────────────────────────────────────────────────────
const ManagerDrawer = ({ manager, onClose }) => {
  if (!manager) return null;
  const onboardedBy = manager.parentAdminId?.name || manager.requestingAdminName || '—';
  const approvedBy  = manager.approvedBy?.name || '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 h-full overflow-y-auto flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight .22s cubic-bezier(.4,0,.2,1)' }}
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-0.5">Manager Profile</p>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{manager.name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{manager.managerId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status + Level */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 dark:border-slate-800">
          <StatusBadge status={manager.status} />
          <LevelBadge level={manager.level} />
        </div>

        <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">
          {/* Contact */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Contact</p>
            <div className="space-y-2.5">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"><Phone className="w-3.5 h-3.5 text-slate-500" /></div>
                <div>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{manager.phone || '—'}</p>
                  {manager.altPhone && <p className="text-[10px] text-slate-400">{manager.altPhone} (Alt)</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"><Mail className="w-3.5 h-3.5 text-slate-500" /></div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 break-all">{manager.email || '—'}</p>
              </div>
            </div>
          </section>

          {/* Territory */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Territory</p>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2">
              {manager.assignedState && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{manager.assignedState}</span>
                </div>
              )}
              {manager.assignedDistrict && (
                <div className="flex items-center gap-2 pl-4">
                  <ArrowRight className="w-3 h-3 text-blue-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{manager.assignedDistrict}</span>
                </div>
              )}
              {manager.assignedDivision && (
                <div className="flex items-center gap-2 pl-8">
                  <ArrowRight className="w-3 h-3 text-purple-400 flex-shrink-0" />
                  <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">{manager.assignedDivision}</span>
                </div>
              )}
              {manager.assignedPincode && (
                <div className="flex items-center gap-2 pl-12">
                  <ArrowRight className="w-3 h-3 text-amber-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">{manager.assignedPincode}</span>
                </div>
              )}
            </div>
          </section>

          {/* Administration */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Administration</p>
            <div className="space-y-2.5">
              {[
                { label: 'Nominated By', value: onboardedBy },
                { label: 'Approved By',  value: approvedBy },
                { label: 'Onboarded On', value: manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                  <span className="text-xs text-slate-400 font-medium">{r.label}</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{r.value}</span>
                </div>
              ))}
            </div>
          </section>

          {manager.notes && (
            <section>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">Notes</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700">{manager.notes}</p>
            </section>
          )}
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// REQUEST CARD
// ─────────────────────────────────────────────────────────────
const RequestCard = ({ request, onApprove, onReject, approving, rejecting }) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-sm transition-shadow">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100">{request.name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

    {/* Territory */}
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 mb-3 border border-slate-100 dark:border-slate-800">
      <p className="text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">Territory</p>
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
        {request.requestingAdminRole && <span className="text-slate-400"> · {request.requestingAdminRole}</span>}
      </p>
    )}

    {request.status === 'Rejected' && request.rejectionReason && (
      <p className="text-[11px] text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 mb-3">
        Reason: {request.rejectionReason}
      </p>
    )}

    {request.status === 'Pending' && (
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onApprove(request)}
          disabled={approving}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          {approving ? 'Approving…' : 'Approve'}
        </button>
        <button
          onClick={() => onReject(request)}
          disabled={rejecting}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-60 text-slate-600 dark:text-slate-300 text-xs font-extrabold rounded-xl transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          <XCircle className="w-3.5 h-3.5" />
          {rejecting ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────
// HIERARCHY NODE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────
const buildDistrictMap = (districts) => {
  const m = {};
  districts.forEach(d => { m[d.district] = { ...d, expanded: false, loading: false, divisions: {} }; });
  return m;
};
const buildDivisionMap = (divisions) => {
  const m = {};
  divisions.forEach(d => { m[d.division] = { ...d, expanded: false, loading: false, pincodes: {} }; });
  return m;
};
const buildPincodeMap = (pincodes) => {
  const m = {};
  pincodes.forEach(p => { m[p.pincode] = { ...p, expanded: false, loading: false, managers: [] }; });
  return m;
};

const updateDivNode = (hierarchy, stateName, districtName, divisionName, patch) => {
  const stateNode = hierarchy[stateName] || {};
  const distNode  = stateNode.districts?.[districtName] || {};
  const divNode   = distNode.divisions?.[divisionName] || {};
  return {
    ...hierarchy,
    [stateName]: {
      ...stateNode,
      districts: {
        ...stateNode.districts,
        [districtName]: {
          ...distNode,
          divisions: { ...distNode.divisions, [divisionName]: { ...divNode, ...patch } }
        }
      }
    }
  };
};

const updatePinNode = (hierarchy, stateName, districtName, divisionName, pincode, patch) => {
  const stateNode = hierarchy[stateName] || {};
  const distNode  = stateNode.districts?.[districtName] || {};
  const divNode   = distNode.divisions?.[divisionName] || {};
  const pinNode   = divNode.pincodes?.[pincode] || {};
  return {
    ...hierarchy,
    [stateName]: {
      ...stateNode,
      districts: {
        ...stateNode.districts,
        [districtName]: {
          ...distNode,
          divisions: {
            ...distNode.divisions,
            [divisionName]: { ...divNode, pincodes: { ...divNode.pincodes, [pincode]: { ...pinNode, ...patch } } }
          }
        }
      }
    }
  };
};

// ─────────────────────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
const ManagerDirectoryModule = ({ token, API_BASE, onToast }) => {
  const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');

  const notify = useCallback((msg, type = 'info') => {
    if (typeof onToast === 'function') onToast(msg, type);
    else console.log(`[Toast ${type}]:`, msg);
  }, [onToast]);

  // ── Tab ──────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('directory');

  // ── Summary ──────────────────────────────────────────────
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, inactive: 0 });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Hierarchy ────────────────────────────────────────────
  const [states, setStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState({});

  // ── Requests ─────────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestStatusFilter, setRequestStatusFilter] = useState('Pending');
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // ── Managers ─────────────────────────────────────────────
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersTotal, setManagersTotal] = useState(0);
  const [managersPage, setManagersPage] = useState(1);

  // ── Filters ──────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterPincode, setFilterPincode] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [territoryOptions, setTerritoryOptions] = useState({ states: [], districts: [], divisions: [], pincodes: [] });

  // ── Drawer ───────────────────────────────────────────────
  const [selectedManager, setSelectedManager] = useState(null);

  const searchTimerRef = useRef(null);

  // ── API Helper ───────────────────────────────────────────
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
    const data = await res.json();
    if (!res.ok) throw new Error(data.msg || data.message || `HTTP ${res.status}`);
    return data;
  }, [API_BASE, activeToken]);

  // ── Loaders ──────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await apiFetch('/admin/manager-directory/summary');
      setSummary(data.summary || {});
    } catch { /* silent */ } finally { setSummaryLoading(false); }
  }, [apiFetch]);

  const loadStates = useCallback(async () => {
    setStatesLoading(true);
    try {
      const data = await apiFetch('/admin/manager-directory/states');
      setStates(data.states || []);
    } catch (err) {
      notify('Failed to load states. Check backend deployment.', 'error');
    } finally { setStatesLoading(false); }
  }, [apiFetch, notify]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams({ status: requestStatusFilter, limit: 60 });
      const data = await apiFetch(`/admin/manager-directory/requests?${params}`);
      setRequests(data.requests || []);
    } catch { notify('Failed to load requests', 'error'); }
    finally { setRequestsLoading(false); }
  }, [apiFetch, notify, requestStatusFilter]);

  const loadManagers = useCallback(async (page = 1) => {
    setManagersLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search)                       params.append('search', search);
      if (filterState !== 'All')        params.append('state', filterState);
      if (filterDistrict !== 'All')     params.append('district', filterDistrict);
      if (filterDivision !== 'All')     params.append('division', filterDivision);
      if (filterPincode !== 'All')      params.append('pincode', filterPincode);
      if (filterLevel !== 'All')        params.append('level', filterLevel);
      if (filterStatus !== 'All')       params.append('status', filterStatus);
      const data = await apiFetch(`/admin/manager-directory/managers?${params}`);
      setManagers(data.managers || []);
      setManagersTotal(data.total || 0);
      setManagersPage(page);
    } catch { notify('Failed to load managers', 'error'); }
    finally { setManagersLoading(false); }
  }, [apiFetch, notify, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  const loadTerritoryOptions = useCallback(async (state, district, division) => {
    try {
      const params = new URLSearchParams();
      if (state && state !== 'All')    params.append('state', state);
      if (district && district !== 'All') params.append('district', district);
      if (division && division !== 'All') params.append('division', division);
      const data = await apiFetch(`/admin/manager-directory/territory-options?${params}`);
      setTerritoryOptions({ states: data.states || [], districts: data.districts || [], divisions: data.divisions || [], pincodes: data.pincodes || [] });
    } catch { /* silent */ }
  }, [apiFetch]);

  // Initial load
  useEffect(() => { loadSummary(); loadStates(); loadTerritoryOptions(); }, []);

  useEffect(() => { if (activeTab === 'requests') loadRequests(); }, [activeTab, requestStatusFilter]);
  useEffect(() => { if (activeTab === 'managers') loadManagers(1); }, [activeTab, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  // Debounced search
  useEffect(() => {
    if (activeTab !== 'managers') return;
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadManagers(1), 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // Cascading territory dropdowns
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

  // ── Hierarchy Expansion ───────────────────────────────────
  const expandState = useCallback(async (stateName) => {
    const existing = hierarchy[stateName];
    if (existing?.expanded && Object.keys(existing.districts || {}).length > 0) {
      setHierarchy(prev => ({ ...prev, [stateName]: { ...prev[stateName], expanded: false } }));
      return;
    }
    setHierarchy(prev => ({ ...prev, [stateName]: { ...prev[stateName], expanded: true, loading: true, districts: {} } }));
    try {
      const data = await apiFetch(`/admin/manager-directory/states/${encodeURIComponent(stateName)}/districts`);
      setHierarchy(prev => ({ ...prev, [stateName]: { ...prev[stateName], loading: false, districts: buildDistrictMap(data.districts || []) } }));
    } catch {
      setHierarchy(prev => ({ ...prev, [stateName]: { ...prev[stateName], loading: false, error: true } }));
    }
  }, [apiFetch, hierarchy]);

  const expandDistrict = useCallback(async (stateName, districtName) => {
    const distNode = hierarchy[stateName]?.districts?.[districtName] || {};
    if (distNode.expanded && Object.keys(distNode.divisions || {}).length > 0) {
      setHierarchy(prev => ({
        ...prev, [stateName]: { ...prev[stateName], districts: { ...prev[stateName].districts, [districtName]: { ...distNode, expanded: false } } }
      }));
      return;
    }
    setHierarchy(prev => ({
      ...prev, [stateName]: { ...prev[stateName], districts: { ...prev[stateName].districts, [districtName]: { ...distNode, expanded: true, loading: true, divisions: {} } } }
    }));
    try {
      const data = await apiFetch(`/admin/manager-directory/districts/${encodeURIComponent(districtName)}/divisions?state=${encodeURIComponent(stateName)}`);
      setHierarchy(prev => ({
        ...prev, [stateName]: { ...prev[stateName], districts: { ...prev[stateName].districts, [districtName]: { ...prev[stateName].districts[districtName], loading: false, divisions: buildDivisionMap(data.divisions || []) } } }
      }));
    } catch { /* silent */ }
  }, [apiFetch, hierarchy]);

  const expandDivision = useCallback(async (stateName, districtName, divisionName) => {
    const divNode = hierarchy[stateName]?.districts?.[districtName]?.divisions?.[divisionName] || {};
    if (divNode.expanded && Object.keys(divNode.pincodes || {}).length > 0) {
      setHierarchy(prev => updateDivNode(prev, stateName, districtName, divisionName, { expanded: false }));
      return;
    }
    setHierarchy(prev => updateDivNode(prev, stateName, districtName, divisionName, { expanded: true, loading: true, pincodes: {} }));
    try {
      const params = `state=${encodeURIComponent(stateName)}&district=${encodeURIComponent(districtName)}`;
      const data = await apiFetch(`/admin/manager-directory/divisions/${encodeURIComponent(divisionName)}/pincodes?${params}`);
      setHierarchy(prev => updateDivNode(prev, stateName, districtName, divisionName, { loading: false, pincodes: buildPincodeMap(data.pincodes || []) }));
    } catch { /* silent */ }
  }, [apiFetch, hierarchy]);

  const expandPincode = useCallback(async (stateName, districtName, divisionName, pincode) => {
    const pinNode = hierarchy[stateName]?.districts?.[districtName]?.divisions?.[divisionName]?.pincodes?.[pincode] || {};
    if (pinNode.expanded && pinNode.managers?.length) {
      setHierarchy(prev => updatePinNode(prev, stateName, districtName, divisionName, pincode, { expanded: false }));
      return;
    }
    setHierarchy(prev => updatePinNode(prev, stateName, districtName, divisionName, pincode, { expanded: true, loading: true, managers: [] }));
    try {
      const params = `state=${encodeURIComponent(stateName)}&district=${encodeURIComponent(districtName)}&division=${encodeURIComponent(divisionName)}`;
      const data = await apiFetch(`/admin/manager-directory/pincodes/${encodeURIComponent(pincode)}/managers?${params}`);
      setHierarchy(prev => updatePinNode(prev, stateName, districtName, divisionName, pincode, { loading: false, managers: data.managers || [] }));
    } catch { /* silent */ }
  }, [apiFetch, hierarchy]);

  // ── Approve / Reject ──────────────────────────────────────
  const handleApprove = useCallback(async (request) => {
    setActionLoading(prev => ({ ...prev, [request._id]: 'approve' }));
    try {
      const data = await apiFetch(`/admin/manager-directory/requests/${request._id}/approve`, { method: 'PUT' });
      notify(data.msg || 'Manager approved!', 'success');
      loadRequests(); loadSummary(); loadStates(); setHierarchy({});
    } catch (err) { notify(err.message || 'Approval failed', 'error'); }
    finally { setActionLoading(prev => { const n = { ...prev }; delete n[request._id]; return n; }); }
  }, [apiFetch, notify, loadRequests, loadSummary, loadStates]);

  const handleReject = useCallback(async () => {
    if (!rejectingRequest) return;
    setActionLoading(prev => ({ ...prev, [rejectingRequest._id]: 'reject' }));
    try {
      const data = await apiFetch(`/admin/manager-directory/requests/${rejectingRequest._id}/reject`, {
        method: 'PUT', body: JSON.stringify({ reason: rejectionReason.trim() || 'Rejected by Main Admin' })
      });
      notify(data.msg || 'Request rejected.', 'success');
      setRejectingRequest(null); setRejectionReason('');
      loadRequests(); loadSummary();
    } catch (err) { notify(err.message || 'Rejection failed', 'error'); }
    finally { setActionLoading(prev => { const n = { ...prev }; delete n[rejectingRequest._id]; return n; }); }
  }, [apiFetch, notify, loadRequests, loadSummary, rejectingRequest, rejectionReason]);

  const handleStatusUpdate = useCallback(async (mgr, status) => {
    try {
      const data = await apiFetch(`/admin/manager-directory/managers/${mgr._id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      notify(data.msg || `Status updated to ${status}`, 'success');
      if (activeTab === 'managers') loadManagers(managersPage);
      loadSummary();
    } catch (err) { notify(err.message || 'Status update failed', 'error'); }
  }, [apiFetch, notify, activeTab, loadManagers, managersPage, loadSummary]);

  // ── Hierarchy Tree Renderer ───────────────────────────────
  const renderTree = () => {
    if (statesLoading) return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex items-center justify-center gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin" /> Loading territory data…
      </div>
    );

    if (!states.length) return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
        <Globe className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-500">No manager territories found.</p>
        <p className="text-xs text-slate-400 mt-1">Managers will appear here once they are approved and assigned territories.</p>
      </div>
    );

    return (
      <div className="space-y-2">
        {states.map(stateObj => {
          const stateNode = hierarchy[stateObj.state] || {};
          const isExpanded = stateNode.expanded;

          return (
            <div key={stateObj.state} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
              {/* ── STATE ROW ── */}
              <button
                onClick={() => expandState(stateObj.state)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left cursor-pointer"
              >
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                  <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">{stateObj.state}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {stateObj.activeManagers} active · {stateObj.pendingRequests > 0 ? <span className="text-amber-500 font-bold">{stateObj.pendingRequests} pending</span> : '0 pending'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ManagerCountPill count={stateObj.totalManagers} color="emerald" />
                  {stateNode.loading
                    ? <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />
                    : (isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)
                  }
                </div>
              </button>

              {/* ── DISTRICTS ── */}
              {isExpanded && (
                <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  {Object.values(stateNode.districts || {}).length === 0 && !stateNode.loading && (
                    <p className="text-[11px] text-slate-400 text-center py-3">No district-level managers</p>
                  )}
                  {Object.values(stateNode.districts || {}).map(distObj => {
                    const distExpanded = distObj.expanded;
                    return (
                      <div key={distObj.district}>
                        <button
                          onClick={() => expandDistrict(stateObj.state, distObj.district)}
                          className="w-full flex items-center gap-3 pl-10 pr-5 py-3.5 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors text-left border-t border-slate-100 dark:border-slate-800 first:border-t-0 cursor-pointer"
                        >
                          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex-shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{distObj.district}</p>
                            <p className="text-[10px] text-slate-400">{distObj.activeManagers} active</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <ManagerCountPill count={distObj.totalManagers} color="blue" />
                            {distObj.loading
                              ? <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                              : (distExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />)
                            }
                          </div>
                        </button>

                        {/* ── DIVISIONS ── */}
                        {distExpanded && (
                          <div className="bg-slate-50 dark:bg-slate-800/30">
                            {Object.values(distObj.divisions || {}).map(divObj => {
                              const divExpanded = divObj.expanded;
                              return (
                                <div key={divObj.division}>
                                  <button
                                    onClick={() => expandDivision(stateObj.state, distObj.district, divObj.division)}
                                    className="w-full flex items-center gap-3 pl-16 pr-5 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-left border-t border-slate-100 dark:border-slate-800 first:border-t-0 cursor-pointer"
                                  >
                                    <div className="p-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 flex-shrink-0">
                                      <Map className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{divObj.division}</p>
                                      <p className="text-[10px] text-slate-400">{divObj.activeManagers} active</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <ManagerCountPill count={divObj.totalManagers} color="purple" />
                                      {divObj.loading
                                        ? <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                                        : (divExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />)
                                      }
                                    </div>
                                  </button>

                                  {/* ── PINCODES ── */}
                                  {divExpanded && (
                                    <div className="bg-white dark:bg-slate-900/40">
                                      {Object.values(divObj.pincodes || {}).map(pinObj => {
                                        const pinExpanded = pinObj.expanded;
                                        return (
                                          <div key={pinObj.pincode}>
                                            <button
                                              onClick={() => expandPincode(stateObj.state, distObj.district, divObj.division, pinObj.pincode)}
                                              className="w-full flex items-center gap-3 pl-20 pr-5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors text-left border-t border-slate-100 dark:border-slate-800 first:border-t-0 cursor-pointer"
                                            >
                                              <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                                                <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-slate-600 dark:text-slate-300 font-mono">{pinObj.pincode}</p>
                                                <p className="text-[10px] text-slate-400">{pinObj.activeManagers} active</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <ManagerCountPill count={pinObj.totalManagers} color="amber" />
                                                {pinObj.loading
                                                  ? <RefreshCw className="w-3 h-3 text-slate-400 animate-spin" />
                                                  : (pinExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />)
                                                }
                                              </div>
                                            </button>

                                            {/* ── MANAGERS ── */}
                                            {pinExpanded && (
                                              <div className="pl-24 pr-5 pb-3 pt-1 space-y-1.5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                                                {pinObj.loading && (
                                                  <div className="flex items-center gap-2 py-2 text-[11px] text-slate-400">
                                                    <RefreshCw className="w-3 h-3 animate-spin" /> Loading managers…
                                                  </div>
                                                )}
                                                {!pinObj.loading && !pinObj.managers?.length && (
                                                  <p className="text-[11px] text-slate-400 py-2">No managers assigned to this pincode.</p>
                                                )}
                                                {(pinObj.managers || []).map(mgr => (
                                                  <div key={mgr._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 flex items-center gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-xs">
                                                    <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
                                                      <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{mgr.name}</p>
                                                      <p className="text-[10px] text-slate-400">{mgr.phone} · {mgr.managerId}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <StatusBadge status={mgr.status} />
                                                      <button onClick={() => setSelectedManager(mgr)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors" title="View Details">
                                                        <Eye className="w-3.5 h-3.5" />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────
  const pendingCount = summary.pending || 0;

  return (
    <div className="space-y-6 pb-12">

      {/* ── HEADER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Manager Directory</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm">
              Territory View
            </span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                ⚠ {pendingCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            State Manager → District Manager → Division Manager → Pincode Manager
          </p>
        </div>
        <button
          onClick={() => { loadSummary(); loadStates(); setHierarchy({}); if (activeTab === 'requests') loadRequests(); if (activeTab === 'managers') loadManagers(1); }}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Managers', value: summary.total,    icon: Users,        color: 'indigo',  sub: 'All territory levels' },
          { label: 'Active Managers',value: summary.active,   icon: UserCheck,    color: 'emerald', sub: 'Currently operational' },
          { label: 'Pending Requests',value: summary.pending, icon: Clock,        color: 'amber',   sub: 'Awaiting approval' },
          { label: 'Inactive/Suspended',value: summary.inactive, icon: AlertCircle, color: 'red',  sub: 'Disabled accounts' },
        ].map(card => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{card.label}</span>
              <div className={`p-1.5 rounded-lg ${
                card.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                card.color === 'amber'   ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                card.color === 'red'     ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                           'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
              }`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{summaryLoading ? '…' : (card.value ?? 0)}</h3>
            <p className={`text-[10px] font-bold mt-0.5 ${
              card.color === 'emerald' ? 'text-emerald-500' :
              card.color === 'amber'   ? 'text-amber-500' :
              card.color === 'red'     ? 'text-red-500' : 'text-indigo-500'
            }`}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── TABS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto w-fit">
          {[
            { id: 'directory', label: 'Directory', icon: Layers },
            { id: 'requests',  label: `Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}`, icon: Clock },
            { id: 'managers',  label: 'All Managers', icon: Users },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === 'requests' && pendingCount > 0 && (
                <span className="w-4 h-4 flex items-center justify-center text-[9px] rounded-full bg-rose-500 text-white font-black animate-pulse">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── DIRECTORY TAB ── */}
      {activeTab === 'directory' && (
        <div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mb-3 px-1">
            <Navigation className="w-3.5 h-3.5" />
            Click any state to expand. Navigate: State → District → Division → Pincode → Managers.
          </div>
          {renderTree()}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Status filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {['Pending', 'Approved', 'Rejected', 'All'].map(s => (
              <button
                key={s}
                onClick={() => setRequestStatusFilter(s)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer border ${
                  requestStatusFilter === s
                    ? 'bg-primary-600 text-white border-primary-500 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" /> Loading requests…
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No {requestStatusFilter !== 'All' ? requestStatusFilter.toLowerCase() : ''} requests.</p>
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

      {/* ── ALL MANAGERS TAB ── */}
      {activeTab === 'managers' && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, mobile, email or Manager ID…"
                className="w-full pl-9 pr-9 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200 font-medium"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'State', val: filterState, set: setFilterState, opts: territoryOptions.states, allLabel: 'All States' },
                { label: 'District', val: filterDistrict, set: setFilterDistrict, opts: territoryOptions.districts, allLabel: 'All Districts', disabled: filterState === 'All' },
                { label: 'Division', val: filterDivision, set: setFilterDivision, opts: territoryOptions.divisions, allLabel: 'All Divisions', disabled: filterDistrict === 'All' },
                { label: 'Pincode', val: filterPincode, set: setFilterPincode, opts: territoryOptions.pincodes, allLabel: 'All Pincodes', disabled: filterDivision === 'All' },
              ].map(f => (
                <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)} disabled={f.disabled}
                  className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer disabled:opacity-40"
                >
                  <option value="All">{f.allLabel}</option>
                  {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer">
                <option value="All">All Types</option>
                <option value="state">State Manager</option>
                <option value="district">District Manager</option>
                <option value="division">Division Manager</option>
                <option value="pincode">Pincode Manager</option>
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer">
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium px-1">
            {managersLoading ? 'Loading…' : `${managersTotal} manager${managersTotal !== 1 ? 's' : ''} found`}
          </div>

          {managersLoading ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-5 h-5 animate-spin" /> Loading managers…
            </div>
          ) : managers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No managers match your filters.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              {managers.map((mgr, idx) => (
                <div key={mgr._id} className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}>
                  <div className={`p-2 rounded-xl flex-shrink-0 ${getLevelBadge(mgr.level).split(' ').slice(0, 2).join(' ')}`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{mgr.name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">{mgr.managerId}</span>
                      <LevelBadge level={mgr.level} />
                    </div>
                    <p className="text-xs text-slate-500">{mgr.phone} · <span className="truncate">{mgr.email}</span></p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px]">
                      {mgr.assignedState && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{mgr.assignedState}</span>}
                      {mgr.assignedDistrict && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-blue-600 dark:text-blue-400">{mgr.assignedDistrict}</span></>}
                      {mgr.assignedDivision && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-purple-600 dark:text-purple-400">{mgr.assignedDivision}</span></>}
                      {mgr.assignedPincode && <><ArrowRight className="w-2.5 h-2.5 text-slate-400" /><span className="text-amber-600 dark:text-amber-400 font-mono">{mgr.assignedPincode}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={mgr.status} />
                    <button onClick={() => setSelectedManager(mgr)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors" title="View Profile">
                      <Eye className="w-4 h-4" />
                    </button>
                    {mgr.status === 'Active' ? (
                      <button onClick={() => handleStatusUpdate(mgr, 'Inactive')} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Deactivate">
                        <XCircle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => handleStatusUpdate(mgr, 'Active')} className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-400 hover:text-emerald-500 transition-colors" title="Activate">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {managersTotal > 30 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => loadManagers(managersPage - 1)}
                disabled={managersPage <= 1}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-slate-400 font-semibold">
                Page {managersPage} of {Math.ceil(managersTotal / 30)}
              </span>
              <button
                onClick={() => loadManagers(managersPage + 1)}
                disabled={managersPage >= Math.ceil(managersTotal / 30)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── MANAGER DRAWER ── */}
      {selectedManager && <ManagerDrawer manager={selectedManager} onClose={() => setSelectedManager(null)} />}

      {/* ── REJECT REASON MODAL ── */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRejectingRequest(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 mb-1">Reject Manager Request</h3>
            <p className="text-xs text-slate-400 mb-4">Rejecting request for <span className="text-slate-700 dark:text-slate-200 font-bold">{rejectingRequest.name}</span></p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={3}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectingRequest(null)} className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-extrabold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading[rejectingRequest._id]}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
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
