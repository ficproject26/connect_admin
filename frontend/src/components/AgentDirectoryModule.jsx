import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users, Search, RefreshCw, Plus, UserCheck, ChevronRight, ChevronDown,
  MapPin, Phone, Mail, Award, AlertTriangle, XCircle, Grid, List, Layers,
  CheckCircle, Clock, Eye, Globe2, Building2, Navigation, Hash, User,
  CalendarDays, BadgeCheck, ShieldOff, Ban
} from 'lucide-react';

// Module-level in-memory cache
let MEMORY_AGENT_CACHE = null;

const getCachedAgents = () => {
  if (Array.isArray(MEMORY_AGENT_CACHE) && MEMORY_AGENT_CACHE.length > 0) return MEMORY_AGENT_CACHE;
  try {
    const raw = sessionStorage.getItem('connect_agent_directory_cache');
    if (raw) { const parsed = JSON.parse(raw); if (Array.isArray(parsed) && parsed.length > 0) { MEMORY_AGENT_CACHE = parsed; return parsed; } }
  } catch (e) {}
  return [];
};

const setCachedAgents = (list) => {
  if (Array.isArray(list) && list.length > 0) {
    MEMORY_AGENT_CACHE = list;
    try { sessionStorage.setItem('connect_agent_directory_cache', JSON.stringify(list)); } catch (e) {}
  }
};

// Level config tokens
const LEVEL_CONFIG = {
  state:    { icon: Globe2,     accentBorder: 'border-l-violet-500', bg: 'bg-violet-100 dark:bg-violet-900/40',   text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-300/60 dark:border-violet-700/50', badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300/50', label: 'STATE'    },
  district: { icon: Navigation, accentBorder: 'border-l-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900/40',       text: 'text-blue-600 dark:text-blue-400',     border: 'border-blue-300/60 dark:border-blue-700/50',     badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300/50',         label: 'DISTRICT' },
  division: { icon: Building2,  accentBorder: 'border-l-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-900/40',   text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-300/60 dark:border-indigo-700/50', badge: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300/50', label: 'DIVISION' },
  pincode:  { icon: Hash,       accentBorder: 'border-l-emerald-500',bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400',border: 'border-emerald-300/60 dark:border-emerald-700/50',badge: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50',label: 'PINCODE'  },
};

const STATUS_CONFIG = {
  approved:  { label: 'Active',    cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
  active:    { label: 'Active',    cls: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50', dot: 'bg-emerald-500' },
  pending:   { label: 'Pending',   cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50', dot: 'bg-amber-500' },
  suspended: { label: 'Suspended', cls: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-300/50 dark:border-orange-700/50', dot: 'bg-orange-500' },
  revoked:   { label: 'Revoked',   cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300/50 dark:border-rose-700/50', dot: 'bg-rose-500' },
  rejected:  { label: 'Rejected',  cls: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300/50 dark:border-rose-700/50', dot: 'bg-rose-500' },
};
const getStatusConfig = (status) => STATUS_CONFIG[(status || '').toLowerCase()] || STATUS_CONFIG.pending;

export default function AgentDirectoryModule({
  token, API_BASE, initialAgents = [], onAgentsUpdated,
  onOpenOnboardingModal, onOpenOnboardingRequests, onOpenAddAgentModal
}) {
  const [agents, setAgents] = useState(() => (Array.isArray(initialAgents) && initialAgents.length > 0 ? initialAgents : getCachedAgents()));
  const [loading, setLoading] = useState(() => !(Array.isArray(initialAgents) && initialAgents.length > 0));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [bgNotice, setBgNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [agentLevelFilter, setAgentLevelFilter] = useState('all');
  const [agentViewMode, setAgentViewMode] = useState('tree');
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedScorecardAgent, setSelectedScorecardAgent] = useState(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [scorecardData, setScorecardData] = useState(null);
  const [scorecardError, setScorecardError] = useState(null);
  const [actionConfirmModal, setActionConfirmModal] = useState({ isOpen: false, agent: null, action: null, reason: '', loading: false, error: null });

  const openAgentScorecard = useCallback(async (agentObj) => {
    if (!agentObj) return;
    setSelectedScorecardAgent(agentObj); setScorecardLoading(true); setScorecardError(null); setScorecardData(null);
    const agId = agentObj._id || agentObj.id || agentObj.registrationId;
    if (!token || !agId) { setScorecardLoading(false); return; }
    const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
    const baseClean = (API_BASE || 'https://api.ficapp.in/admin-api').trim().replace(/\/+$/, '').replace(/\/api$/, '/admin-api');
    let fetched = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${baseClean}/admin/agents/${agId}/scorecard`, { headers, signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) { const data = await res.json(); if (data && data.success) { setScorecardData(data); fetched = true; } }
    } catch (e) { if (e.name !== 'AbortError') console.warn('Fetch scorecard warning:', e.message); }
    if (!fetched) setScorecardError('Unable to load real-time agent details from server.');
    setScorecardLoading(false);
  }, [token, API_BASE]);

  const inFlightPromiseRef = useRef(null);

  useEffect(() => {
    if (Array.isArray(initialAgents) && initialAgents.length > 0) {
      setAgents(initialAgents);
      setCachedAgents(initialAgents);
      setLoading(false);
      setBgNotice(null);
      setError(null);
    }
  }, [initialAgents]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const safeFetchAgents = useCallback(async () => {
    const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('admin_token') || '') : '');
    if (!activeToken) return null;
    const headers = {
      'x-auth-token': activeToken,
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/json'
    };
    const baseClean = (API_BASE || 'https://api.ficapp.in/admin-api').trim().replace(/\/+$/, '').replace(/\/api$/, '/admin-api');
    const candidates = [
      `${baseClean}/admin/agents`,
      `${baseClean}/agents`,
      `${baseClean.replace(/\/admin-api$/, '')}/admin-api/agents`,
      `${baseClean.replace(/\/admin-api$/, '')}/api/admin/agents`
    ];
    const urls = Array.from(new Set(candidates.map(u => u.replace(/([^:])\/\//g, '$1/').replace(/\/admin-api\/admin-api\//g, '/admin-api/'))));
    for (const u of urls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(u, { headers, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data) {
            const list = Array.isArray(data) ? data : (data.agents || data.data || []);
            return list;
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') console.warn('Fetch agents attempt warning:', u, e.message);
      }
    }
    return null;
  }, [token, API_BASE]);

  const normalizeAgentList = useCallback((data) => {
    if (!data) return [];
    let list = Array.isArray(data) ? data : (data.agents || data.data || []);
    const seen = new Set();
    return list.map(item => {
      if (!item) return null;
      const ag = item.agent || item;
      const metrics = item.metrics || {};
      const rawStatus = ag.status || item.status || ag.kycStatus || item.kycStatus || 'pending';
      const rawKycStatus = ag.kycStatus || item.kycStatus || ag.status || item.status || 'pending';
      const rawLvlStr = (ag.level || item.level || ag.agentLevel || item.agentLevel || ag.role || item.role || ag.assignedRole || item.assignedRole || ag.agentType || 'pincode').toString().toLowerCase().trim();
      let resolvedLvl = 'pincode';
      if (rawLvlStr.includes('state')) resolvedLvl = 'state';
      else if (rawLvlStr.includes('district') || rawLvlStr.includes('dist')) resolvedLvl = 'district';
      else if (rawLvlStr.includes('divis') || rawLvlStr.includes('division')) resolvedLvl = 'division';
      return {
        ...ag, _id: ag._id || item._id,
        name: ag.name || item.name || ag.fullName || 'Agent Partner',
        email: ag.email || item.email || '', phone: ag.phone || item.phone || ag.mobile || '',
        role: ag.role || item.role || 'agent', level: resolvedLvl,
        status: rawStatus, kycStatus: rawKycStatus,
        registrationId: ag.registrationId || ag.id || (ag._id ? `REG-${String(ag._id).substring(18, 24).toUpperCase()}` : 'REG-N/A'),
        assignedState: ag.assignedState || ag.state || ag.territory?.state || '',
        assignedDistrict: ag.assignedDistrict || ag.district || ag.territory?.district || '',
        assignedDivision: ag.assignedDivision || ag.division || ag.territory?.division || '',
        assignedPincode: ag.assignedPincode || ag.pincode || ag.territory?.pincode || '',
        assignedArea: ag.assignedArea || (ag.territory ? Object.values(ag.territory).filter(Boolean).join(' / ') : ''),
        territory: ag.territory || {}, balance: ag.balance !== undefined ? ag.balance : (metrics.revenue || 0),
        commissionEarned: ag.commissionEarned !== undefined ? ag.commissionEarned : (metrics.commission || 0),
        createdAt: ag.createdAt || ag.created_at || new Date().toISOString()
      };
    }).filter(Boolean).filter(ag => {
      const key = (ag._id ? `id_${ag._id}` : null) || (ag.registrationId && ag.registrationId !== 'undefined' ? `reg_${ag.registrationId}` : null) || (ag.email && ag.email !== 'undefined' ? `em_${ag.email}` : null);
      if (!key || seen.has(key)) return false; seen.add(key); return true;
    });
  }, []);

  const agentsRef = useRef(agents);
  useEffect(() => { agentsRef.current = agents; }, [agents]);

  const loadAgentData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!agentsRef.current || agentsRef.current.length === 0) setLoading(true);
    setError(null);
    if (inFlightPromiseRef.current) {
      try { const data = await inFlightPromiseRef.current; if (data) { const p = normalizeAgentList(data); if (p.length > 0) { setAgents(p); setCachedAgents(p); if (typeof onAgentsUpdated === 'function') onAgentsUpdated(p); setError(null); setBgNotice(null); } } } catch (e) {}
      setLoading(false); setRefreshing(false); return;
    }
    try {
      const fetchPromise = safeFetchAgents(); inFlightPromiseRef.current = fetchPromise;
      const data = await fetchPromise; inFlightPromiseRef.current = null;
      if (data !== null && data !== undefined) {
        const p = normalizeAgentList(data);
        setAgents(p);
        setCachedAgents(p);
        if (typeof onAgentsUpdated === 'function') onAgentsUpdated(p);
        setError(null);
        setBgNotice(null);
      } else {
        if (isRefresh) {
          setBgNotice('Unable to reach server. Showing offline snapshot.');
        } else if (!agentsRef.current || agentsRef.current.length === 0) {
          const fb = getCachedAgents();
          if (fb && fb.length > 0) {
            setAgents(fb);
          } else {
            setError('Unable to load latest data. Please try again.');
          }
        }
      }
    } catch (err) {
      inFlightPromiseRef.current = null;
      if (isRefresh) {
        setBgNotice('Unable to reach server. Showing offline snapshot.');
      } else if (!agentsRef.current || agentsRef.current.length === 0) {
        const fb = getCachedAgents();
        if (fb && fb.length > 0) {
          setAgents(fb);
        } else {
          setError('Unable to load latest data. Please try again.');
        }
      }
    } finally { setLoading(false); setRefreshing(false); }
  }, [safeFetchAgents, normalizeAgentList, onAgentsUpdated]);

  useEffect(() => { loadAgentData(false); }, [loadAgentData]);

  const handleOpenActionConfirm = useCallback((agent, action) => {
    setActionConfirmModal({ isOpen: true, agent, action, reason: '', loading: false, error: null });
  }, []);

  const handleExecuteAgentAction = useCallback(async () => {
    const { agent, action, reason } = actionConfirmModal;
    if (!agent || !agent._id) return;
    setActionConfirmModal(prev => ({ ...prev, loading: true, error: null }));
    try {
      let endpoint = '', targetStatus = '';
      if (action === 'suspend') { endpoint = `/api/admin/agents/${agent._id}/suspend`; targetStatus = 'suspended'; }
      else if (action === 'revoke') { endpoint = `/api/admin/agents/${agent._id}/revoke`; targetStatus = 'revoked'; }
      else if (action === 'reactivate') { endpoint = `/api/admin/agents/${agent._id}/approve`; targetStatus = 'approved'; }
      const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
      const body = JSON.stringify({ status: targetStatus, agentId: agent._id, reason: reason || `${action} by administrator`, rejectionReason: reason || `${action} by administrator` });
      const baseClean = (API_BASE || 'https://api.ficapp.in/admin-api').trim().replace(/\/+$/, '').replace(/\/api$/, '/admin-api');
      const url = `${baseClean}${endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint}`;
      let resSuccess = false, errMsg = '';
      try { const res = await fetch(url, { method: 'PUT', headers, body }); const rd = await res.json().catch(() => ({})); if (res.ok) resSuccess = true; else errMsg = rd.msg || rd.message || 'Action failed'; } catch (e) { errMsg = e.message; }
      if (!resSuccess) { setActionConfirmModal(prev => ({ ...prev, loading: false, error: errMsg || 'Failed to update agent status' })); return; }
      setAgents(prev => {
        const updated = prev.map(a => a._id === agent._id || (a.registrationId && a.registrationId === agent.registrationId)
          ? { ...a, status: targetStatus, kycStatus: targetStatus, isActive: targetStatus === 'approved', isApproved: targetStatus === 'approved', assignedArea: targetStatus === 'revoked' ? null : a.assignedArea, assignedPincode: targetStatus === 'revoked' ? null : a.assignedPincode }
          : a);
        setCachedAgents(updated); if (typeof onAgentsUpdated === 'function') onAgentsUpdated(updated); return updated;
      });
      setActionConfirmModal({ isOpen: false, agent: null, action: null, reason: '', loading: false, error: null });
      if (selectedScorecardAgent && (selectedScorecardAgent._id === agent._id || selectedScorecardAgent.registrationId === agent.registrationId)) setSelectedScorecardAgent(null);
      loadAgentData(true);
    } catch (err) { setActionConfirmModal(prev => ({ ...prev, loading: false, error: err.message })); }
  }, [actionConfirmModal, token, API_BASE, loadAgentData, onAgentsUpdated, selectedScorecardAgent]);

  const isApprovedAgent = (agent) => {
    if (!agent) return false;
    const s = (agent.status || '').toLowerCase().trim(), k = (agent.kycStatus || '').toLowerCase().trim();
    return !['rejected', 'suspended', 'deactivated', 'blocked', 'revoked'].includes(s) && !['rejected', 'suspended', 'deactivated', 'blocked', 'revoked'].includes(k);
  };
  const isPendingAgent = (agent) => {
    if (!agent) return false;
    const s = (agent.status || '').toLowerCase().trim(), k = (agent.kycStatus || '').toLowerCase().trim();
    return ['pending', 'pending_approval', 'under_verification', 'requested'].includes(s) || ['pending', 'under_verification'].includes(k);
  };
  const extractAgentTerritory = (ag) => {
    let state = (ag.assignedState || ag.territory?.state || '').trim();
    let district = (ag.assignedDistrict || ag.territory?.district || '').trim();
    let division = (ag.assignedDivision || ag.territory?.division || '').trim();
    let pincode = (ag.assignedPincode?.code || ag.assignedPincode || ag.territory?.pincode || '').trim();
    if (ag.assignedArea && typeof ag.assignedArea === 'string') {
      const parts = ag.assignedArea.split('/').map(s => s.trim()).filter(Boolean);
      if (!state && parts[0]) state = parts[0]; if (!district && parts[1]) district = parts[1];
      if (!division && parts[2]) division = parts[2]; if (!pincode && parts[3] && /^\d{6}$/.test(parts[3])) pincode = parts[3];
    }
    return { state: state || 'General State', district: district || 'General District', division: division || 'General Division', pincode: pincode || 'N/A' };
  };

  const approvedAgents = agents.filter(isApprovedAgent);
  const pendingCount = agents.filter(isPendingAgent).length;
  const counts = {
    total: approvedAgents.length, state: approvedAgents.filter(a => a.level === 'state').length,
    district: approvedAgents.filter(a => a.level === 'district').length, division: approvedAgents.filter(a => a.level === 'division').length,
    pincode: approvedAgents.filter(a => a.level === 'pincode').length,
    suspended: agents.filter(a => (a.status || '').toLowerCase() === 'suspended').length,
    revoked: agents.filter(a => (a.status || '').toLowerCase() === 'revoked').length,
    rejected: agents.filter(a => ['rejected', 'inactive'].includes((a.status || '').toLowerCase())).length
  };

  const filteredAgents = agents.filter(a => {
    if (!a) return false;
    const query = debouncedSearch.toLowerCase().trim();
    const terr = extractAgentTerritory(a);
    const matchesSearch = !query || (a.name || '').toLowerCase().includes(query) || (a.email || '').toLowerCase().includes(query) || (a.phone && a.phone.includes(query)) || (a.registrationId && a.registrationId.toLowerCase().includes(query)) || terr.state.toLowerCase().includes(query) || terr.district.toLowerCase().includes(query) || terr.division.toLowerCase().includes(query) || terr.pincode.includes(query);
    const aStatus = (a.status || '').toLowerCase();
    if (agentLevelFilter === 'suspended') return matchesSearch && aStatus === 'suspended';
    if (agentLevelFilter === 'revoked') return matchesSearch && aStatus === 'revoked';
    if (agentLevelFilter === 'rejected') return matchesSearch && ['rejected', 'inactive'].includes(aStatus);
    if (!isApprovedAgent(a)) return false;
    let matchesLevel = true;
    if (agentLevelFilter === 'state') matchesLevel = a.level === 'state';
    else if (agentLevelFilter === 'district') matchesLevel = a.level === 'district';
    else if (agentLevelFilter === 'division') matchesLevel = a.level === 'division';
    else if (agentLevelFilter === 'pincode') matchesLevel = a.level === 'pincode';
    return matchesSearch && matchesLevel;
  });

  const buildHierarchyMap = () => {
    const map = {};
    filteredAgents.forEach(ag => {
      const t = extractAgentTerritory(ag), s = t.state, d = t.district, v = t.division, p = t.pincode;
      if (!map[s]) map[s] = { stateName: s, stateAgents: [], districts: {} };
      if (ag.level === 'state') { map[s].stateAgents.push(ag); return; }
      if (!map[s].districts[d]) map[s].districts[d] = { districtName: d, districtAgents: [], divisions: {} };
      if (ag.level === 'district') { map[s].districts[d].districtAgents.push(ag); return; }
      if (!map[s].districts[d].divisions[v]) map[s].districts[d].divisions[v] = { divisionName: v, divisionAgents: [], pincodes: {} };
      if (ag.level === 'division') { map[s].districts[d].divisions[v].divisionAgents.push(ag); return; }
      if (!map[s].districts[d].divisions[v].pincodes[p]) map[s].districts[d].divisions[v].pincodes[p] = { pincodeCode: p, pincodeAgents: [] };
      map[s].districts[d].divisions[v].pincodes[p].pincodeAgents.push(ag);
    });
    return map;
  };

  const toggleNode = (nodeId) => setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));

  useEffect(() => {
    if (debouncedSearch && debouncedSearch.trim().length > 0) {
      const ae = {};
      filteredAgents.forEach(ag => { const t = extractAgentTerritory(ag); ae[`st_${t.state}`] = true; ae[`dist_${t.state}_${t.district}`] = true; ae[`div_${t.state}_${t.district}_${t.division}`] = true; ae[`pin_${t.state}_${t.district}_${t.division}_${t.pincode}`] = true; });
      setExpandedNodes(ae);
    }
  }, [debouncedSearch, filteredAgents]);

  useEffect(() => {
    if (agents.length > 0) {
      const hMap = buildHierarchyMap(); const de = {};
      Object.values(hMap).forEach(st => { de[`st_${st.stateName}`] = true; Object.values(st.districts).forEach(dist => { de[`dist_${st.stateName}_${dist.districtName}`] = true; }); });
      setExpandedNodes(prev => (Object.keys(prev).length === 0 ? de : prev));
    }
  }, [agents]);

  const expandAllNodes = (hMap) => {
    const all = {};
    Object.values(hMap).forEach(st => {
      all[`st_${st.stateName}`] = true;
      Object.values(st.districts).forEach(dist => {
        all[`dist_${st.stateName}_${dist.districtName}`] = true;
        Object.values(dist.divisions).forEach(div => {
          all[`div_${st.stateName}_${dist.districtName}_${div.divisionName}`] = true;
          Object.values(div.pincodes).forEach(pin => { all[`pin_${st.stateName}_${dist.districtName}_${div.divisionName}_${pin.pincodeCode}`] = true; });
        });
      });
    });
    setExpandedNodes(all);
  };
  const collapseAllNodes = () => setExpandedNodes({});

  const getStateTotalCount = (st) => { let c = st.stateAgents.length; Object.values(st.districts).forEach(d => { c += d.districtAgents.length; Object.values(d.divisions).forEach(dv => { c += dv.divisionAgents.length; Object.values(dv.pincodes).forEach(p => { c += p.pincodeAgents.length; }); }); }); return c; };
  const getDistrictTotalCount = (d) => { let c = d.districtAgents.length; Object.values(d.divisions).forEach(dv => { c += dv.divisionAgents.length; Object.values(dv.pincodes).forEach(p => { c += p.pincodeAgents.length; }); }); return c; };
  const getDivisionTotalCount = (div) => { let c = div.divisionAgents.length; Object.values(div.pincodes).forEach(p => { c += p.pincodeAgents.length; }); return c; };

  return (
    <div className="space-y-5">

      {bgNotice && agents.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{bgNotice}</span>
          <button type="button" onClick={() => setBgNotice(null)} className="text-amber-500 hover:text-amber-700 font-bold ml-2 cursor-pointer">&#10005;</button>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-500/15 flex items-center justify-center"><Users className="w-4 h-4 text-primary-600 dark:text-primary-400" /></div>
            Agent Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1 pl-11">State &#8594; District &#8594; Division &#8594; Pincode &#8594; Agent</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => loadAgentData(true)} disabled={refreshing}
            className="h-9 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-500' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button type="button"
            onClick={() => { if (typeof onOpenOnboardingModal === 'function') onOpenOnboardingModal(); else if (typeof onOpenOnboardingRequests === 'function') onOpenOnboardingRequests(); else { setShowOnboardingModal(true); loadAgentData(true); } }}
            className="h-9 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer">
            <UserCheck className="w-4 h-4" />Onboarding Requests
            {pendingCount > 0 && <span className="bg-white text-amber-900 text-[10px] font-black px-1.5 py-0 rounded-full">{pendingCount}</span>}
          </button>
          <button type="button" onClick={onOpenAddAgentModal} className="h-9 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer">
            <Plus className="w-4 h-4" /> Add Agent
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { id: 'all', label: 'Total Agents', count: counts.total, Icon: Users, color: 'text-primary-600 dark:text-primary-400', activeBg: 'bg-primary-50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-800' },
          { id: 'state', label: 'State', count: counts.state, Icon: Globe2, color: 'text-violet-600 dark:text-violet-400', activeBg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-300 dark:border-violet-800' },
          { id: 'district', label: 'District', count: counts.district, Icon: Navigation, color: 'text-blue-600 dark:text-blue-400', activeBg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800' },
          { id: 'division', label: 'Division', count: counts.division, Icon: Building2, color: 'text-indigo-600 dark:text-indigo-400', activeBg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-800' },
          { id: 'pincode', label: 'Pincode', count: counts.pincode, Icon: Hash, color: 'text-emerald-600 dark:text-emerald-400', activeBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' },
        ].map(card => {
          const active = agentLevelFilter === card.id;
          return (
            <button key={card.id} type="button" onClick={() => setAgentLevelFilter(card.id)}
              className={`p-3.5 rounded-2xl text-left cursor-pointer transition-all border ${active ? `${card.activeBg} shadow-sm` : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <card.Icon className={`w-4 h-4 ${active ? card.color : 'text-slate-400'}`} />
                <span className={`text-2xl font-black ${active ? card.color : 'text-slate-700 dark:text-slate-200'}`}>{loading && agents.length === 0 ? '&#8212;' : card.count}</span>
              </div>
              <span className={`text-[11px] font-bold ${active ? card.color : 'text-slate-400'}`}>{card.label} Agents</span>
            </button>
          );
        })}
      </div>

      {/* TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 rounded-xl flex-1">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input type="text" id="agent-directory-search" placeholder="Search agent, ID, state, district, division, pincode..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent focus:outline-none text-xs w-full text-slate-800 dark:text-slate-100 placeholder:text-slate-400" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm leading-none cursor-pointer shrink-0">&#10005;</button>}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
            {[{ id: 'tree', label: 'Tree', Icon: Layers }, { id: 'list', label: 'List', Icon: List }, { id: 'grid', label: 'Grid', Icon: Grid }].map(v => (
              <button key={v.id} type="button" onClick={() => setAgentViewMode(v.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${agentViewMode === v.id ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <v.Icon className="w-3.5 h-3.5" />{v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mr-1">Filter:</span>
          {[
            { id: 'all', label: 'All Agents', count: counts.total },
            { id: 'state', label: 'State Agents', count: counts.state },
            { id: 'district', label: 'District Agents', count: counts.district },
            { id: 'division', label: 'Division Agents', count: counts.division },
            { id: 'pincode', label: 'Pincode Agents', count: counts.pincode },
            { id: 'suspended', label: 'Suspended', count: counts.suspended },
            { id: 'revoked', label: 'Revoked', count: counts.revoked },
            { id: 'rejected', label: 'Rejected', count: counts.rejected },
          ].map(f => {
            const active = agentLevelFilter === f.id;
            return (
              <button key={f.id} type="button" onClick={() => setAgentLevelFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${active ? (f.id === 'suspended' ? 'bg-orange-500 text-white border-orange-500' : ['revoked', 'rejected'].includes(f.id) ? 'bg-rose-600 text-white border-rose-600' : 'bg-primary-600 text-white border-primary-600') : 'bg-white dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                {f.label}
                <span className={`text-[10px] px-1.5 rounded-full font-bold ${active ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && agents.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 p-3 rounded-xl text-xs font-semibold flex justify-between items-center text-amber-700 dark:text-amber-400">
          <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{error}</span>
          <button onClick={() => loadAgentData(true)} className="underline font-bold hover:text-amber-800 cursor-pointer">Retry</button>
        </div>
      )}

      {/* CONTENT */}
      {loading && agents.length === 0 ? (
        <div className="space-y-3">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-primary-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Loading agent hierarchy...</p>
            <p className="text-xs text-slate-400">Fetching live records from database.</p>
          </div>
          {[1, 2, 3].map(sk => (
            <div key={sk} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl animate-pulse flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
              <div className="space-y-2 flex-1"><div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-2/5" /><div className="h-2.5 bg-slate-200 dark:bg-slate-800 rounded-md w-1/3" /></div>
            </div>
          ))}
        </div>
      ) : error && agents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-12 text-center space-y-4">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div><h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Unable to load agent data</h4><p className="text-xs text-slate-400 mt-1">{error}</p></div>
          <button type="button" onClick={() => loadAgentData(true)} className="bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all cursor-pointer">Retry</button>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No agents found</p>
          <p className="text-xs text-slate-400">{debouncedSearch ? `No results for "${debouncedSearch}".` : 'No agents registered under this filter.'}</p>
        </div>
      ) : (
        <div>

          {/* ======== 1. TREE VIEW ======== */}
          {agentViewMode === 'tree' && (() => {
            const hMap = buildHierarchyMap();
            const stateList = Object.values(hMap);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">{stateList.length} State{stateList.length !== 1 ? 's' : ''} &middot; {filteredAgents.length} Agents</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => expandAllNodes(hMap)} className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer">Expand All</button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button type="button" onClick={collapseAllNodes} className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer">Collapse All</button>
                  </div>
                </div>

                {stateList.map(st => {
                  const sKey = `st_${st.stateName}`, isOpen = !!expandedNodes[sKey];
                  const totalAgents = getStateTotalCount(st), districtList = Object.values(st.districts);
                  return (
                    <div key={st.stateName} className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                      {/* STATE ROW */}
                      <button type="button" onClick={() => toggleNode(sKey)} aria-expanded={isOpen}
                        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors group text-left border-l-4 border-l-violet-500">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${isOpen ? 'bg-violet-100 dark:bg-violet-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-500" />}
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
                          <Globe2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{st.stateName}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-wider bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 border border-violet-300/40">State</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{st.stateAgents.length > 0 ? `${st.stateAgents.length} state agent${st.stateAgents.length !== 1 ? 's' : ''} \u00b7 ` : ''}{districtList.length} district{districtList.length !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg shrink-0">{totalAgents} agent{totalAgents !== 1 ? 's' : ''}</span>
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-100 dark:border-slate-800">
                          {st.stateAgents.length > 0 && (
                            <div className="px-4 pt-3 pb-2 space-y-2">
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-500 flex items-center gap-1.5"><User className="w-3 h-3" /> State Level Agents ({st.stateAgents.length})</p>
                              {st.stateAgents.map(ag => <AgentLeafCard key={ag._id || ag.registrationId} agent={ag} level="state" onInspect={openAgentScorecard} onAction={handleOpenActionConfirm} />)}
                            </div>
                          )}

                          {districtList.map(dist => {
                            const dKey = `dist_${st.stateName}_${dist.districtName}`, isDistOpen = !!expandedNodes[dKey];
                            const distTotal = getDistrictTotalCount(dist), divisionList = Object.values(dist.divisions);
                            return (
                              <div key={dist.districtName} className="border-t border-slate-100 dark:border-slate-800">
                                <button type="button" onClick={() => toggleNode(dKey)} aria-expanded={isDistOpen}
                                  className="w-full flex items-center gap-3 pl-10 pr-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-colors group text-left border-l-4 border-l-blue-400">
                                  <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isDistOpen ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                    {isDistOpen ? <ChevronDown className="w-3 h-3 text-blue-600 dark:text-blue-400" /> : <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />}
                                  </div>
                                  <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0"><Navigation className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /></div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">&#128205; {dist.districtName}</span>
                                      <span className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">District</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{dist.districtAgents.length > 0 ? `${dist.districtAgents.length} district agent${dist.districtAgents.length !== 1 ? 's' : ''} \u00b7 ` : ''}{divisionList.length} division{divisionList.length !== 1 ? 's' : ''}</p>
                                  </div>
                                  <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">{distTotal} agent{distTotal !== 1 ? 's' : ''}</span>
                                </button>

                                {isDistOpen && (
                                  <div className="bg-slate-50/60 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
                                    {dist.districtAgents.length > 0 && (
                                      <div className="px-4 pl-16 pt-3 pb-2 space-y-2">
                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-blue-500 flex items-center gap-1.5"><User className="w-3 h-3" /> District Agents ({dist.districtAgents.length})</p>
                                        {dist.districtAgents.map(ag => <AgentLeafCard key={ag._id || ag.registrationId} agent={ag} level="district" onInspect={openAgentScorecard} onAction={handleOpenActionConfirm} />)}
                                      </div>
                                    )}

                                    {divisionList.map(div => {
                                      const vKey = `div_${st.stateName}_${dist.districtName}_${div.divisionName}`, isDivOpen = !!expandedNodes[vKey];
                                      const divTotal = getDivisionTotalCount(div), pincodeList = Object.values(div.pincodes);
                                      return (
                                        <div key={div.divisionName} className="border-t border-slate-100 dark:border-slate-800/60">
                                          <button type="button" onClick={() => toggleNode(vKey)} aria-expanded={isDivOpen}
                                            className="w-full flex items-center gap-3 pl-16 pr-4 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors group text-left border-l-4 border-l-indigo-400">
                                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isDivOpen ? 'bg-indigo-100 dark:bg-indigo-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                              {isDivOpen ? <ChevronDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /> : <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-500" />}
                                            </div>
                                            <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0"><Building2 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" /></div>
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2">
                                                <span className="font-semibold text-[13px] text-slate-700 dark:text-slate-300">&#127970; {div.divisionName}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400">Division</span>
                                              </div>
                                              <p className="text-[11px] text-slate-400 mt-0.5">{div.divisionAgents.length > 0 ? `${div.divisionAgents.length} division agent${div.divisionAgents.length !== 1 ? 's' : ''} \u00b7 ` : ''}{pincodeList.length} pincode{pincodeList.length !== 1 ? 's' : ''}</p>
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">{divTotal} agent{divTotal !== 1 ? 's' : ''}</span>
                                          </button>

                                          {isDivOpen && (
                                            <div className="bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/60">
                                              {div.divisionAgents.length > 0 && (
                                                <div className="px-4 pl-24 pt-3 pb-2 space-y-2">
                                                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500 flex items-center gap-1.5"><User className="w-3 h-3" /> Division Agents ({div.divisionAgents.length})</p>
                                                  {div.divisionAgents.map(ag => <AgentLeafCard key={ag._id || ag.registrationId} agent={ag} level="division" onInspect={openAgentScorecard} onAction={handleOpenActionConfirm} />)}
                                                </div>
                                              )}
                                              {pincodeList.length === 0 && div.divisionAgents.length === 0 && <p className="text-[11px] text-slate-400 italic pl-24 pr-4 py-3">No pincode data.</p>}

                                              {pincodeList.map(pin => {
                                                const pKey = `pin_${st.stateName}_${dist.districtName}_${div.divisionName}_${pin.pincodeCode}`, isPinOpen = !!expandedNodes[pKey];
                                                return (
                                                  <div key={pin.pincodeCode} className="border-t border-slate-100 dark:border-slate-800/60">
                                                    <button type="button" onClick={() => toggleNode(pKey)} aria-expanded={isPinOpen}
                                                      className="w-full flex items-center gap-3 pl-24 pr-4 py-2.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors group text-left border-l-4 border-l-emerald-400">
                                                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${isPinOpen ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
                                                        {isPinOpen ? <ChevronDown className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />}
                                                      </div>
                                                      <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0"><Hash className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /></div>
                                                      <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                          <span className="font-semibold text-[13px] text-slate-700 dark:text-slate-300">&#128204; {pin.pincodeCode}</span>
                                                          <span className="text-[10px] px-1.5 py-0.5 rounded font-black uppercase bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400">Pincode</span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">{pin.pincodeAgents.length} agent{pin.pincodeAgents.length !== 1 ? 's' : ''} registered</p>
                                                      </div>
                                                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">{pin.pincodeAgents.length} agent{pin.pincodeAgents.length !== 1 ? 's' : ''}</span>
                                                    </button>

                                                    {isPinOpen && (
                                                      <div className="bg-white dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800/60 pl-32 pr-4 pt-3 pb-3 space-y-2">
                                                        <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 mb-1.5"><User className="w-3 h-3" /> Pincode Agents ({pin.pincodeAgents.length})</p>
                                                        {pin.pincodeAgents.length > 0
                                                          ? pin.pincodeAgents.map(ag => <AgentLeafCard key={ag._id || ag.registrationId} agent={ag} level="pincode" onInspect={openAgentScorecard} onAction={handleOpenActionConfirm} />)
                                                          : <p className="text-[11px] text-slate-400 italic">No agents registered under this pincode.</p>}
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
                                    {divisionList.length === 0 && dist.districtAgents.length === 0 && <p className="text-[11px] text-slate-400 italic pl-16 pr-4 py-3">No division data available.</p>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {districtList.length === 0 && st.stateAgents.length === 0 && <p className="text-[11px] text-slate-400 italic px-4 py-3">No district data available.</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* ======== 2. LIST VIEW ======== */}
          {agentViewMode === 'list' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3.5">Agent Info</th><th className="px-5 py-3.5">Level</th><th className="px-5 py-3.5">Territory</th>
                      <th className="px-5 py-3.5">Contact</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5">Reg. Date</th><th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredAgents.map(ag => {
                      const terr = extractAgentTerritory(ag), st = getStatusConfig(ag.status), cfg = LEVEL_CONFIG[ag.level] || LEVEL_CONFIG.pincode;
                      return (
                        <tr key={ag._id} onClick={() => openAgentScorecard(ag)} className="hover:bg-primary-500/5 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
                          <td className="px-5 py-3.5"><span className="block font-bold text-slate-800 dark:text-slate-100">{ag.name}</span><span className="text-[10px] font-mono text-slate-400">{ag.registrationId}</span></td>
                          <td className="px-5 py-3.5"><span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg.badge}`}>{ag.level}</span></td>
                          <td className="px-5 py-3.5"><span className="block text-slate-700 dark:text-slate-300 font-semibold">{terr.state} / {terr.district}</span><span className="text-[10px] text-slate-400">{terr.division} {terr.pincode !== 'N/A' ? `(${terr.pincode})` : ''}</span></td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400"><span className="block">{ag.email || 'N/A'}</span><span className="text-[10px] font-mono">{ag.phone || 'N/A'}</span></td>
                          <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
                          <td className="px-5 py-3.5 text-slate-400 text-[10px]">{new Date(ag.createdAt).toLocaleDateString()}</td>
                          <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => openAgentScorecard(ag)} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer">View</button>
                              {ag.status?.toLowerCase() === 'suspended' ? (
                                <><button type="button" onClick={() => handleOpenActionConfirm(ag, 'reactivate')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-600 border border-emerald-500/20 transition-colors cursor-pointer">Reactivate</button>
                                <button type="button" onClick={() => handleOpenActionConfirm(ag, 'revoke')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-500/20 transition-colors cursor-pointer">Revoke</button></>
                              ) : ag.status?.toLowerCase() !== 'revoked' && ag.status?.toLowerCase() !== 'rejected' ? (
                                <><button type="button" onClick={() => handleOpenActionConfirm(ag, 'suspend')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 border border-amber-500/20 transition-colors cursor-pointer">Suspend</button>
                                <button type="button" onClick={() => handleOpenActionConfirm(ag, 'revoke')} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 border border-rose-500/20 transition-colors cursor-pointer">Revoke</button></>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ======== 3. GRID VIEW ======== */}
          {agentViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map(ag => <AgentLeafCard key={ag._id || ag.registrationId} agent={ag} level={ag.level} onInspect={openAgentScorecard} onAction={handleOpenActionConfirm} compact={false} />)}
            </div>
          )}
        </div>
      )}

      {/* ONBOARDING MODAL (internal fallback) */}
      {showOnboardingModal && !onOpenOnboardingModal && !onOpenOnboardingRequests && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><UserCheck className="w-5 h-5 text-amber-500" />Agent Onboarding Requests ({agents.filter(isPendingAgent).length})</h3><p className="text-xs text-slate-400 mt-1">Review pending agent registration and KYC approval applications</p></div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => loadAgentData(true)} disabled={refreshing} className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 px-3 py-1.5 rounded-xl border border-primary-200 dark:border-primary-800 transition-all cursor-pointer disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh List
                </button>
                <button type="button" onClick={() => setShowOnboardingModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">&#10005;</button>
              </div>
            </div>
            <div className="space-y-4">
              {agents.filter(isPendingAgent).map((pAgent) => {
                const terr = extractAgentTerritory(pAgent);
                return (
                  <div key={pAgent._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{pAgent.name}</span>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">{pAgent.level || 'Pincode'} Agent</span>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 capitalize">{pAgent.status || pAgent.kycStatus || 'Pending Review'}</span>
                      </div>
                      <p className="text-xs text-slate-400">{pAgent.email || 'No email'} &#8226; {pAgent.phone || 'No phone'}</p>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-amber-500" />Territory: {terr.state} &#8594; {terr.district} &#8594; {terr.division} &#8594; {terr.pincode}</p>
                      <p className="text-[11px] font-mono text-slate-400">REG ID: {pAgent.registrationId} | Applied: {new Date(pAgent.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <button type="button" disabled={refreshing} onClick={async (e) => { const b = e.currentTarget; b.disabled = true; try { const h = { 'x-auth-token': token, 'Content-Type': 'application/json' }; const body = JSON.stringify({ status: 'rejected', agentId: pAgent._id, email: pAgent.email, phone: pAgent.phone, registrationId: pAgent.registrationId }); const bc = (API_BASE || 'https://api.ficapp.in/admin-api').trim().replace(/\/+$/, '').replace(/\/api$/, '/admin-api'); try { await fetch(`${bc}/admin/approve-agent/${pAgent._id}`, { method: 'PUT', headers: h, body }); } catch(e) {} loadAgentData(true); } catch(err) {} finally { b.disabled = false; } }} className="bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50">Reject</button>
                      <button type="button" disabled={refreshing} onClick={async (e) => { const b = e.currentTarget; b.disabled = true; try { const h = { 'x-auth-token': token, 'Content-Type': 'application/json' }; const body = JSON.stringify({ status: 'approved', agentId: pAgent._id, email: pAgent.email, phone: pAgent.phone, registrationId: pAgent.registrationId }); const bc = (API_BASE || 'https://api.ficapp.in/admin-api').trim().replace(/\/+$/, '').replace(/\/api$/, '/admin-api'); try { await fetch(`${bc}/admin/approve-agent/${pAgent._id}`, { method: 'PUT', headers: h, body }); } catch(e) {} loadAgentData(true); } catch(err) {} finally { b.disabled = false; } }} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-md cursor-pointer disabled:opacity-50">Approve Agent</button>
                    </div>
                  </div>
                );
              })}
              {agents.filter(isPendingAgent).length === 0 && (
                <div className="text-center py-12 text-slate-400"><UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" /><p className="text-sm font-semibold">No pending agent onboarding requests at this time.</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCORECARD MODAL */}
      {selectedScorecardAgent && (() => {
        const ag = scorecardData?.agent || selectedScorecardAgent;
        const metrics = scorecardData?.metrics || { tieupsToday: 0, tieupsYesterday: 0, totalTieups: 0, totalShops: 0, totalRevenue: ag.revenue || ag.balance || 0, performanceScore: 0, regFeeStatus: (ag.isPaid || ag.status === 'approved') ? 'PAID' : 'UNPAID' };
        const downstream = scorecardData?.downstream || { districtAgents: 0, divisionAgents: 0, pincodeAgents: 0 };
        const isApproved = (ag.status === 'approved' || ag.kycStatus === 'approved' || ag.isApproved);
        const lvl = (ag.level || 'pincode').toLowerCase();
        const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.pincode;
        const stateName = ag.assignedState || ag.state || ag.territory?.state || '';
        const districtName = ag.assignedDistrict || ag.district || ag.territory?.district || '';
        const divisionName = ag.assignedDivision || ag.division || ag.territory?.division || '';
        const pincodeCode = ag.assignedPincode?.code || ag.assignedPincode || ag.pincode || ag.territory?.pincode || '';
        const locationParts = [stateName && `State: ${stateName}`, districtName && `District: ${districtName}`, divisionName && `Division: ${divisionName}`, pincodeCode && `PIN: ${pincodeCode}`].filter(Boolean);
        const locationStr = locationParts.length > 0 ? locationParts.join(' \u203a ') : 'General Territory';
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative my-auto">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${cfg.bg} ${cfg.text} font-extrabold text-2xl flex items-center justify-center border ${cfg.border} shrink-0`}>{(ag.name || 'A')[0].toUpperCase()}</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black tracking-wider uppercase px-2.5 py-0.5 rounded-md ${cfg.badge}`}>{lvl.toUpperCase()} AGENT</span>
                      {isApproved
                        ? <span className="border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Approved</span>
                        : <span className="border border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500" /> Pending KYC</span>}
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{ag.name}</h3>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 font-mono">{ag.email || 'N/A'} &#8226; {ag.phone || 'N/A'}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedScorecardAgent(null)} className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center text-sm font-bold transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0">&#10005;</button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" /><span>{locationStr}</span>
              </div>
              {scorecardLoading ? (<div className="text-center py-8 space-y-2"><RefreshCw className="w-6 h-6 animate-spin text-amber-600 mx-auto" /><p className="text-xs font-bold text-slate-500">Loading Agent Scorecard...</p></div>) : (
                <>
                  {scorecardError && <div className="bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-between"><span>{scorecardError}</span><button type="button" onClick={() => openAgentScorecard(selectedScorecardAgent)} className="underline text-rose-700 font-bold ml-2 cursor-pointer">Retry</button></div>}
                  <div><h4 className="text-xs font-extrabold tracking-wider text-amber-900 dark:text-amber-400 uppercase mb-2.5">MERCHANT TIE-UPS STATUS</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[{l:'TIEUPS TODAY',v:`${metrics.tieupsToday||0} Shops`,c:'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'},{l:'TIEUPS YESTERDAY',v:`${metrics.tieupsYesterday||0} Shops`,c:'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400'},{l:'TOTAL TIEUPS',v:`${metrics.totalTieups||0} Total`,c:'bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400'}].map(m=>(
                        <div key={m.l} className={`${m.c} border rounded-2xl p-4 space-y-1`}><span className="text-[10px] font-extrabold uppercase tracking-wider block">{m.l}</span><span className="text-xl font-extrabold font-mono block">{m.v}</span></div>
                      ))}
                    </div>
                  </div>
                  <div><h4 className="text-xs font-extrabold tracking-wider text-amber-900 dark:text-amber-400 uppercase mb-2.5">REVENUE &amp; PERFORMANCE</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">TOTAL REVENUE</span><span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono block">&#8377;{metrics.totalRevenue||0}</span></div>
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">PERFORMANCE SCORE</span><span className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono block">{metrics.performanceScore||0}%</span></div>
                      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">REG. FEE</span><span className={`text-sm font-extrabold uppercase flex items-center gap-1 ${metrics.regFeeStatus==='PAID'?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>{metrics.regFeeStatus==='PAID'?'&#10003; PAID':'&#10005; UNPAID'}</span></div>
                    </div>
                  </div>
                  <div><h4 className="text-xs font-extrabold tracking-wider text-amber-900 dark:text-amber-400 uppercase mb-2.5">DOWNSTREAM AGENTS COUNT</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {lvl==='state'&&<><div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-400 block">DISTRICT AGENTS</span><span className="text-xl font-extrabold text-violet-800 dark:text-violet-300 block">{downstream.districtAgents||0} Agents</span></div><div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 block">DIVISION MANAGERS</span><span className="text-xl font-extrabold text-amber-800 dark:text-amber-300 block">{downstream.divisionAgents||0} Agents</span></div><div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">PINCODE AGENTS</span><span className="text-xl font-extrabold text-blue-800 dark:text-blue-300 block">{downstream.pincodeAgents||0} Agents</span></div></>}
                      {lvl==='district'&&<><div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-400 block">DIVISION MANAGERS</span><span className="text-xl font-extrabold text-amber-800 dark:text-amber-300 block">{downstream.divisionAgents||0} Agents</span></div><div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-1"><span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">PINCODE AGENTS</span><span className="text-xl font-extrabold text-blue-800 dark:text-blue-300 block">{downstream.pincodeAgents||0} Agents</span></div></>}
                      {lvl==='division'&&<div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 space-y-1 col-span-2"><span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">PINCODE AGENTS</span><span className="text-xl font-extrabold text-blue-800 dark:text-blue-300 block">{downstream.pincodeAgents||0} Agents</span></div>}
                      {lvl==='pincode'&&<div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 space-y-1 col-span-2"><span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">DOWNSTREAM AGENTS</span><span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 block">0 Agents</span></div>}
                    </div>
                  </div>
                </>
              )}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {!['suspended','revoked'].includes((selectedScorecardAgent.status||'').toLowerCase())&&<>
                    <button type="button" onClick={()=>handleOpenActionConfirm(selectedScorecardAgent,'suspend')} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Suspend Agent</button>
                    <button type="button" onClick={()=>handleOpenActionConfirm(selectedScorecardAgent,'revoke')} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Revoke Agent</button>
                  </>}
                  {(selectedScorecardAgent.status||'').toLowerCase()==='suspended'&&<>
                    <button type="button" onClick={()=>handleOpenActionConfirm(selectedScorecardAgent,'reactivate')} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Reactivate Agent</button>
                    <button type="button" onClick={()=>handleOpenActionConfirm(selectedScorecardAgent,'revoke')} className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Revoke Agent</button>
                  </>}
                  {(selectedScorecardAgent.status||'').toLowerCase()==='revoked'&&<span className="px-3 py-1.5 bg-rose-500/10 text-rose-600 border border-rose-500/20 font-extrabold text-xs rounded-xl flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Access Revoked (Territory Released)</span>}
                </div>
                <button type="button" onClick={()=>setSelectedScorecardAgent(null)} className="bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-extrabold text-xs px-6 py-2.5 rounded-xl transition-all active:scale-95 cursor-pointer">Close Scorecard</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ACTION CONFIRM MODAL */}
      {actionConfirmModal.isOpen && actionConfirmModal.agent && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${actionConfirmModal.action==='revoke'?'bg-rose-500/10 text-rose-600 border border-rose-500/20':actionConfirmModal.action==='suspend'?'bg-amber-500/10 text-amber-600 border border-amber-500/20':'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'}`}>
                  {actionConfirmModal.action==='revoke'?<XCircle className="w-5 h-5"/>:actionConfirmModal.action==='suspend'?<AlertTriangle className="w-5 h-5"/>:<CheckCircle className="w-5 h-5"/>}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{actionConfirmModal.action==='revoke'?'Revoke Agent Access':actionConfirmModal.action==='suspend'?'Suspend Agent Account':'Reactivate Agent Account'}</h3>
                  <p className="text-xs text-slate-400 font-semibold">Target: {actionConfirmModal.agent.name} ({actionConfirmModal.agent.level?.toUpperCase()} AGENT)</p>
                </div>
              </div>
              <button type="button" onClick={()=>setActionConfirmModal({isOpen:false,agent:null,action:null,reason:'',loading:false,error:null})} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1 rounded-lg cursor-pointer">&#10005;</button>
            </div>
            <div className={`p-4 rounded-2xl text-xs font-semibold space-y-1.5 ${actionConfirmModal.action==='revoke'?'bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300':actionConfirmModal.action==='suspend'?'bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300':'bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300'}`}>
              {actionConfirmModal.action==='revoke'?<><p className="font-bold">&#9888;&#65039; CRITICAL: Territory Slot Release &amp; Permanent Access Removal</p><p className="text-[11px] opacity-90">1. The agent will lose access immediately.<br/>2. Territory assignment will be RELEASED IMMEDIATELY.<br/>3. Historical records remain preserved in database.</p></>
              :actionConfirmModal.action==='suspend'?<><p className="font-bold">&#9888;&#65039; Temporary Access Block</p><p className="text-[11px] opacity-90">1. The agent will be immediately logged out and blocked.<br/>2. Territory assignment is RETAINED.<br/>3. Account can be reactivated at any time by Admin.</p></>
              :<><p className="font-bold">&#10003; Restore Active Access</p><p className="text-[11px] opacity-90">The agent account will be restored to Approved/Active. The agent can log in and access the portal normally.</p></>}
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-slate-400">Agent ID:</span><span className="font-mono font-bold">{actionConfirmModal.agent.registrationId||actionConfirmModal.agent._id}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="font-bold">{actionConfirmModal.agent.email||'N/A'}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Territory:</span><span className="font-bold">{(actionConfirmModal.agent.assignedState||actionConfirmModal.agent.territory?.state||'N/A')} / {(actionConfirmModal.agent.assignedDistrict||actionConfirmModal.agent.territory?.district||'N/A')}</span></div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Administrative Reason (Recorded in Audit History):</label>
              <textarea rows={2} value={actionConfirmModal.reason} onChange={e=>setActionConfirmModal(prev=>({...prev,reason:e.target.value}))} placeholder={actionConfirmModal.action==='revoke'?'Enter reason for territory release...':actionConfirmModal.action==='suspend'?'Enter reason for temporary suspension...':'Reason for reactivation...'} className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 resize-none" />
            </div>
            {actionConfirmModal.error&&<div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl">{actionConfirmModal.error}</div>}
            <div className="flex justify-end items-center gap-3 pt-1">
              <button type="button" disabled={actionConfirmModal.loading} onClick={()=>setActionConfirmModal({isOpen:false,agent:null,action:null,reason:'',loading:false,error:null})} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50">Cancel</button>
              <button type="button" disabled={actionConfirmModal.loading} onClick={handleExecuteAgentAction} className={`px-5 py-2.5 rounded-xl text-xs font-extrabold text-white shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${actionConfirmModal.action==='revoke'?'bg-rose-600 hover:bg-rose-700':actionConfirmModal.action==='suspend'?'bg-amber-600 hover:bg-amber-700':'bg-emerald-600 hover:bg-emerald-700'}`}>
                {actionConfirmModal.loading&&<RefreshCw className="w-3.5 h-3.5 animate-spin"/>}
                {actionConfirmModal.action==='revoke'?'Confirm Revoke & Release':actionConfirmModal.action==='suspend'?'Confirm Suspend':'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Agent Leaf Card — individual agent row/card
function AgentLeafCard({ agent, level, onInspect, onAction, compact = true }) {
  const cfg = LEVEL_CONFIG[level] || LEVEL_CONFIG.pincode;
  const st = getStatusConfig(agent.status);
  const formattedId = agent.registrationId || (agent._id ? `REG-${String(agent._id).substring(0, 8).toUpperCase()}` : 'REG-N/A');
  const regDate = agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
  const territory = [agent.assignedState || agent.territory?.state, agent.assignedDistrict || agent.territory?.district, agent.assignedDivision || agent.territory?.division, (agent.assignedPincode?.code || agent.assignedPincode || agent.territory?.pincode)].filter(Boolean).join(' \u203a ');

  return (
    <div className={`group relative bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer border-l-4 ${cfg.accentBorder}`}
      onClick={() => onInspect && onInspect(agent)}>
      <div className={`flex ${compact ? 'items-center gap-3 px-3.5 py-3' : 'flex-col gap-3 p-4'}`}>
        <div className={`flex items-center gap-3 ${compact ? 'flex-1 min-w-0' : ''}`}>
          <div className={`shrink-0 ${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center font-black text-base ${cfg.text}`}>
            {(agent.name || 'A')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[13px] text-slate-900 dark:text-slate-100 truncate">{agent.name}</span>
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.badge} shrink-0`}>{cfg.label} AGENT</span>
              <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${st.cls} shrink-0`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 mt-0.5">{formattedId}</p>
          </div>
        </div>

        {compact ? (
          <div className="hidden md:flex items-center gap-4 shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
            {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{agent.phone}</span>}
            {territory && <span className="flex items-center gap-1 max-w-[180px] truncate"><MapPin className="w-3 h-3 shrink-0 text-amber-500" />{territory}</span>}
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 shrink-0" />{regDate}</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            {agent.email && <span className="flex items-center gap-1 truncate col-span-2"><Mail className="w-3 h-3 shrink-0" />{agent.email}</span>}
            {agent.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{agent.phone}</span>}
            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 shrink-0" />{regDate}</span>
            {territory && <span className="flex items-center gap-1 truncate col-span-2"><MapPin className="w-3 h-3 shrink-0 text-amber-500" />{territory}</span>}
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => onInspect && onInspect(agent)}
            className="h-7 px-2.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
            title="View Agent Scorecard"><Eye className="w-3 h-3" /> Inspect</button>
          {onAction && agent.status?.toLowerCase() === 'suspended' ? (
            <><button type="button" onClick={() => onAction(agent, 'reactivate')} className="h-7 px-2 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-colors cursor-pointer">Reactivate</button>
            <button type="button" onClick={() => onAction(agent, 'revoke')} className="h-7 px-2 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer">Revoke</button></>
          ) : onAction && !['revoked', 'rejected'].includes(agent.status?.toLowerCase()) ? (
            <><button type="button" onClick={() => onAction(agent, 'suspend')} className="h-7 px-2 rounded-lg text-[10px] font-bold bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-colors cursor-pointer">Suspend</button>
            <button type="button" onClick={() => onAction(agent, 'revoke')} className="h-7 px-2 rounded-lg text-[10px] font-bold bg-rose-500/10 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer">Revoke</button></>
          ) : agent.status?.toLowerCase() === 'revoked' ? (
            <span className="h-7 px-2.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center">Revoked</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
