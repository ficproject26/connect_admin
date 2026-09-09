import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin, Plus, Search, ChevronRight, ChevronDown, Edit2, Trash2,
  CheckCircle, Clock, Layers, Filter, Eye, AlertTriangle, RefreshCw,
  Building2, Globe, Hash, UserCheck, ShieldAlert, X, ArrowRight,
  SlidersHorizontal, List, FolderTree, History, Activity, Shield,
  Share2, ArrowUpRight, MoreVertical, Ban, Check, Sparkles
} from 'lucide-react';

export const PincodeTerritoryManagement = ({ token, API_BASE, onOpenAgentModal }) => {
  // --- Master State ---
  const [hierarchyData, setHierarchyData] = useState([]);
  const [rawDistricts, setRawDistricts] = useState([]);
  const [rawDivisions, setRawDivisions] = useState([]);
  const [rawPincodes, setRawPincodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [stats, setStats] = useState({
    totalStates: 0,
    totalDistricts: 0,
    totalDivisions: 0,
    totalPincodes: 0,
    activePincodes: 0,
    assignedPincodes: 0,
    availablePincodes: 0,
    activeManagers: 0
  });

  // --- Active View & Selection ---
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'tree' | 'states' | 'districts' | 'divisions' | 'pincodes' | 'audit'
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);

  // --- Tree Expansion State ---
  const [expandedNodes, setExpandedNodes] = useState({});

  // --- Search & Cascading Filter State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('All');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [filterDivision, setFilterDivision] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Active' | 'Inactive'

  // --- Modal States ---
  const [activeModal, setActiveModal] = useState(null); // 'add-state' | 'edit-state' | 'add-district' | 'edit-district' | 'add-division' | 'edit-division' | 'add-pincode' | 'edit-pincode' | 'details' | 'audit'
  const [modalData, setModalData] = useState(null);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Postal API Lookup for Pincode Creation ---
  const [postalLookupPin, setPostalLookupPin] = useState('');
  const [postalLookupLoading, setPostalLookupLoading] = useState(false);
  const [postalOffices, setPostalOffices] = useState([]);

  // --- Toast Notification ---
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type, id: Date.now() });
    setTimeout(() => setToast(null), 3500);
  };

  // --- API Fetchers ---
  const fetchHierarchy = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/admin/territory/hierarchy`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (data.success) {
        setHierarchyData(data.states || []);
        setRawDistricts(data.rawDistricts || []);
        setRawDivisions(data.rawDivisions || []);
        setRawPincodes(data.rawPincodes || []);

        // Expand first state by default if not set
        if (data.states && data.states.length > 0 && Object.keys(expandedNodes).length === 0) {
          setExpandedNodes({ [data.states[0]._id]: true });
          setSelectedState(data.states[0]);
        }
      }
    } catch (err) {
      console.error('Fetch hierarchy error:', err);
      showToast('Failed to load territory hierarchy', 'error');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/territory/stats`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Stats error:', err);
    }
  }, [API_BASE, token]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/territory/audit-logs`, {
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (data.success) {
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Audit logs error:', err);
    }
  }, [API_BASE, token]);

  useEffect(() => {
    fetchHierarchy();
    fetchStats();
    fetchAuditLogs();
  }, [fetchHierarchy, fetchStats, fetchAuditLogs]);

  // Toggle Node in Tree
  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // --- Actions ---
  const handleToggleStatus = async (type, item) => {
    const newStatus = item.status === 'Active' ? 'Inactive' : 'Active';
    const endpoint = type === 'state' ? `/admin/territory/states/${item._id}/status`
      : type === 'district' ? `/admin/territory/districts/${item._id}/status`
      : type === 'division' ? `/admin/territory/divisions/${item._id}/status`
      : `/admin/territory/pincodes/${item._id}/status`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'PATCH',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`${type.toUpperCase()} marked as ${newStatus}`);
        fetchHierarchy();
        fetchStats();
      } else {
        showToast(data.msg || 'Status update failed', 'error');
      }
    } catch (err) {
      showToast('Network error updating status', 'error');
    }
  };

  const handleDelete = async (type, item) => {
    const confirmMsg = `Are you sure you want to delete ${type} "${item.name || item.code}"?`;
    if (!window.confirm(confirmMsg)) return;

    const endpoint = type === 'state' ? `/admin/territory/states/${item._id}`
      : type === 'district' ? `/admin/territory/districts/${item._id}`
      : type === 'division' ? `/admin/territory/divisions/${item._id}`
      : `/admin/territory/pincodes/${item._id}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.msg || `${type} deleted successfully`);
        // Reset selections if deleted
        if (selectedState?._id === item._id) setSelectedState(null);
        if (selectedDistrict?._id === item._id) setSelectedDistrict(null);
        if (selectedDivision?._id === item._id) setSelectedDivision(null);
        if (selectedPincode?._id === item._id) setSelectedPincode(null);

        fetchHierarchy();
        fetchStats();
      } else {
        alert(data.msg || 'Cannot delete territory. Please verify child dependencies.');
      }
    } catch (err) {
      showToast('Network error deleting territory', 'error');
    }
  };

  // --- Postal API Auto-Lookup Helper ---
  const handlePostalLookup = async (pin) => {
    setPostalLookupPin(pin);
    if (pin.length !== 6 || isNaN(pin)) {
      setPostalOffices([]);
      return;
    }
    setPostalLookupLoading(true);
    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === 'Success') {
        setPostalOffices(data[0].PostOffice || []);
      } else {
        setPostalOffices([]);
      }
    } catch (err) {
      console.error(err);
      setPostalOffices([]);
    } finally {
      setPostalLookupLoading(false);
    }
  };

  // --- Filtered Flat Lists ---
  const filteredStates = useMemo(() => {
    return hierarchyData.filter(st => {
      const matchesSearch = !searchTerm ||
        st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.stateId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'All' || st.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [hierarchyData, searchTerm, filterStatus]);

  const filteredDistricts = useMemo(() => {
    return rawDistricts.filter(dst => {
      const parentState = hierarchyData.find(s => s._id === dst.stateId || s._id === dst.stateId?._id);
      const matchesState = filterState === 'All' || (parentState && parentState.name === filterState);
      const matchesSearch = !searchTerm ||
        dst.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dst.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dst.districtId && dst.districtId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'All' || dst.status === filterStatus;
      return matchesState && matchesSearch && matchesStatus;
    });
  }, [rawDistricts, hierarchyData, filterState, searchTerm, filterStatus]);

  const filteredDivisions = useMemo(() => {
    return rawDivisions.filter(div => {
      const parentDistrict = rawDistricts.find(d => d._id === div.districtId || d._id === div.districtId?._id);
      const parentState = hierarchyData.find(s => s._id === div.stateId || s._id === div.stateId?._id);
      const matchesState = filterState === 'All' || (parentState && parentState.name === filterState);
      const matchesDistrict = filterDistrict === 'All' || (parentDistrict && parentDistrict.name === filterDistrict);
      const matchesSearch = !searchTerm ||
        div.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        div.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (div.divisionId && div.divisionId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'All' || div.status === filterStatus;
      return matchesState && matchesDistrict && matchesSearch && matchesStatus;
    });
  }, [rawDivisions, rawDistricts, hierarchyData, filterState, filterDistrict, searchTerm, filterStatus]);

  const filteredPincodes = useMemo(() => {
    return rawPincodes.filter(pin => {
      const matchesState = filterState === 'All' || pin.state === filterState;
      const matchesDistrict = filterDistrict === 'All' || pin.district === filterDistrict;
      const matchesDivision = filterDivision === 'All' || pin.division === filterDivision;
      const matchesStatus = filterStatus === 'All' || pin.status === filterStatus;
      const matchesSearch = !searchTerm ||
        pin.code.includes(searchTerm) ||
        (pin.name && pin.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pin.taluk && pin.taluk.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pin.area && pin.area.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pin.postOffice && pin.postOffice.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pin.district && pin.district.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (pin.state && pin.state.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesState && matchesDistrict && matchesDivision && matchesStatus && matchesSearch;
    });
  }, [rawPincodes, filterState, filterDistrict, filterDivision, filterStatus, searchTerm]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold flex items-center gap-2 animate-bounce ${
          toast.type === 'error' ? 'bg-rose-500 text-white border-rose-600' : 'bg-emerald-600 text-white border-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* ── HEADER & BREADCRUMB ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-semibold mb-1">
              <button
                onClick={() => { setSelectedState(null); setSelectedDistrict(null); setSelectedDivision(null); setSelectedPincode(null); }}
                className="hover:text-primary-500 flex items-center gap-1 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" /> PINCODE MANAGEMENT
              </button>
              {selectedState && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <button
                    onClick={() => { setSelectedDistrict(null); setSelectedDivision(null); setSelectedPincode(null); }}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {selectedState.name}
                  </button>
                </>
              )}
              {selectedDistrict && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <button
                    onClick={() => { setSelectedDivision(null); setSelectedPincode(null); }}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {selectedDistrict.name}
                  </button>
                </>
              )}
              {selectedDivision && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <button
                    onClick={() => { setSelectedPincode(null); }}
                    className="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {selectedDivision.name}
                  </button>
                </>
              )}
              {selectedPincode && (
                <>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                  <span className="font-bold text-slate-800 dark:text-slate-100">{selectedPincode.code}</span>
                </>
              )}
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              Territory & Pincode Management
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 border border-primary-500/20">
                STATE → DISTRICT → DIVISION → PINCODE
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage complete administrative territory hierarchy, local taluks, postal code allocations, and manager mappings.
            </p>
          </div>

          {/* Quick Actions at the Top */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setModalData(null); setActiveModal('add-state'); }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add State
            </button>

            <button
              onClick={() => {
                setModalData(selectedState ? { stateId: selectedState._id, stateName: selectedState.name } : null);
                setActiveModal('add-district');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add District
            </button>

            <button
              onClick={() => {
                setModalData(selectedDistrict ? {
                  stateId: selectedDistrict.stateId?._id || selectedDistrict.stateId,
                  districtId: selectedDistrict._id,
                  districtName: selectedDistrict.name
                } : null);
                setActiveModal('add-division');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Division
            </button>

            <button
              onClick={() => {
                setModalData(selectedDivision ? {
                  stateId: selectedDivision.stateId?._id || selectedDivision.stateId,
                  districtId: selectedDivision.districtId?._id || selectedDivision.districtId,
                  divisionId: selectedDivision._id,
                  divisionName: selectedDivision.name
                } : null);
                setActiveModal('add-pincode');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Pincode
            </button>

            <button
              onClick={() => { fetchHierarchy(); fetchStats(); fetchAuditLogs(); }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Refresh Territory Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI METRICS SUMMARY ROW ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 pt-5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">States</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalStates}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Districts</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalDistricts}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Divisions</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalDivisions}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Pincodes</span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{stats.totalPincodes}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-emerald-500">Active Pins</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stats.activePincodes}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-primary-500">Assigned Pins</span>
            <div className="text-xl font-black text-primary-600 dark:text-primary-400 mt-0.5">{stats.assignedPincodes}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-500">Available Pins</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{stats.availablePincodes}</div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
            <span className="text-[10px] uppercase font-black tracking-wider text-purple-500">Managers</span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400 mt-0.5">{stats.activeManagers}</div>
          </div>
        </div>
      </div>

      {/* ── SEARCH, FILTERS & VIEW MODE SWITCHER ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Global Search */}
        <div className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search State, District, Division, Pincode, Taluk, Area..."
            className="bg-transparent focus:outline-none text-xs w-full text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Cascading Filter Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterDistrict('All'); setFilterDivision('All'); }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="All">All States ({hierarchyData.length})</option>
            {hierarchyData.map(st => (
              <option key={st._id} value={st.name}>{st.name}</option>
            ))}
          </select>

          <select
            value={filterDistrict}
            onChange={(e) => { setFilterDistrict(e.target.value); setFilterDivision('All'); }}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="All">All Districts</option>
            {filteredDistricts.map(dst => (
              <option key={dst._id} value={dst.name}>{dst.name}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          {/* View Mode Buttons */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'split' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="3-Panel Interactive Split Layout"
            >
              Interactive
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'tree' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Expandable Territory Tree"
            >
              Tree
            </button>
            <button
              onClick={() => setViewMode('states')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'states' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              States
            </button>
            <button
              onClick={() => setViewMode('districts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'districts' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Districts
            </button>
            <button
              onClick={() => setViewMode('divisions')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'divisions' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Divisions
            </button>
            <button
              onClick={() => setViewMode('pincodes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'pincodes' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Pincodes
            </button>
            <button
              onClick={() => setViewMode('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'audit' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Audit Logs"
            >
              Audit
            </button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ACCORDING TO VIEW MODE ── */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: TERRITORY HIERARCHY TREE (Cols 4) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 max-h-[800px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-primary-500" /> Geographic Tree View
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {hierarchyData.length} States
              </span>
            </div>

            {hierarchyData.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <MapPin className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No states have been added yet.</p>
                <button
                  onClick={() => { setModalData(null); setActiveModal('add-state'); }}
                  className="px-3 py-1.5 bg-primary-600 text-white rounded-xl text-xs font-bold"
                >
                  + Add State
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStates.map((st) => (
                  <div key={st._id} className="border border-slate-200/70 dark:border-slate-800 rounded-2xl overflow-hidden">
                    {/* State Row */}
                    <div
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedState?._id === st._id ? 'bg-primary-50 dark:bg-primary-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                      }`}
                      onClick={() => {
                        setSelectedState(st);
                        setSelectedDistrict(null);
                        setSelectedDivision(null);
                        setSelectedPincode(null);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleNode(st._id); }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                        >
                          {expandedNodes[st._id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{st.name}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">({st.code})</span>
                            {st.status === 'Inactive' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-500 font-bold">Inactive</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {st.districts?.length || 0} Districts • {st.totalPincodes || 0} Pincodes
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setModalData({ stateId: st._id, stateName: st.name }); setActiveModal('add-district'); }}
                          className="p-1.5 hover:bg-primary-500/10 text-primary-500 rounded-lg"
                          title="Add District"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setModalData(st); setActiveModal('edit-state'); }}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 rounded-lg"
                          title="Edit State"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Districts List when Expanded */}
                    {expandedNodes[st._id] && st.districts && st.districts.length > 0 && (
                      <div className="pl-6 pr-2 py-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/60">
                        {st.districts.map((dst) => (
                          <div key={dst._id} className="border-l-2 border-primary-500/30 pl-2 space-y-1">
                            {/* District Row */}
                            <div
                              className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${
                                selectedDistrict?._id === dst._id ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                              onClick={() => {
                                setSelectedState(st);
                                setSelectedDistrict(dst);
                                setSelectedDivision(null);
                                setSelectedPincode(null);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleNode(dst._id); }}
                                  className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md text-slate-400"
                                >
                                  {expandedNodes[dst._id] ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                                <div>
                                  <span className="font-bold text-[11px] text-slate-700 dark:text-slate-200">{dst.name}</span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {dst.divisions?.length || 0} Divs • {dst.totalPincodes || 0} Pins
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => {
                                    setModalData({ stateId: st._id, districtId: dst._id, districtName: dst.name });
                                    setActiveModal('add-division');
                                  }}
                                  className="p-1 hover:bg-indigo-500/10 text-indigo-500 rounded-md"
                                  title="Add Division"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => { setModalData(dst); setActiveModal('edit-district'); }}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 rounded-md"
                                  title="Edit District"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {/* Divisions List when Expanded */}
                            {expandedNodes[dst._id] && dst.divisions && dst.divisions.length > 0 && (
                              <div className="pl-4 py-1 space-y-1">
                                {dst.divisions.map((div) => (
                                  <div key={div._id} className="border-l border-purple-500/30 pl-2 space-y-1">
                                    <div
                                      className={`p-1.5 rounded-lg flex items-center justify-between cursor-pointer text-xs ${
                                        selectedDivision?._id === div._id ? 'bg-purple-50 dark:bg-purple-950/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                      onClick={() => {
                                        setSelectedState(st);
                                        setSelectedDistrict(dst);
                                        setSelectedDivision(div);
                                        setSelectedPincode(null);
                                      }}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); toggleNode(div._id); }}
                                          className="text-slate-400 hover:text-slate-600"
                                        >
                                          {expandedNodes[div._id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                        <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">{div.name}</span>
                                        <span className="text-[9px] text-slate-400 font-mono">({div.pincodes?.length || 0})</span>
                                      </div>

                                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={() => {
                                            setModalData({ stateId: st._id, districtId: dst._id, divisionId: div._id, divisionName: div.name });
                                            setActiveModal('add-pincode');
                                          }}
                                          className="p-1 text-purple-500 hover:bg-purple-500/10 rounded-md"
                                          title="Add Pincode"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Pincodes List when Division is Expanded */}
                                    {expandedNodes[div._id] && div.pincodes && div.pincodes.length > 0 && (
                                      <div className="pl-4 py-1 flex flex-wrap gap-1.5">
                                        {div.pincodes.map((pin) => (
                                          <button
                                            key={pin._id}
                                            onClick={() => {
                                              setSelectedState(st);
                                              setSelectedDistrict(dst);
                                              setSelectedDivision(div);
                                              setSelectedPincode(pin);
                                            }}
                                            className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold transition-all ${
                                              selectedPincode?._id === pin._id
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : pin.activeAgentId
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/40 border border-transparent'
                                            }`}
                                          >
                                            {pin.code}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* CENTER: SELECTED TERRITORY DETAILS / TABULAR VIEW (Cols 5) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            {selectedPincode ? (
              /* PINCODE DETAILS */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black font-mono tracking-wider text-slate-900 dark:text-white">
                        {selectedPincode.code}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedPincode.name || 'Postal Zone'} • {selectedPincode.taluk || 'No Taluk'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus('pincode', selectedPincode)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedPincode.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {selectedPincode.status || 'Active'}
                    </button>
                    <button
                      onClick={() => { setModalData(selectedPincode); setActiveModal('edit-pincode'); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Breadcrumb path */}
                <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl text-xs space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Territory Path</span>
                  <div className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                    <span>{selectedPincode.state}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span>{selectedPincode.district}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span>{selectedPincode.division || 'Central'}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-mono text-amber-500 font-bold">{selectedPincode.code}</span>
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase">Post Office</span>
                    <strong className="text-slate-800 dark:text-slate-100">{selectedPincode.postOffice || '—'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase">Taluk / Area</span>
                    <strong className="text-slate-800 dark:text-slate-100">{selectedPincode.taluk || selectedPincode.area || '—'}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase">Assigned Manager</span>
                    {selectedPincode.activeAgentId ? (
                      <strong className="text-emerald-500 block truncate">{selectedPincode.activeAgentId.name}</strong>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned</span>
                    )}
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase">Territory ID</span>
                    <strong className="text-slate-800 dark:text-slate-100 font-mono">{selectedPincode.pincodeId || `PIN-${selectedPincode.code}`}</strong>
                  </div>
                </div>

                {selectedPincode.notes && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl text-xs text-slate-500">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Notes</span>
                    {selectedPincode.notes}
                  </div>
                )}
              </div>
            ) : selectedDivision ? (
              /* DIVISION DETAILS */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-2xl">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedDivision.name} Division</h3>
                      <p className="text-xs text-slate-400">
                        {selectedDivision.code} • {selectedDivision.divisionType || 'Administrative'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus('division', selectedDivision)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedDivision.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {selectedDivision.status || 'Active'}
                    </button>
                    <button
                      onClick={() => { setModalData(selectedDivision); setActiveModal('edit-division'); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Quick stats for Division */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Pincodes</span>
                    <strong className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {selectedDivision.pincodes?.length || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Active</span>
                    <strong className="text-lg font-black text-emerald-500">
                      {(selectedDivision.pincodes || []).filter(p => p.status === 'Active').length}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Assigned</span>
                    <strong className="text-lg font-black text-primary-500">
                      {(selectedDivision.pincodes || []).filter(p => p.activeAgentId).length}
                    </strong>
                  </div>
                </div>

                {/* Pincodes Table under Division */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Pincodes in this Division</h5>
                    <button
                      onClick={() => {
                        setModalData({
                          stateId: selectedDivision.stateId?._id || selectedDivision.stateId,
                          districtId: selectedDivision.districtId?._id || selectedDivision.districtId,
                          divisionId: selectedDivision._id,
                          divisionName: selectedDivision.name
                        });
                        setActiveModal('add-pincode');
                      }}
                      className="text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Pincode
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y dark:divide-slate-800">
                    {(selectedDivision.pincodes || []).map(p => (
                      <div key={p._id} className="pt-1.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{p.code}</span>
                          <span className="text-slate-400 truncate max-w-[140px]">{p.name || p.taluk}</span>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          p.activeAgentId ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {p.activeAgentId ? 'Assigned' : 'Available'}
                        </span>
                      </div>
                    ))}
                    {(selectedDivision.pincodes || []).length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-6">No pincodes added to this division yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedDistrict ? (
              /* DISTRICT DETAILS */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-2xl">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedDistrict.name} District</h3>
                      <p className="text-xs text-slate-400">{selectedDistrict.code} • {selectedDistrict.headquarters || 'Headquarters'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus('district', selectedDistrict)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedDistrict.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {selectedDistrict.status || 'Active'}
                    </button>
                    <button
                      onClick={() => { setModalData(selectedDistrict); setActiveModal('edit-district'); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Summary counts */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Divisions</span>
                    <strong className="text-lg font-black text-slate-800 dark:text-slate-100">
                      {selectedDistrict.divisions?.length || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Total Pincodes</span>
                    <strong className="text-lg font-black text-indigo-500">
                      {selectedDistrict.totalPincodes || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Managers</span>
                    <strong className="text-lg font-black text-purple-500">
                      {selectedDistrict.managers?.length || 0}
                    </strong>
                  </div>
                </div>

                {/* Divisions list under District */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Divisions in this District</h5>
                    <button
                      onClick={() => {
                        setModalData({
                          stateId: selectedDistrict.stateId?._id || selectedDistrict.stateId,
                          districtId: selectedDistrict._id,
                          districtName: selectedDistrict.name
                        });
                        setActiveModal('add-division');
                      }}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Division
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y dark:divide-slate-800">
                    {(selectedDistrict.divisions || []).map(d => (
                      <div key={d._id} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 block">{d.name}</strong>
                          <span className="text-[10px] text-slate-400">{d.code} • {d.totalPincodes || 0} Pincodes</span>
                        </div>
                        <button
                          onClick={() => { setSelectedDivision(d); }}
                          className="text-[11px] font-bold text-indigo-500 hover:underline"
                        >
                          View Pincodes →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : selectedState ? (
              /* STATE DETAILS */
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-primary-500/10 text-primary-500 rounded-2xl">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedState.name}</h3>
                      <p className="text-xs text-slate-400">State Code: {selectedState.code} • ID: {selectedState.stateId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus('state', selectedState)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        selectedState.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {selectedState.status || 'Active'}
                    </button>
                    <button
                      onClick={() => { setModalData(selectedState); setActiveModal('edit-state'); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* State metrics */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Districts</span>
                    <strong className="text-base font-black text-slate-800 dark:text-slate-100">
                      {selectedState.districts?.length || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Divisions</span>
                    <strong className="text-base font-black text-indigo-500">
                      {selectedState.totalDivisions || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Pincodes</span>
                    <strong className="text-base font-black text-primary-500">
                      {selectedState.totalPincodes || 0}
                    </strong>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl">
                    <span className="text-[10px] uppercase text-slate-400 block">Vendors</span>
                    <strong className="text-base font-black text-purple-500">
                      {selectedState.vendorsCount || 0}
                    </strong>
                  </div>
                </div>

                {/* Districts table under State */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">Districts in {selectedState.name}</h5>
                    <button
                      onClick={() => {
                        setModalData({ stateId: selectedState._id, stateName: selectedState.name });
                        setActiveModal('add-district');
                      }}
                      className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add District
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 divide-y dark:divide-slate-800">
                    {(selectedState.districts || []).map(dst => (
                      <div key={dst._id} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <strong className="text-slate-800 dark:text-slate-200 block">{dst.name}</strong>
                          <span className="text-[10px] text-slate-400">
                            {dst.divisions?.length || 0} Divisions • {dst.totalPincodes || 0} Pincodes
                          </span>
                        </div>
                        <button
                          onClick={() => { setSelectedDistrict(dst); }}
                          className="text-[11px] font-bold text-primary-500 hover:underline"
                        >
                          View District →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                  <Layers className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Select a Territory to Inspect</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Click on any State, District, Division or Pincode in the left hierarchy tree to inspect its complete details, child elements, and manager allocation.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: QUICK ACTIONS & MANAGER ALLOCATION (Cols 3) */}
          <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-500" /> Manager Allocations
            </h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">State Level Manager</span>
                {selectedState?.managers && selectedState.managers.length > 0 ? (
                  <div className="font-bold text-primary-600 dark:text-primary-400">
                    {selectedState.managers.map(m => m.name).join(', ')}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">None assigned for {selectedState?.name || 'this state'}</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">District Level Manager</span>
                {selectedDistrict?.managers && selectedDistrict.managers.length > 0 ? (
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedDistrict.managers.map(m => m.name).join(', ')}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">None assigned for {selectedDistrict?.name || 'this district'}</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Divisional Manager</span>
                {selectedDivision?.managers && selectedDivision.managers.length > 0 ? (
                  <div className="font-bold text-purple-600 dark:text-purple-400">
                    {selectedDivision.managers.map(m => m.name).join(', ')}
                  </div>
                ) : (
                  <span className="text-slate-400 italic">None assigned for {selectedDivision?.name || 'this division'}</span>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Pincode Manager</span>
                {selectedPincode?.activeAgentId ? (
                  <div className="font-bold text-emerald-600 dark:text-emerald-400">
                    {selectedPincode.activeAgentId.name} ({selectedPincode.code})
                  </div>
                ) : (
                  <span className="text-slate-400 italic">No agent assigned for selected pincode</span>
                )}
              </div>
            </div>

            {/* Danger Zone Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Territory Actions</span>
              {selectedPincode ? (
                <button
                  onClick={() => handleDelete('pincode', selectedPincode)}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Pincode {selectedPincode.code}
                </button>
              ) : selectedDivision ? (
                <button
                  onClick={() => handleDelete('division', selectedDivision)}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Division
                </button>
              ) : selectedDistrict ? (
                <button
                  onClick={() => handleDelete('district', selectedDistrict)}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete District
                </button>
              ) : selectedState ? (
                <button
                  onClick={() => handleDelete('state', selectedState)}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete State
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ── TREE VIEW FULL ── */}
      {viewMode === 'tree' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-primary-500" /> Full Expanded Territory Tree View
              </h3>
              <p className="text-xs text-slate-400">Visual hierarchy of all registered States, Districts, Divisions, and Pincodes</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allOpen = {};
                  hierarchyData.forEach(s => {
                    allOpen[s._id] = true;
                    (s.districts || []).forEach(d => {
                      allOpen[d._id] = true;
                      (d.divisions || []).forEach(v => {
                        allOpen[v._id] = true;
                      });
                    });
                  });
                  setExpandedNodes(allOpen);
                }}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Expand All
              </button>
              <button
                onClick={() => setExpandedNodes({})}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
            {filteredStates.map((st) => (
              <div key={st._id} className="border border-slate-200 dark:border-slate-800 rounded-2xl p-3 bg-slate-50/40 dark:bg-slate-950/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleNode(st._id)}>
                    {expandedNodes[st._id] ? <ChevronDown className="w-4 h-4 text-primary-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{st.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-primary-500/10 text-primary-500 font-bold">{st.code}</span>
                    <span className="text-xs text-slate-400">({st.districts?.length || 0} Districts • {st.totalPincodes || 0} Pincodes)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { setModalData({ stateId: st._id, stateName: st.name }); setActiveModal('add-district'); }}
                      className="px-2.5 py-1 text-xs font-bold bg-primary-600 text-white rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add District
                    </button>
                    <button
                      onClick={() => { setModalData(st); setActiveModal('edit-state'); }}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {expandedNodes[st._id] && st.districts && (
                  <div className="pl-6 pt-2 space-y-3 border-l-2 border-primary-500/30 ml-2">
                    {st.districts.map((dst) => (
                      <div key={dst._id} className="border border-slate-200/80 dark:border-slate-800 rounded-xl p-2.5 bg-white dark:bg-slate-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleNode(dst._id)}>
                            {expandedNodes[dst._id] ? <ChevronDown className="w-4 h-4 text-indigo-500" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100">{dst.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-bold">{dst.code}</span>
                            <span className="text-xs text-slate-400">({dst.divisions?.length || 0} Divs)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setModalData({ stateId: st._id, districtId: dst._id, districtName: dst.name });
                                setActiveModal('add-division');
                              }}
                              className="px-2 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-md flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Division
                            </button>
                          </div>
                        </div>

                        {expandedNodes[dst._id] && dst.divisions && (
                          <div className="pl-6 pt-2 space-y-2 border-l-2 border-indigo-500/30 ml-2">
                            {dst.divisions.map((div) => (
                              <div key={div._id} className="p-2 bg-slate-50 dark:bg-slate-950 rounded-lg space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2 cursor-pointer" onClick={() => toggleNode(div._id)}>
                                    {expandedNodes[div._id] ? <ChevronDown className="w-3.5 h-3.5 text-purple-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                    <span className="font-bold text-xs text-slate-700 dark:text-slate-200">{div.name} Division</span>
                                    <span className="text-[10px] text-slate-400">({div.pincodes?.length || 0} Pincodes)</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setModalData({ stateId: st._id, districtId: dst._id, divisionId: div._id, divisionName: div.name });
                                      setActiveModal('add-pincode');
                                    }}
                                    className="px-2 py-0.5 text-[11px] font-bold bg-purple-600 text-white rounded-md flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Add Pincode
                                  </button>
                                </div>

                                {expandedNodes[div._id] && div.pincodes && (
                                  <div className="pl-5 flex flex-wrap gap-2 pt-1 border-l border-purple-500/30">
                                    {div.pincodes.map(p => (
                                      <span key={p._id} className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-1.5">
                                        <MapPin className="w-3 h-3 text-amber-500" />
                                        {p.code}
                                        {p.activeAgentId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STATE TABLE ── */}
      {viewMode === 'states' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">States Table</h3>
            <button
              onClick={() => { setModalData(null); setActiveModal('add-state'); }}
              className="px-3.5 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add State
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">State</th>
                  <th className="p-3">State Code</th>
                  <th className="p-3">Districts</th>
                  <th className="p-3">Divisions</th>
                  <th className="p-3">Pincodes</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStates.map((st, idx) => (
                  <tr key={st._id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{st.name}</td>
                    <td className="p-3 font-mono text-primary-500 font-bold">{st.code}</td>
                    <td className="p-3 font-semibold">{st.districts?.length || 0}</td>
                    <td className="p-3 font-semibold">{st.totalDivisions || 0}</td>
                    <td className="p-3 font-semibold">{st.totalPincodes || 0}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        st.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {st.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{new Date(st.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setSelectedState(st); setViewMode('split'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { setModalData({ stateId: st._id, stateName: st.name }); setActiveModal('add-district'); }}
                        className="px-2 py-1 rounded bg-primary-50 text-primary-600 font-bold hover:bg-primary-100"
                      >
                        + District
                      </button>
                      <button
                        onClick={() => { setModalData(st); setActiveModal('edit-state'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus('state', st)}
                        className={`px-2 py-1 rounded font-bold ${
                          st.status === 'Active' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                      >
                        {st.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DISTRICT TABLE ── */}
      {viewMode === 'districts' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Districts Table</h3>
            <button
              onClick={() => { setModalData(null); setActiveModal('add-district'); }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add District
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">District</th>
                  <th className="p-3">State</th>
                  <th className="p-3">Code</th>
                  <th className="p-3">Divisions</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDistricts.map((dst, idx) => (
                  <tr key={dst._id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{dst.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{dst.stateId?.name || '—'}</td>
                    <td className="p-3 font-mono text-indigo-500 font-bold">{dst.code}</td>
                    <td className="p-3 font-semibold">{rawDivisions.filter(v => v.districtId === dst._id || v.districtId?._id === dst._id).length}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        dst.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {dst.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{new Date(dst.createdAt || Date.now()).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setSelectedDistrict(dst); setViewMode('split'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setModalData({ stateId: dst.stateId?._id || dst.stateId, districtId: dst._id, districtName: dst.name });
                          setActiveModal('add-division');
                        }}
                        className="px-2 py-1 rounded bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100"
                      >
                        + Division
                      </button>
                      <button
                        onClick={() => { setModalData(dst); setActiveModal('edit-district'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus('district', dst)}
                        className={`px-2 py-1 rounded font-bold ${
                          dst.status === 'Active' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                      >
                        {dst.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DIVISION TABLE ── */}
      {viewMode === 'divisions' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Divisions Table (Fully Manual Naming)</h3>
            <button
              onClick={() => { setModalData(null); setActiveModal('add-division'); }}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Division
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Division</th>
                  <th className="p-3">State</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Pincodes</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredDivisions.map((div, idx) => (
                  <tr key={div._id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{div.name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{div.stateId?.name || '—'}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{div.districtId?.name || '—'}</td>
                    <td className="p-3 font-semibold">{rawPincodes.filter(p => p.divisionId === div._id || p.divisionId?._id === div._id).length}</td>
                    <td className="p-3 text-slate-500">{div.divisionType || 'Administrative'}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        div.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {div.status}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setSelectedDivision(div); setViewMode('split'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          setModalData({
                            stateId: div.stateId?._id || div.stateId,
                            districtId: div.districtId?._id || div.districtId,
                            divisionId: div._id,
                            divisionName: div.name
                          });
                          setActiveModal('add-pincode');
                        }}
                        className="px-2 py-1 rounded bg-purple-50 text-purple-600 font-bold hover:bg-purple-100"
                      >
                        + Pincode
                      </button>
                      <button
                        onClick={() => { setModalData(div); setActiveModal('edit-division'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus('division', div)}
                        className={`px-2 py-1 rounded font-bold ${
                          div.status === 'Active' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                      >
                        {div.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PINCODE TABLE ── */}
      {viewMode === 'pincodes' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Enterprise Pincodes Table</h3>
            <button
              onClick={() => { setModalData(null); setActiveModal('add-pincode'); }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Pincode
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Pincode</th>
                  <th className="p-3">Taluk</th>
                  <th className="p-3">Area / Post Office</th>
                  <th className="p-3">State</th>
                  <th className="p-3">District</th>
                  <th className="p-3">Division</th>
                  <th className="p-3">Assigned Manager</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPincodes.map((pin, idx) => (
                  <tr key={pin._id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                    <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-mono font-black text-amber-600 dark:text-amber-400">{pin.code}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{pin.taluk || '—'}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{pin.postOffice || pin.area || pin.name || '—'}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{pin.state}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{pin.district}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-400">{pin.division || '—'}</td>
                    <td className="p-3">
                      {pin.activeAgentId ? (
                        <span className="font-bold text-emerald-500">{pin.activeAgentId.name}</span>
                      ) : (
                        <span className="text-slate-400 italic">Available</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        pin.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {pin.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setSelectedPincode(pin); setViewMode('split'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-bold hover:bg-slate-200"
                      >
                        View
                      </button>
                      <button
                        onClick={() => { setModalData(pin); setActiveModal('edit-pincode'); }}
                        className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus('pincode', pin)}
                        className={`px-2 py-1 rounded font-bold ${
                          pin.status === 'Active' ? 'text-amber-500 hover:bg-amber-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'
                        }`}
                      >
                        {pin.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete('pincode', pin)}
                        className="px-2 py-1 rounded text-rose-500 hover:bg-rose-500/10 font-bold"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AUDIT LOGS VIEW ── */}
      {viewMode === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-500" /> Territory Audit Trail
              </h3>
              <p className="text-xs text-slate-400">All administrative structural changes and modifications logged with actor details</p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="p-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log._id} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100">{log.action}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                      {log.territoryType}
                    </span>
                    <span className="font-mono text-primary-500 font-bold">{log.territoryName}</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Performed by: <strong>{log.actorName}</strong> ({log.actorRole}) • IP: {log.ipAddress}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <p className="text-center py-8 text-xs text-slate-400">No audit logs recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS FOR CREATE / EDIT ── */}

      {/* 1. ADD / EDIT STATE MODAL */}
      {(activeModal === 'add-state' || activeModal === 'edit-state') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary-500" />
                {activeModal === 'edit-state' ? 'Edit State' : 'Add State'}
              </h4>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setModalError('');
                const form = e.target;
                const payload = {
                  name: form.name.value.trim(),
                  code: form.code.value.trim().toUpperCase(),
                  stateId: form.stateId?.value?.trim() || undefined,
                  status: form.status.value,
                  description: form.description.value.trim(),
                  notes: form.notes.value.trim()
                };

                const url = activeModal === 'edit-state'
                  ? `${API_BASE}/admin/territory/states/${modalData._id}`
                  : `${API_BASE}/admin/territory/states`;
                const method = activeModal === 'edit-state' ? 'PUT' : 'POST';

                try {
                  const res = await fetch(url, {
                    method,
                    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    showToast(`State ${payload.name} saved successfully`);
                    setActiveModal(null);
                    fetchHierarchy();
                    fetchStats();
                  } else {
                    setModalError(data.msg || 'Failed to save state');
                  }
                } catch (err) {
                  setModalError('Network error saving state');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">State Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={modalData?.name || ''}
                  placeholder="e.g. Tamil Nadu"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">State Code *</label>
                  <input
                    name="code"
                    type="text"
                    required
                    maxLength={4}
                    defaultValue={modalData?.code || ''}
                    placeholder="e.g. TN"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono uppercase text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={modalData?.status || 'Active'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">State ID (Optional / Auto)</label>
                <input
                  name="stateId"
                  type="text"
                  defaultValue={modalData?.stateId || ''}
                  placeholder="Auto Generated if blank (e.g. ST-TN)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Description / Notes</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional territory notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <input type="hidden" name="notes" defaultValue={modalData?.notes || ''} />

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save State'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD / EDIT DISTRICT MODAL */}
      {(activeModal === 'add-district' || activeModal === 'edit-district') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                {activeModal === 'edit-district' ? 'Edit District' : 'Add District'}
              </h4>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setModalError('');
                const form = e.target;
                const payload = {
                  stateId: form.stateId.value,
                  name: form.name.value.trim(),
                  code: form.code.value.trim().toUpperCase(),
                  status: form.status.value,
                  headquarters: form.headquarters.value.trim(),
                  description: form.description.value.trim()
                };

                const url = activeModal === 'edit-district'
                  ? `${API_BASE}/admin/territory/districts/${modalData._id}`
                  : `${API_BASE}/admin/territory/districts`;
                const method = activeModal === 'edit-district' ? 'PUT' : 'POST';

                try {
                  const res = await fetch(url, {
                    method,
                    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    showToast(`District ${payload.name} saved successfully`);
                    setActiveModal(null);
                    fetchHierarchy();
                    fetchStats();
                  } else {
                    setModalError(data.msg || 'Failed to save district');
                  }
                } catch (err) {
                  setModalError('Network error saving district');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Parent State *</label>
                <select
                  name="stateId"
                  required
                  defaultValue={modalData?.stateId?._id || modalData?.stateId || selectedState?._id || ''}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                >
                  <option value="">Select State</option>
                  {hierarchyData.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">District Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={modalData?.name || ''}
                  placeholder="e.g. Krishnagiri"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">District Code *</label>
                  <input
                    name="code"
                    type="text"
                    required
                    maxLength={6}
                    defaultValue={modalData?.code || ''}
                    placeholder="e.g. KGI"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono uppercase text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={modalData?.status || 'Active'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Headquarters (Optional)</label>
                <input
                  name="headquarters"
                  type="text"
                  defaultValue={modalData?.headquarters || ''}
                  placeholder="e.g. Krishnagiri"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Description / Notes</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save District'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT DIVISION MODAL (Manual Naming Support) */}
      {(activeModal === 'add-division' || activeModal === 'edit-division') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                {activeModal === 'edit-division' ? 'Edit Division' : 'Add Division'}
              </h4>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setModalError('');
                const form = e.target;
                const payload = {
                  districtId: form.districtId.value,
                  name: form.name.value.trim(),
                  code: form.code.value.trim().toUpperCase(),
                  divisionType: form.divisionType.value,
                  status: form.status.value,
                  talukInfo: form.talukInfo.value.trim(),
                  description: form.description.value.trim()
                };

                const url = activeModal === 'edit-division'
                  ? `${API_BASE}/admin/territory/divisions/${modalData._id}`
                  : `${API_BASE}/admin/territory/divisions`;
                const method = activeModal === 'edit-division' ? 'PUT' : 'POST';

                try {
                  const res = await fetch(url, {
                    method,
                    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    showToast(`Division ${payload.name} saved successfully`);
                    setActiveModal(null);
                    fetchHierarchy();
                    fetchStats();
                  } else {
                    setModalError(data.msg || 'Failed to save division');
                  }
                } catch (err) {
                  setModalError('Network error saving division');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Parent District *</label>
                <select
                  name="districtId"
                  required
                  defaultValue={modalData?.districtId?._id || modalData?.districtId || selectedDistrict?._id || ''}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                >
                  <option value="">Select District</option>
                  {rawDistricts.map(d => (
                    <option key={d._id} value={d._id}>{d.name} ({d.stateId?.name || 'District'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Division Name * (Manual Entry)</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={modalData?.name || ''}
                  placeholder="e.g. West, Hosur West, North Central, Custom Division 01"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">You can enter any manual division name.</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Division Code (Optional)</label>
                  <input
                    name="code"
                    type="text"
                    maxLength={6}
                    defaultValue={modalData?.code || ''}
                    placeholder="Auto if blank"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono uppercase text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Division Type</label>
                  <select
                    name="divisionType"
                    defaultValue={modalData?.divisionType || 'Administrative'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Administrative">Administrative</option>
                    <option value="Custom">Custom</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={modalData?.status || 'Active'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Taluk / Area Info</label>
                  <input
                    name="talukInfo"
                    type="text"
                    defaultValue={modalData?.talukInfo || ''}
                    placeholder="e.g. Hosur Taluk"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional division notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Division'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ADD / EDIT PINCODE MODAL (Manual Taluk, Area, Post Office) */}
      {(activeModal === 'add-pincode' || activeModal === 'edit-pincode') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                {activeModal === 'edit-pincode' ? 'Edit Pincode' : 'Add New Pincode'}
              </h4>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Quick Postal Lookup Assistant (For Add Mode) */}
            {activeModal === 'add-pincode' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Optional: India Post Auto-Lookup
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={postalLookupPin}
                    onChange={(e) => handlePostalLookup(e.target.value)}
                    placeholder="Enter 6 digits to auto-fetch details"
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-mono text-xs"
                  />
                  {postalLookupLoading && <span className="text-xs text-slate-400 self-center">Checking...</span>}
                </div>
                {postalOffices.length > 0 && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    ✓ Found {postalOffices.length} post offices in {postalOffices[0]?.District}, {postalOffices[0]?.State}
                  </div>
                )}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setModalError('');
                const form = e.target;
                const payload = {
                  code: form.code.value.trim(),
                  divisionId: form.divisionId.value,
                  taluk: form.taluk.value.trim(),
                  area: form.area.value.trim(),
                  postOffice: form.postOffice.value.trim(),
                  status: form.status.value,
                  description: form.description.value.trim()
                };

                const url = activeModal === 'edit-pincode'
                  ? `${API_BASE}/admin/territory/pincodes/${modalData._id}`
                  : `${API_BASE}/admin/territory/pincodes`;
                const method = activeModal === 'edit-pincode' ? 'PUT' : 'POST';

                try {
                  const res = await fetch(url, {
                    method,
                    headers: { 'x-auth-token': token, 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    showToast(`Pincode ${payload.code} saved successfully`);
                    setActiveModal(null);
                    fetchHierarchy();
                    fetchStats();
                  } else {
                    setModalError(data.msg || 'Failed to save pincode');
                  }
                } catch (err) {
                  setModalError('Network error saving pincode');
                } finally {
                  setSubmitting(false);
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Parent Division *</label>
                <select
                  name="divisionId"
                  required
                  defaultValue={modalData?.divisionId?._id || modalData?.divisionId || selectedDivision?._id || ''}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                >
                  <option value="">Select Division</option>
                  {rawDivisions.map(v => (
                    <option key={v._id} value={v._id}>{v.name} ({v.districtId?.name || 'District'}, {v.stateId?.name || 'State'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">6-Digit Pincode *</label>
                  <input
                    name="code"
                    type="text"
                    required
                    maxLength={6}
                    defaultValue={modalData?.code || postalLookupPin || ''}
                    placeholder="e.g. 635001"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono font-bold tracking-widest text-sm text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={modalData?.status || 'Active'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Taluk (Manual Entry)</label>
                  <input
                    name="taluk"
                    type="text"
                    defaultValue={modalData?.taluk || postalOffices[0]?.Block || ''}
                    placeholder="e.g. Hosur"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Area / Locality</label>
                  <input
                    name="area"
                    type="text"
                    defaultValue={modalData?.area || ''}
                    placeholder="e.g. Industrial Hub"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Post Office Name</label>
                <input
                  name="postOffice"
                  type="text"
                  defaultValue={modalData?.postOffice || modalData?.name || postalOffices[0]?.Name || ''}
                  placeholder="e.g. Krishnagiri Head Post Office"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Description / Notes</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional territory details..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Pincode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PincodeTerritoryManagement;
