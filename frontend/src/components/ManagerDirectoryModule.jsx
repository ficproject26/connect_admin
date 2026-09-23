import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  MapPin, Users, ChevronRight, ChevronDown, Search, Filter, RefreshCw,
  X, User, Phone, Mail, CheckCircle, XCircle, Clock, AlertTriangle,
  Building2, Eye, Shield, Home, Layers, ArrowRight, Briefcase, Tag,
  ChevronLeft, Globe, Map, Navigation, Building
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const LEVEL_LABELS = { state: 'State Manager', district: 'District Manager', division: 'Division Manager', pincode: 'Pincode Manager' };
const LEVEL_COLORS = { state: 'indigo', district: 'violet', division: 'purple', pincode: 'fuchsia' };
const STATUS_CONFIG = {
  Active:   { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border border-emerald-500/30', dot: 'bg-emerald-400' },
  Inactive: { color: 'text-slate-400',   bg: 'bg-slate-500/15 border border-slate-500/30',   dot: 'bg-slate-400' },
  Suspended:{ color: 'text-red-400',     bg: 'bg-red-500/15 border border-red-500/30',       dot: 'bg-red-400' },
  Pending:  { color: 'text-amber-400',   bg: 'bg-amber-500/15 border border-amber-500/30',   dot: 'bg-amber-400' },
  Approved: { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border border-emerald-500/30', dot: 'bg-emerald-400' },
  Rejected: { color: 'text-red-400',     bg: 'bg-red-500/15 border border-red-500/30',       dot: 'bg-red-400' },
};

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {status}
    </span>
  );
};

const CountBadge = ({ count, color = 'slate' }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-${color}-500/20 text-${color}-300 border border-${color}-500/30`}>
    {count}
  </span>
);

const KpiCard = ({ icon: Icon, label, value, color }) => (
  <div className={`bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl bg-${color}-500/15 border border-${color}-500/30 flex items-center justify-center flex-shrink-0`}>
      <Icon className={`w-6 h-6 text-${color}-400`} />
    </div>
    <div>
      <p className="text-2xl font-black text-white">{value ?? '—'}</p>
      <p className="text-xs text-slate-400 font-medium mt-0.5">{label}</p>
    </div>
  </div>
);

// Manager detail panel (slide-out drawer)
const ManagerDrawer = ({ manager, onClose }) => {
  if (!manager) return null;
  const levelLabel = LEVEL_LABELS[manager.level] || `${manager.level} Manager`;
  const onboardedBy = manager.parentAdminId?.name || manager.requestingAdminName || '—';
  const approvedBy = manager.approvedBy?.name || '—';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'slideInRight 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700 bg-slate-800/70">
          <div>
            <h2 className="text-lg font-bold text-white">{manager.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{manager.managerId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        <div className="px-6 py-3 border-b border-slate-700/50">
          <StatusBadge status={manager.status} />
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">
          {/* Role */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Role</p>
            <p className="text-sm font-semibold text-white">{levelLabel}</p>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Contact</p>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span>{manager.phone || '—'}</span>
            </div>
            {manager.altPhone && (
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>{manager.altPhone} <span className="text-slate-500 text-xs">(Alt)</span></span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <span className="break-all">{manager.email || '—'}</span>
            </div>
          </div>

          {/* Territory */}
          <div className="space-y-2">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Territory</p>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-2">
              {manager.assignedState && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-indigo-300 font-medium">{manager.assignedState}</span>
                </div>
              )}
              {manager.assignedDistrict && (
                <div className="flex items-center gap-2 text-sm pl-4">
                  <ArrowRight className="w-3 h-3 text-violet-400" />
                  <span className="text-violet-300">{manager.assignedDistrict}</span>
                </div>
              )}
              {manager.assignedDivision && (
                <div className="flex items-center gap-2 text-sm pl-8">
                  <ArrowRight className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-300">{manager.assignedDivision}</span>
                </div>
              )}
              {manager.assignedPincode && (
                <div className="flex items-center gap-2 text-sm pl-12">
                  <ArrowRight className="w-3 h-3 text-fuchsia-400" />
                  <span className="text-fuchsia-300 font-mono">{manager.assignedPincode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest">Administration</p>
            <div className="text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Nominated By</span>
                <span className="text-slate-200 font-medium">{onboardedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Approved By</span>
                <span className="text-slate-200 font-medium">{approvedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Onboarded On</span>
                <span className="text-slate-200 font-medium">
                  {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>
          </div>

          {manager.notes && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Notes</p>
              <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">{manager.notes}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
    </div>
  );
};

// Request card
const RequestCard = ({ request, onApprove, onReject, approving, rejecting }) => {
  const levelLabel = LEVEL_LABELS[request.level] || `${request.level} Manager`;
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-white text-base">{request.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{request.requestId}</span>
            <span className="text-slate-600">•</span>
            <span className="text-xs font-medium text-amber-300">{levelLabel}</span>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Phone className="w-3.5 h-3.5 text-slate-500" />
          <span>{request.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-300 min-w-0">
          <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <span className="truncate">{request.email}</span>
        </div>
      </div>

      {/* Territory */}
      <div className="bg-slate-900/50 rounded-xl p-3 mb-4 border border-slate-700/40 space-y-1">
        <p className="text-xs text-slate-500 mb-1">Territory</p>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {request.assignedState && <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">{request.assignedState}</span>}
          {request.assignedDistrict && <><ArrowRight className="w-3 h-3 text-slate-500 self-center" /><span className="bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full border border-violet-500/30">{request.assignedDistrict}</span></>}
          {request.assignedDivision && <><ArrowRight className="w-3 h-3 text-slate-500 self-center" /><span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">{request.assignedDivision}</span></>}
          {request.assignedPincode && <><ArrowRight className="w-3 h-3 text-slate-500 self-center" /><span className="bg-fuchsia-500/20 text-fuchsia-300 px-2 py-0.5 rounded-full border border-fuchsia-500/30 font-mono">{request.assignedPincode}</span></>}
        </div>
      </div>

      {request.requestingAdminName && (
        <p className="text-xs text-slate-400 mb-3">
          Requested by: <span className="text-slate-200 font-medium">{request.requestingAdminName}</span>
          {request.requestingAdminRole && <span className="text-slate-500"> ({request.requestingAdminRole})</span>}
        </p>
      )}

      {request.status === 'Rejected' && request.rejectionReason && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          Rejection reason: {request.rejectionReason}
        </p>
      )}

      {request.status === 'Pending' && (
        <div className="flex gap-2">
          <button
            onClick={() => onApprove(request)}
            disabled={approving}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {approving ? 'Approving…' : 'Approve'}
          </button>
          <button
            onClick={() => onReject(request)}
            disabled={rejecting}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-slate-700 hover:bg-red-600/80 disabled:opacity-60 text-slate-200 hover:text-white text-sm font-semibold rounded-xl transition-colors border border-slate-600"
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
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
const ManagerDirectoryModule = ({ token, API_BASE, onToast }) => {
  const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');

  const notify = useCallback((msg, type = 'info') => {
    if (typeof onToast === 'function') onToast(msg, type);
    else console.log(`[Toast ${type}]:`, msg);
  }, [onToast]);

  // ── Primary Tab ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'requests' | 'managers'

  // ── Summary ──────────────────────────────────────────────
  const [summary, setSummary] = useState({ total: 0, active: 0, pending: 0, inactive: 0 });
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ── Hierarchy State ───────────────────────────────────────
  const [states, setStates] = useState([]);
  const [statesLoading, setStatesLoading] = useState(false);
  // Expanded nodes: { stateName: {data: districts, loading, expanded}, ... }
  const [hierarchy, setHierarchy] = useState({});

  // Breadcrumb: [{label, type, key}]
  const [breadcrumb, setBreadcrumb] = useState([]);

  // ── Requests Tab ─────────────────────────────────────────
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestStatusFilter, setRequestStatusFilter] = useState('Pending');
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  // ── Managers Tab ─────────────────────────────────────────
  const [managers, setManagers] = useState([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersTotal, setManagersTotal] = useState(0);
  const [managersPage, setManagersPage] = useState(1);

  // ── Search & Filters ─────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterPincode, setFilterPincode] = useState('All');
  const [filterLevel, setFilterLevel] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [territoryOptions, setTerritoryOptions] = useState({ states: [], districts: [], divisions: [], pincodes: [] });

  // ── Manager Drawer ────────────────────────────────────────
  const [selectedManager, setSelectedManager] = useState(null);

  const searchDebounceRef = useRef(null);

  // ── API Helper ────────────────────────────────────────────
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

  // ── Data Loaders ─────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await apiFetch('/admin/manager-directory/summary');
      setSummary(data.summary || {});
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, [apiFetch]);

  const loadStates = useCallback(async () => {
    setStatesLoading(true);
    try {
      const data = await apiFetch('/admin/manager-directory/states');
      setStates(data.states || []);
    } catch (err) {
      console.error('States error:', err);
      notify('Failed to load states', 'error');
    } finally {
      setStatesLoading(false);
    }
  }, [apiFetch, notify]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const params = new URLSearchParams({ status: requestStatusFilter, limit: 50 });
      const data = await apiFetch(`/admin/manager-directory/requests?${params}`);
      setRequests(data.requests || []);
      setRequestsTotal(data.total || 0);
    } catch (err) {
      console.error('Requests error:', err);
      notify('Failed to load manager requests', 'error');
    } finally {
      setRequestsLoading(false);
    }
  }, [apiFetch, notify, requestStatusFilter]);

  const loadManagers = useCallback(async (page = 1) => {
    setManagersLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search) params.append('search', search);
      if (filterState !== 'All') params.append('state', filterState);
      if (filterDistrict !== 'All') params.append('district', filterDistrict);
      if (filterDivision !== 'All') params.append('division', filterDivision);
      if (filterPincode !== 'All') params.append('pincode', filterPincode);
      if (filterLevel !== 'All') params.append('level', filterLevel);
      if (filterStatus !== 'All') params.append('status', filterStatus);
      const data = await apiFetch(`/admin/manager-directory/managers?${params}`);
      setManagers(data.managers || []);
      setManagersTotal(data.total || 0);
      setManagersPage(page);
    } catch (err) {
      console.error('Managers error:', err);
      notify('Failed to load managers', 'error');
    } finally {
      setManagersLoading(false);
    }
  }, [apiFetch, notify, search, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  const loadTerritoryOptions = useCallback(async (state, district, division) => {
    try {
      const params = new URLSearchParams();
      if (state && state !== 'All') params.append('state', state);
      if (district && district !== 'All') params.append('district', district);
      if (division && division !== 'All') params.append('division', division);
      const data = await apiFetch(`/admin/manager-directory/territory-options?${params}`);
      setTerritoryOptions({
        states: data.states || [],
        districts: data.districts || [],
        divisions: data.divisions || [],
        pincodes: data.pincodes || []
      });
    } catch (err) {
      console.error('Territory options error:', err);
    }
  }, [apiFetch]);

  // Initial load
  useEffect(() => {
    loadSummary();
    loadStates();
    loadTerritoryOptions();
  }, []);

  useEffect(() => {
    if (activeTab === 'requests') loadRequests();
  }, [activeTab, requestStatusFilter]);

  useEffect(() => {
    if (activeTab === 'managers') loadManagers(1);
  }, [activeTab, filterState, filterDistrict, filterDivision, filterPincode, filterLevel, filterStatus]);

  // Debounced search
  useEffect(() => {
    if (activeTab !== 'managers') return;
    clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => loadManagers(1), 400);
    return () => clearTimeout(searchDebounceRef.current);
  }, [search]);

  // Territory cascade
  useEffect(() => {
    loadTerritoryOptions(filterState, filterDistrict, filterDivision);
    setFilterDistrict('All');
    setFilterDivision('All');
    setFilterPincode('All');
  }, [filterState]);

  useEffect(() => {
    loadTerritoryOptions(filterState, filterDistrict, filterDivision);
    setFilterDivision('All');
    setFilterPincode('All');
  }, [filterDistrict]);

  useEffect(() => {
    loadTerritoryOptions(filterState, filterDistrict, filterDivision);
    setFilterPincode('All');
  }, [filterDivision]);

  // ── Hierarchy Lazy Expansion ──────────────────────────────
  const expandState = useCallback(async (stateName) => {
    setHierarchy(prev => {
      const already = prev[stateName];
      if (already && !already.loading) {
        return { ...prev, [stateName]: { ...already, expanded: !already.expanded } };
      }
      return { ...prev, [stateName]: { expanded: true, loading: true, districts: {} } };
    });

    // Fetch only if not yet loaded
    setHierarchy(prev => {
      if (prev[stateName]?.districts && Object.keys(prev[stateName].districts).length > 0 && !prev[stateName].loading) return prev;
      return prev;
    });

    try {
      const data = await apiFetch(`/admin/manager-directory/states/${encodeURIComponent(stateName)}/districts`);
      setHierarchy(prev => ({
        ...prev,
        [stateName]: { ...prev[stateName], loading: false, districts: buildDistrictMap(data.districts || []) }
      }));
    } catch (err) {
      console.error('Expand state error:', err);
      setHierarchy(prev => ({
        ...prev,
        [stateName]: { ...prev[stateName], loading: false, error: true }
      }));
    }
  }, [apiFetch]);

  const expandDistrict = useCallback(async (stateName, districtName) => {
    const key = `${stateName}||${districtName}`;
    setHierarchy(prev => {
      const stateNode = prev[stateName] || {};
      const distNode = stateNode.districts?.[districtName] || {};
      if (distNode.expanded && Object.keys(distNode.divisions || {}).length > 0) {
        return {
          ...prev,
          [stateName]: { ...stateNode, districts: { ...stateNode.districts, [districtName]: { ...distNode, expanded: false } } }
        };
      }
      return {
        ...prev,
        [stateName]: { ...stateNode, districts: { ...stateNode.districts, [districtName]: { ...distNode, expanded: true, loading: true, divisions: {} } } }
      };
    });

    try {
      const params = new URLSearchParams({ state: stateName });
      const data = await apiFetch(`/admin/manager-directory/districts/${encodeURIComponent(districtName)}/divisions?${params}`);
      setHierarchy(prev => {
        const stateNode = prev[stateName] || {};
        return {
          ...prev,
          [stateName]: {
            ...stateNode,
            districts: {
              ...stateNode.districts,
              [districtName]: { ...stateNode.districts?.[districtName], loading: false, divisions: buildDivisionMap(data.divisions || []) }
            }
          }
        };
      });
    } catch (err) {
      console.error('Expand district error:', err);
    }
  }, [apiFetch]);

  const expandDivision = useCallback(async (stateName, districtName, divisionName) => {
    setHierarchy(prev => {
      const stateNode = prev[stateName] || {};
      const distNode = stateNode.districts?.[districtName] || {};
      const divNode = distNode.divisions?.[divisionName] || {};
      if (divNode.expanded && Object.keys(divNode.pincodes || {}).length > 0) {
        return updateDivNode(prev, stateName, districtName, divisionName, { expanded: false });
      }
      return updateDivNode(prev, stateName, districtName, divisionName, { expanded: true, loading: true, pincodes: {} });
    });

    try {
      const params = new URLSearchParams({ state: stateName, district: districtName });
      const data = await apiFetch(`/admin/manager-directory/divisions/${encodeURIComponent(divisionName)}/pincodes?${params}`);
      setHierarchy(prev => updateDivNode(prev, stateName, districtName, divisionName, { loading: false, pincodes: buildPincodeMap(data.pincodes || []) }));
    } catch (err) {
      console.error('Expand division error:', err);
    }
  }, [apiFetch]);

  const expandPincode = useCallback(async (stateName, districtName, divisionName, pincode) => {
    setHierarchy(prev => {
      const divNode = getDivNode(prev, stateName, districtName, divisionName) || {};
      const pinNode = divNode.pincodes?.[pincode] || {};
      if (pinNode.expanded && pinNode.managers) {
        return updatePinNode(prev, stateName, districtName, divisionName, pincode, { expanded: false });
      }
      return updatePinNode(prev, stateName, districtName, divisionName, pincode, { expanded: true, loading: true, managers: [] });
    });

    try {
      const params = new URLSearchParams({ state: stateName, district: districtName, division: divisionName });
      const data = await apiFetch(`/admin/manager-directory/pincodes/${encodeURIComponent(pincode)}/managers?${params}`);
      setHierarchy(prev => updatePinNode(prev, stateName, districtName, divisionName, pincode, { loading: false, managers: data.managers || [] }));
    } catch (err) {
      console.error('Expand pincode error:', err);
    }
  }, [apiFetch]);

  // ── Approve / Reject ──────────────────────────────────────
  const handleApprove = useCallback(async (request) => {
    setActionLoading(prev => ({ ...prev, [request._id]: 'approve' }));
    try {
      const data = await apiFetch(`/admin/manager-directory/requests/${request._id}/approve`, { method: 'PUT' });
      notify(data.msg || 'Manager approved successfully!', 'success');
      loadRequests();
      loadSummary();
      loadStates();
    } catch (err) {
      notify(err.message || 'Approval failed', 'error');
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[request._id]; return n; });
    }
  }, [apiFetch, notify, loadRequests, loadSummary, loadStates]);

  const handleReject = useCallback(async () => {
    if (!rejectingRequest) return;
    setActionLoading(prev => ({ ...prev, [rejectingRequest._id]: 'reject' }));
    try {
      const data = await apiFetch(`/admin/manager-directory/requests/${rejectingRequest._id}/reject`, {
        method: 'PUT',
        body: JSON.stringify({ reason: rejectionReason.trim() || 'Rejected by Main Admin' })
      });
      notify(data.msg || 'Request rejected.', 'success');
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

  const handleStatusUpdate = useCallback(async (managerId, status) => {
    try {
      const data = await apiFetch(`/admin/manager-directory/managers/${managerId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      notify(data.msg || `Status updated to ${status}`, 'success');
      if (activeTab === 'managers') loadManagers(managersPage);
      loadSummary();
    } catch (err) {
      notify(err.message || 'Status update failed', 'error');
    }
  }, [apiFetch, notify, activeTab, loadManagers, managersPage, loadSummary]);

  // ── Render Helpers ────────────────────────────────────────
  const renderHierarchyTree = () => {
    if (statesLoading) return <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-500 animate-spin" /></div>;
    if (!states.length) return (
      <div className="text-center py-16">
        <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No managers found in any territory.</p>
      </div>
    );

    return (
      <div className="space-y-2">
        {states.map(stateObj => {
          const stateNode = hierarchy[stateObj.state] || {};
          const isExpanded = stateNode.expanded;
          return (
            <div key={stateObj.state} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl overflow-hidden">
              {/* State Row */}
              <button
                onClick={() => expandState(stateObj.state)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0`}>
                  <Globe className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{stateObj.state}</p>
                  <p className="text-xs text-slate-400">{stateObj.activeManagers} active · {stateObj.pendingRequests} pending</p>
                </div>
                <div className="flex items-center gap-3">
                  <CountBadge count={stateObj.totalManagers} color="indigo" />
                  {stateNode.loading ? (
                    <RefreshCw className="w-4 h-4 text-slate-500 animate-spin" />
                  ) : (
                    isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Districts */}
              {isExpanded && stateNode.districts && (
                <div className="border-t border-slate-700/30 bg-slate-900/30">
                  {Object.values(stateNode.districts).length === 0 && !stateNode.loading && (
                    <p className="text-xs text-slate-500 text-center py-3">No district-level data found</p>
                  )}
                  {Object.values(stateNode.districts).map(distObj => {
                    const distExpanded = distObj.expanded;
                    return (
                      <div key={distObj.district}>
                        <button
                          onClick={() => expandDistrict(stateObj.state, distObj.district)}
                          className="w-full flex items-center gap-3 pl-10 pr-5 py-3.5 hover:bg-slate-700/20 transition-colors text-left border-t border-slate-700/20 first:border-t-0"
                        >
                          <div className="w-6 h-6 rounded-md bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3 h-3 text-violet-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-200 text-sm">{distObj.district}</p>
                            <p className="text-xs text-slate-500">{distObj.activeManagers} active · {distObj.pendingRequests} pending</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <CountBadge count={distObj.totalManagers} color="violet" />
                            {distObj.loading ? (
                              <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin" />
                            ) : (
                              distExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </div>
                        </button>

                        {/* Divisions */}
                        {distExpanded && distObj.divisions && (
                          <div className="bg-slate-900/30">
                            {Object.values(distObj.divisions).map(divObj => {
                              const divExpanded = divObj.expanded;
                              return (
                                <div key={divObj.division}>
                                  <button
                                    onClick={() => expandDivision(stateObj.state, distObj.district, divObj.division)}
                                    className="w-full flex items-center gap-3 pl-16 pr-5 py-3 hover:bg-slate-700/15 transition-colors text-left border-t border-slate-700/20 first:border-t-0"
                                  >
                                    <div className="w-5 h-5 rounded bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                      <Map className="w-2.5 h-2.5 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-slate-300 text-sm">{divObj.division}</p>
                                      <p className="text-xs text-slate-500">{divObj.activeManagers} active</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <CountBadge count={divObj.totalManagers} color="purple" />
                                      {divObj.loading ? (
                                        <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                                      ) : (
                                        divExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                      )}
                                    </div>
                                  </button>

                                  {/* Pincodes */}
                                  {divExpanded && divObj.pincodes && (
                                    <div className="bg-slate-950/30">
                                      {Object.values(divObj.pincodes).map(pinObj => {
                                        const pinExpanded = pinObj.expanded;
                                        return (
                                          <div key={pinObj.pincode}>
                                            <button
                                              onClick={() => expandPincode(stateObj.state, distObj.district, divObj.division, pinObj.pincode)}
                                              className="w-full flex items-center gap-3 pl-20 pr-5 py-3 hover:bg-slate-700/10 transition-colors text-left border-t border-slate-700/20 first:border-t-0"
                                            >
                                              <div className="w-5 h-5 rounded bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                                                <MapPin className="w-2.5 h-2.5 text-fuchsia-400" />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-300 text-sm font-mono">{pinObj.pincode}</p>
                                                <p className="text-xs text-slate-500">{pinObj.activeManagers} active</p>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <CountBadge count={pinObj.totalManagers} color="fuchsia" />
                                                {pinObj.loading ? (
                                                  <RefreshCw className="w-3 h-3 text-slate-500 animate-spin" />
                                                ) : (
                                                  pinExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                )}
                                              </div>
                                            </button>

                                            {/* Managers at Pincode */}
                                            {pinExpanded && (
                                              <div className="pl-24 pr-5 pb-3 space-y-2 border-t border-slate-700/20">
                                                {pinObj.loading && <p className="text-xs text-slate-500 py-2 flex items-center gap-2"><RefreshCw className="w-3 h-3 animate-spin" />Loading managers…</p>}
                                                {!pinObj.loading && pinObj.managers?.length === 0 && (
                                                  <p className="text-xs text-slate-500 py-2">No managers assigned to this pincode.</p>
                                                )}
                                                {(pinObj.managers || []).map(mgr => (
                                                  <div key={mgr._id} className="bg-slate-800/60 border border-slate-700/40 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-slate-600 transition-colors">
                                                    <div className="w-8 h-8 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 flex items-center justify-center flex-shrink-0">
                                                      <User className="w-4 h-4 text-fuchsia-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <p className="text-sm font-semibold text-white truncate">{mgr.name}</p>
                                                      <p className="text-xs text-slate-400">{mgr.phone} · {mgr.managerId}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                      <StatusBadge status={mgr.status} />
                                                      <button
                                                        onClick={() => setSelectedManager(mgr)}
                                                        className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                                                        title="View Details"
                                                      >
                                                        <Eye className="w-4 h-4" />
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
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Manager Directory</h1>
          <p className="text-sm text-slate-400 mt-0.5">State → District → Division → Pincode → Managers</p>
        </div>
        <button
          onClick={() => { loadSummary(); loadStates(); if (activeTab === 'requests') loadRequests(); if (activeTab === 'managers') loadManagers(1); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-medium transition-colors border border-slate-600"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Total Managers" value={summaryLoading ? '…' : summary.total} color="indigo" />
        <KpiCard icon={CheckCircle} label="Active Managers" value={summaryLoading ? '…' : summary.active} color="emerald" />
        <KpiCard icon={Clock} label="Pending Requests" value={summaryLoading ? '…' : summary.pending} color="amber" />
        <KpiCard icon={XCircle} label="Inactive Managers" value={summaryLoading ? '…' : summary.inactive} color="red" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-2xl p-1.5 border border-slate-700/50 w-fit">
        {[
          { id: 'directory', label: 'Directory', icon: Layers },
          { id: 'requests', label: `Pending Requests${summary.pending > 0 ? ` (${summary.pending})` : ''}`, icon: Clock },
          { id: 'managers', label: 'All Managers', icon: Users }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
              activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── DIRECTORY TAB ── */}
      {activeTab === 'directory' && (
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-4">
            <Navigation className="w-3.5 h-3.5" />
            <span>Click a state to expand → district → division → pincode → managers</span>
          </div>
          {renderHierarchyTree()}
        </div>
      )}

      {/* ── REQUESTS TAB ── */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {['Pending', 'Approved', 'Rejected', 'All'].map(s => (
              <button
                key={s}
                onClick={() => setRequestStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                  requestStatusFilter === s
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-500 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No {requestStatusFilter !== 'All' ? requestStatusFilter.toLowerCase() : ''} requests found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {requests.map(req => (
                <RequestCard
                  key={req._id}
                  request={req}
                  onApprove={handleApprove}
                  onReject={(r) => { setRejectingRequest(r); setRejectionReason(''); }}
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, mobile, email, or Manager ID…"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {/* State */}
              <select value={filterState} onChange={e => setFilterState(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                <option value="All">All States</option>
                {territoryOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {/* District */}
              <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} disabled={filterState === 'All'} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                <option value="All">All Districts</option>
                {territoryOptions.districts.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {/* Division */}
              <select value={filterDivision} onChange={e => setFilterDivision(e.target.value)} disabled={filterDistrict === 'All'} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                <option value="All">All Divisions</option>
                {territoryOptions.divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {/* Pincode */}
              <select value={filterPincode} onChange={e => setFilterPincode(e.target.value)} disabled={filterDivision === 'All'} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-40">
                <option value="All">All Pincodes</option>
                {territoryOptions.pincodes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {/* Level */}
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                <option value="All">All Types</option>
                <option value="state">State Manager</option>
                <option value="district">District Manager</option>
                <option value="division">Division Manager</option>
                <option value="pincode">Pincode Manager</option>
              </select>
              {/* Status */}
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500">
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {/* Results */}
          <div className="text-xs text-slate-500 px-1">{managersLoading ? 'Loading…' : `${managersTotal} manager${managersTotal !== 1 ? 's' : ''} found`}</div>

          {managersLoading ? (
            <div className="flex items-center justify-center py-16"><RefreshCw className="w-6 h-6 text-slate-500 animate-spin" /></div>
          ) : managers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No managers found matching your filters.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {managers.map(mgr => (
                <div key={mgr._id} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-slate-600 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-white text-sm">{mgr.name}</p>
                      <span className="text-xs text-slate-500 font-mono">{mgr.managerId}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30`}>
                        {LEVEL_LABELS[mgr.level] || mgr.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">{mgr.phone}</span>
                      <span className="text-xs text-slate-500 truncate max-w-[200px]">{mgr.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs">
                      {mgr.assignedState && <span className="text-indigo-400">{mgr.assignedState}</span>}
                      {mgr.assignedDistrict && <><ArrowRight className="w-2.5 h-2.5 text-slate-600" /><span className="text-violet-400">{mgr.assignedDistrict}</span></>}
                      {mgr.assignedDivision && <><ArrowRight className="w-2.5 h-2.5 text-slate-600" /><span className="text-purple-400">{mgr.assignedDivision}</span></>}
                      {mgr.assignedPincode && <><ArrowRight className="w-2.5 h-2.5 text-slate-600" /><span className="text-fuchsia-400 font-mono">{mgr.assignedPincode}</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={mgr.status} />
                    <button
                      onClick={() => setSelectedManager(mgr)}
                      className="p-2 rounded-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {mgr.status === 'Active' && (
                      <button
                        onClick={() => handleStatusUpdate(mgr._id, 'Inactive')}
                        className="p-2 rounded-xl hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors"
                        title="Deactivate"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                    {mgr.status !== 'Active' && (
                      <button
                        onClick={() => handleStatusUpdate(mgr._id, 'Active')}
                        className="p-2 rounded-xl hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400 transition-colors"
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
          {managersTotal > 30 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => loadManagers(managersPage - 1)}
                disabled={managersPage <= 1}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-slate-400">Page {managersPage} of {Math.ceil(managersTotal / 30)}</span>
              <button
                onClick={() => loadManagers(managersPage + 1)}
                disabled={managersPage >= Math.ceil(managersTotal / 30)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Manager Detail Drawer */}
      {selectedManager && <ManagerDrawer manager={selectedManager} onClose={() => setSelectedManager(null)} />}

      {/* Reject Reason Modal */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setRejectingRequest(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Reject Manager Request</h3>
            <p className="text-sm text-slate-400 mb-4">Rejecting request for <span className="text-white font-medium">{rejectingRequest.name}</span></p>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)…"
              rows={3}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectingRequest(null)} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-sm font-semibold transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading[rejectingRequest._id]}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
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

// ─────────────────────────────────────────────────────────────
// HIERARCHY TREE HELPERS (immutable state updates)
// ─────────────────────────────────────────────────────────────
function buildDistrictMap(districts) {
  const m = {};
  districts.forEach(d => { m[d.district] = { ...d, expanded: false, loading: false, divisions: {} }; });
  return m;
}
function buildDivisionMap(divisions) {
  const m = {};
  divisions.forEach(d => { m[d.division] = { ...d, expanded: false, loading: false, pincodes: {} }; });
  return m;
}
function buildPincodeMap(pincodes) {
  const m = {};
  pincodes.forEach(p => { m[p.pincode] = { ...p, expanded: false, loading: false, managers: [] }; });
  return m;
}
function getDivNode(hierarchy, stateName, districtName, divisionName) {
  return hierarchy[stateName]?.districts?.[districtName]?.divisions?.[divisionName] || null;
}
function updateDivNode(hierarchy, stateName, districtName, divisionName, patch) {
  const stateNode = hierarchy[stateName] || {};
  const distNode = stateNode.districts?.[districtName] || {};
  const divNode = distNode.divisions?.[divisionName] || {};
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
            [divisionName]: { ...divNode, ...patch }
          }
        }
      }
    }
  };
}
function updatePinNode(hierarchy, stateName, districtName, divisionName, pincode, patch) {
  const stateNode = hierarchy[stateName] || {};
  const distNode = stateNode.districts?.[districtName] || {};
  const divNode = distNode.divisions?.[divisionName] || {};
  const pinNode = divNode.pincodes?.[pincode] || {};
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
            [divisionName]: {
              ...divNode,
              pincodes: {
                ...divNode.pincodes,
                [pincode]: { ...pinNode, ...patch }
              }
            }
          }
        }
      }
    }
  };
}

export default ManagerDirectoryModule;
