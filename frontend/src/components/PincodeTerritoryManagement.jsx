import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  MapPin, Plus, Search, ChevronRight, Edit2, Trash2,
  CheckCircle, Layers, Filter, Eye, AlertTriangle, RefreshCw,
  Building2, Hash, UserCheck, ShieldAlert, X, ArrowRight, ArrowLeft,
  List, FolderTree, History, Activity, Shield, Check, Sparkles, AlertCircle, Globe
} from 'lucide-react';

export const PincodeTerritoryManagement = ({ token, API_BASE, onOpenAgentModal }) => {
  // --- Master State from DB ---
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

  // --- Active Hierarchy Selection ---
  // Initial page load starts with selectedState = null (showing ONLY States grid)
  const [selectedState, setSelectedState] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [selectedDivision, setSelectedDivision] = useState(null);
  const [selectedPincode, setSelectedPincode] = useState(null);

  // --- View Mode ---
  // 'hierarchy' (default State-first drilldown), 'tree', 'audit'
  const [viewMode, setViewMode] = useState('hierarchy');

  // --- Tree View Expansion State ---
  const [expandedNodes, setExpandedNodes] = useState({});

  // --- Search & Filters ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All'); // 'All' | 'Active' | 'Inactive'

  // --- Modal States ---
  const [activeModal, setActiveModal] = useState(null);
  // 'add-state' | 'edit-state' | 'add-district' | 'edit-district' | 'add-division' | 'edit-division' | 'add-pincode' | 'edit-pincode'
  const [modalData, setModalData] = useState(null);
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // --- Dependency Warning Alert Modal ---
  const [dependencyWarning, setDependencyWarning] = useState(null);

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

        // If a state was currently selected, synchronize its updated data
        if (selectedState) {
          const updatedSt = (data.states || []).find(s => s._id === selectedState._id);
          if (updatedSt) {
            setSelectedState(updatedSt);
            if (selectedDistrict) {
              const updatedDst = (updatedSt.districts || []).find(d => d._id === selectedDistrict._id);
              if (updatedDst) {
                setSelectedDistrict(updatedDst);
                if (selectedDivision) {
                  const updatedDiv = (updatedDst.divisions || []).find(v => v._id === selectedDivision._id);
                  if (updatedDiv) setSelectedDivision(updatedDiv);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Fetch hierarchy error:', err);
      showToast('Failed to load territory hierarchy', 'error');
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, selectedState, selectedDistrict, selectedDivision]);

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
  }, [token]);

  // Toggle Node in Tree
  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // --- Status Toggle Action ---
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

  // --- Safe Delete Action with Server Dependency Verification ---
  const handleDelete = async (type, item) => {
    if (type === 'state') {
      alert('State deletion is not allowed. States are protected top-level geographic entities.');
      return;
    }

    const confirmMsg = `Are you sure you want to remove ${type} "${item.name || item.code}"?`;
    if (!window.confirm(confirmMsg)) return;

    const endpoint = type === 'district' ? `/admin/territory/districts/${item._id}`
      : type === 'division' ? `/admin/territory/divisions/${item._id}`
      : `/admin/territory/pincodes/${item._id}`;

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'DELETE',
        headers: { 'x-auth-token': token }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.msg || `${type} removed successfully`);
        // Reset selections if deleted entity was active
        if (type === 'district' && selectedDistrict?._id === item._id) {
          setSelectedDistrict(null);
          setSelectedDivision(null);
          setSelectedPincode(null);
        }
        if (type === 'division' && selectedDivision?._id === item._id) {
          setSelectedDivision(null);
          setSelectedPincode(null);
        }
        if (type === 'pincode' && selectedPincode?._id === item._id) {
          setSelectedPincode(null);
        }
        fetchHierarchy();
        fetchStats();
      } else {
        // Show prominent dependency warning dialog
        setDependencyWarning({
          type,
          name: item.name || item.code,
          message: data.msg || `Cannot delete this ${type}. Dependent records exist.`
        });
      }
    } catch (err) {
      showToast('Network error deleting territory', 'error');
    }
  };

  // --- Postal API Auto-Lookup Helper ---
  const handlePostalLookup = async (pin) => {
    setPostalLookupPin(pin);
    if (!/^\d{6}$/.test(pin)) {
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

  // --- Filtered States for Initial Screen ---
  const filteredStates = useMemo(() => {
    return hierarchyData.filter(st => {
      const matchesSearch = !searchTerm ||
        st.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        st.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (st.stateId && st.stateId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = filterStatus === 'All' || st.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [hierarchyData, searchTerm, filterStatus]);

  // --- Dynamic Districts for Selected State ---
  const stateDistricts = useMemo(() => {
    if (!selectedState) return [];
    // Primary: use nested districts on selectedState from hierarchy endpoint
    if (selectedState.districts && selectedState.districts.length > 0) {
      return selectedState.districts.filter(d => filterStatus === 'All' || d.status === filterStatus);
    }
    // Fallback: filter rawDistricts by stateId
    return rawDistricts.filter(d => {
      const parentId = d.stateId?._id || d.stateId;
      const isParent = String(parentId) === String(selectedState._id);
      const matchesStatus = filterStatus === 'All' || d.status === filterStatus;
      return isParent && matchesStatus;
    });
  }, [selectedState, rawDistricts, filterStatus]);

  // --- Dynamic Divisions for Selected State / District ---
  const currentDivisions = useMemo(() => {
    if (!selectedState) return [];
    if (selectedDistrict) {
      // Filter strictly by the selected District
      if (selectedDistrict.divisions && selectedDistrict.divisions.length > 0) {
        return selectedDistrict.divisions.filter(v => filterStatus === 'All' || v.status === filterStatus);
      }
      return rawDivisions.filter(v => {
        const dId = v.districtId?._id || v.districtId;
        const matchesDistrict = String(dId) === String(selectedDistrict._id);
        const matchesStatus = filterStatus === 'All' || v.status === filterStatus;
        return matchesDistrict && matchesStatus;
      });
    }
    // If no district selected yet, collect all divisions in this state
    const allDivs = [];
    stateDistricts.forEach(d => {
      if (d.divisions) {
        d.divisions.forEach(v => {
          if (filterStatus === 'All' || v.status === filterStatus) {
            allDivs.push({ ...v, parentDistrictName: d.name });
          }
        });
      }
    });
    return allDivs;
  }, [selectedState, selectedDistrict, stateDistricts, rawDivisions, filterStatus]);

  // --- Dynamic Pincodes for Selected Division / District / State ---
  const currentPincodes = useMemo(() => {
    if (!selectedState) return [];
    if (selectedDivision) {
      // Filter strictly by the selected Division
      if (selectedDivision.pincodes && selectedDivision.pincodes.length > 0) {
        return selectedDivision.pincodes.filter(p => filterStatus === 'All' || p.status === filterStatus);
      }
      return rawPincodes.filter(p => {
        const divId = p.divisionId?._id || p.divisionId;
        const matchesDivision = String(divId) === String(selectedDivision._id);
        const matchesStatus = filterStatus === 'All' || p.status === filterStatus;
        return matchesDivision && matchesStatus;
      });
    }
    if (selectedDistrict) {
      // Filter by selected District
      const distPins = [];
      (selectedDistrict.divisions || []).forEach(v => {
        (v.pincodes || []).forEach(p => {
          if (filterStatus === 'All' || p.status === filterStatus) {
            distPins.push({ ...p, parentDivisionName: v.name });
          }
        });
      });
      return distPins;
    }
    // State-level pincodes
    const statePins = [];
    stateDistricts.forEach(d => {
      (d.divisions || []).forEach(v => {
        (v.pincodes || []).forEach(p => {
          if (filterStatus === 'All' || p.status === filterStatus) {
            statePins.push({ ...p, parentDistrictName: d.name, parentDivisionName: v.name });
          }
        });
      });
    });
    return statePins;
  }, [selectedState, selectedDistrict, selectedDivision, stateDistricts, rawPincodes, filterStatus]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-bounce ${
          toast.type === 'error' ? 'bg-rose-500 text-white border-rose-600' : 'bg-emerald-600 text-white border-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Dependency Warning Dialog */}
      {dependencyWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="p-3 bg-rose-500/10 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">Deletion Protected</h4>
                <p className="text-xs text-slate-400">Cannot remove {dependencyWarning.type} "{dependencyWarning.name}"</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl text-xs text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold">{dependencyWarning.message}</p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Please reassign or delete child territories, active agents, managers, or vendor ties before removing this {dependencyWarning.type}.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDependencyWarning(null)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP HEADER & BREADCRUMB ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400 font-semibold mb-1">
              <button
                onClick={() => {
                  setSelectedState(null);
                  setSelectedDistrict(null);
                  setSelectedDivision(null);
                  setSelectedPincode(null);
                }}
                className={`flex items-center gap-1.5 transition-colors ${
                  !selectedState
                    ? 'text-primary-600 dark:text-primary-400 font-bold'
                    : 'hover:text-primary-500 text-slate-500'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                All States
              </button>

              {selectedState && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedDistrict(null);
                      setSelectedDivision(null);
                      setSelectedPincode(null);
                    }}
                    className={`transition-colors ${
                      !selectedDistrict
                        ? 'text-primary-600 dark:text-primary-400 font-bold'
                        : 'hover:text-primary-500 text-slate-500'
                    }`}
                  >
                    {selectedState.name}
                  </button>
                </>
              )}

              {selectedDistrict && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => {
                      setSelectedDivision(null);
                      setSelectedPincode(null);
                    }}
                    className={`transition-colors ${
                      !selectedDivision
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : 'hover:text-indigo-500 text-slate-500'
                    }`}
                  >
                    {selectedDistrict.name}
                  </button>
                </>
              )}

              {selectedDivision && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <button
                    onClick={() => setSelectedPincode(null)}
                    className={`transition-colors ${
                      !selectedPincode
                        ? 'text-purple-600 dark:text-purple-400 font-bold'
                        : 'hover:text-purple-500 text-slate-500'
                    }`}
                  >
                    {selectedDivision.name}
                  </button>
                </>
              )}

              {selectedPincode && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-bold font-mono text-amber-500">{selectedPincode.code}</span>
                </>
              )}
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3 flex-wrap">
              Pin Code Management
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary-500/10 text-primary-500 border border-primary-500/20">
                STATE → DISTRICT → DIVISION → PINCODE
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage complete administrative territory hierarchy, local taluks, postal code allocations, and manager mappings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setModalData(null); setActiveModal('add-state'); }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add State
            </button>

            {selectedState && (
              <button
                onClick={() => {
                  setModalData({ stateId: selectedState._id, stateName: selectedState.name });
                  setActiveModal('add-district');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add District
              </button>
            )}

            {selectedDistrict && (
              <button
                onClick={() => {
                  setModalData({
                    stateId: selectedState?._id || selectedDistrict.stateId?._id || selectedDistrict.stateId,
                    stateName: selectedState?.name,
                    districtId: selectedDistrict._id,
                    districtName: selectedDistrict.name
                  });
                  setActiveModal('add-division');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Division
              </button>
            )}

            {selectedDivision && (
              <button
                onClick={() => {
                  setModalData({
                    stateId: selectedState?._id || selectedDivision.stateId?._id || selectedDivision.stateId,
                    stateName: selectedState?.name,
                    districtId: selectedDistrict?._id || selectedDivision.districtId?._id || selectedDivision.districtId,
                    districtName: selectedDistrict?.name,
                    divisionId: selectedDivision._id,
                    divisionName: selectedDivision.name
                  });
                  setActiveModal('add-pincode');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Pincode
              </button>
            )}

            <button
              onClick={() => { fetchHierarchy(); fetchStats(); fetchAuditLogs(); }}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              title="Refresh Territory Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── KPI METRICS SUMMARY ROW (REAL DB COUNTS) ── */}
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

      {/* ── FILTER & VIEW SELECTOR ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search */}
        <div className="flex-1 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search State, District, Division, Pincode..."
            className="bg-transparent focus:outline-none text-xs w-full text-slate-800 dark:text-slate-200 placeholder-slate-400"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter & View Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'hierarchy'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Hierarchy Flow
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('audit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'audit'
                  ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Audit Logs
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. INITIAL SCREEN: LIST / GRID OF STATES (When selectedState is null) ── */}
      {viewMode === 'hierarchy' && !selectedState && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary-500" />
                States Directory ({filteredStates.length})
              </h3>
              <p className="text-xs text-slate-400">
                Select a state below to view and manage its districts, divisions, and pin codes.
              </p>
            </div>
            <button
              onClick={() => { setModalData(null); setActiveModal('add-state'); }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-primary-600 hover:bg-primary-500 text-white shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add State
            </button>
          </div>

          {filteredStates.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <MapPin className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No States Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No state records match your filter criteria or have been created in the database yet.
              </p>
              <button
                onClick={() => { setModalData(null); setActiveModal('add-state'); }}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add State
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredStates.map((st) => (
                <div
                  key={st._id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group hover:border-primary-500/40"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold group-hover:scale-105 transition-transform">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {st.name}
                          </h4>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {st.code} • {st.stateId || `ST-${st.code}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleStatus('state', st)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                            st.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}
                          title="Click to toggle status"
                        >
                          {st.status || 'Active'}
                        </button>
                        <button
                          onClick={() => { setModalData(st); setActiveModal('edit-state'); }}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                          title="Edit State"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Metrics Counters (Real DB Data) */}
                    <div className="grid grid-cols-3 gap-2 py-3 px-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-center">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Districts</span>
                        <strong className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {st.districts?.length || st.totalDistricts || 0}
                        </strong>
                      </div>
                      <div className="border-x border-slate-200/60 dark:border-slate-800/80">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Divisions</span>
                        <strong className="text-xs font-black text-slate-800 dark:text-slate-100">
                          {st.totalDivisions || 0}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">Pincodes</span>
                        <strong className="text-xs font-black text-primary-600 dark:text-primary-400">
                          {st.totalPincodes || 0}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Open / View State Button */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">Protected Entity</span>
                    <button
                      onClick={() => {
                        setSelectedState(st);
                        setSelectedDistrict(null);
                        setSelectedDivision(null);
                        setSelectedPincode(null);
                      }}
                      className="px-3.5 py-1.5 bg-primary-50 dark:bg-primary-950/30 hover:bg-primary-600 text-primary-600 dark:text-primary-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <span>Manage Hierarchy</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 2. STATE DETAIL VIEW: 3 CASCADING SECTIONS (DISTRICTS → DIVISIONS → PINCODES) ── */}
      {viewMode === 'hierarchy' && selectedState && (
        <div className="space-y-6">
          {/* Selected State Hero Bar */}
          <div className="bg-gradient-to-r from-primary-500/10 via-indigo-500/5 to-transparent border border-primary-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedState(null);
                  setSelectedDistrict(null);
                  setSelectedDivision(null);
                  setSelectedPincode(null);
                }}
                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-600 dark:text-slate-300 hover:text-primary-500 hover:border-primary-500 transition-colors cursor-pointer"
                title="Back to all states"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">
                    {selectedState.name}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-primary-500/10 text-primary-600 rounded-md">
                    {selectedState.code}
                  </span>
                  <button
                    onClick={() => handleToggleStatus('state', selectedState)}
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full cursor-pointer ${
                      selectedState.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                    }`}
                  >
                    {selectedState.status || 'Active'}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  State Hierarchy: {stateDistricts.length} Districts • {currentDivisions.length} Divisions • {currentPincodes.length} Pin Codes
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setModalData(selectedState); setActiveModal('edit-state'); }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit State
              </button>
              <button
                onClick={() => {
                  setSelectedState(null);
                  setSelectedDistrict(null);
                  setSelectedDivision(null);
                  setSelectedPincode(null);
                }}
                className="px-3.5 py-1.5 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> All States
              </button>
            </div>
          </div>

          {/* 3 Main Sections: DISTRICTS | DIVISIONS | PINCODES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* ── SECTION 1: DISTRICTS ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      1. Districts ({stateDistricts.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">Under {selectedState.name}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setModalData({ stateId: selectedState._id, stateName: selectedState.name });
                    setActiveModal('add-district');
                  }}
                  className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                  title="Add District under this State"
                >
                  <Plus className="w-3.5 h-3.5" /> District
                </button>
              </div>

              {stateDistricts.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400">No districts added yet under {selectedState.name}.</p>
                  <button
                    onClick={() => {
                      setModalData({ stateId: selectedState._id, stateName: selectedState.name });
                      setActiveModal('add-district');
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
                  >
                    + Add District
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {stateDistricts.map((dst) => {
                    const isSelected = selectedDistrict?._id === dst._id;
                    const divsCount = dst.divisions?.length || dst.totalDivisions || 0;
                    const pinsCount = dst.totalPincodes || 0;

                    return (
                      <div
                        key={dst._id}
                        onClick={() => {
                          setSelectedDistrict(dst);
                          setSelectedDivision(null);
                          setSelectedPincode(null);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {dst.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              ({dst.code})
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-600 text-white">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{divsCount} Divisions</span>
                            <span>•</span>
                            <span>{pinsCount} Pincodes</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus('district', dst)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              dst.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {dst.status || 'Active'}
                          </button>
                          <button
                            onClick={() => { setModalData(dst); setActiveModal('edit-district'); }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                            title="Edit District"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('district', dst)}
                            className="p-1 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500"
                            title="Delete District"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SECTION 2: DIVISIONS ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      2. Divisions ({currentDivisions.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {selectedDistrict ? `In ${selectedDistrict.name}` : `All in ${selectedState.name}`}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setModalData({
                      stateId: selectedState._id,
                      stateName: selectedState.name,
                      districtId: selectedDistrict?._id || '',
                      districtName: selectedDistrict?.name || ''
                    });
                    setActiveModal('add-division');
                  }}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                  title="Add Division"
                >
                  <Plus className="w-3.5 h-3.5" /> Division
                </button>
              </div>

              {!selectedDistrict && (
                <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-2xl text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-purple-500" />
                  <span>Click a District on the left to filter divisions for that district.</span>
                </div>
              )}

              {currentDivisions.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Layers className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No divisions added yet {selectedDistrict ? `under ${selectedDistrict.name}` : `under ${selectedState.name}`}.
                  </p>
                  <button
                    onClick={() => {
                      setModalData({
                        stateId: selectedState._id,
                        stateName: selectedState.name,
                        districtId: selectedDistrict?._id || '',
                        districtName: selectedDistrict?.name || ''
                      });
                      setActiveModal('add-division');
                    }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                  >
                    + Add Division
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {currentDivisions.map((div) => {
                    const isSelected = selectedDivision?._id === div._id;
                    const pinsCount = div.pincodes?.length || div.totalPincodes || 0;

                    return (
                      <div
                        key={div._id}
                        onClick={() => {
                          setSelectedDivision(div);
                          setSelectedPincode(null);
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900 dark:text-white">
                              {div.name}
                            </span>
                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              ({div.code})
                            </span>
                            {isSelected && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-purple-600 text-white">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{div.divisionType || 'Administrative'}</span>
                            <span>•</span>
                            <span>{pinsCount} Pincodes</span>
                            {div.parentDistrictName && !selectedDistrict && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-500 font-semibold">{div.parentDistrictName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus('division', div)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              div.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {div.status || 'Active'}
                          </button>
                          <button
                            onClick={() => { setModalData(div); setActiveModal('edit-division'); }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                            title="Edit Division"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('division', div)}
                            className="p-1 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500"
                            title="Delete Division"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── SECTION 3: PINCODES ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">
                    <Hash className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                      3. Pin Codes ({currentPincodes.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {selectedDivision ? `In ${selectedDivision.name}` : (selectedDistrict ? `In ${selectedDistrict.name}` : `All in ${selectedState.name}`)}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setModalData({
                      stateId: selectedState._id,
                      stateName: selectedState.name,
                      districtId: selectedDistrict?._id || '',
                      districtName: selectedDistrict?.name || '',
                      divisionId: selectedDivision?._id || '',
                      divisionName: selectedDivision?.name || ''
                    });
                    setActiveModal('add-pincode');
                  }}
                  className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                  title="Add Pincode"
                >
                  <Plus className="w-3.5 h-3.5" /> Pincode
                </button>
              </div>

              {!selectedDivision && (
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                  <span>Select a Division in the center to manage pincodes for that specific division.</span>
                </div>
              )}

              {currentPincodes.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Hash className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400">
                    No pincodes added yet {selectedDivision ? `for ${selectedDivision.name}` : 'in this territory'}.
                  </p>
                  <button
                    onClick={() => {
                      setModalData({
                        stateId: selectedState._id,
                        stateName: selectedState.name,
                        districtId: selectedDistrict?._id || '',
                        districtName: selectedDistrict?.name || '',
                        divisionId: selectedDivision?._id || '',
                        divisionName: selectedDivision?.name || ''
                      });
                      setActiveModal('add-pincode');
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
                  >
                    + Add Pincode
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {currentPincodes.map((pin) => {
                    const isSelected = selectedPincode?._id === pin._id;
                    const assignedAgent = pin.activeAgentId;

                    return (
                      <div
                        key={pin._id}
                        onClick={() => setSelectedPincode(pin)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                            : 'bg-slate-50/60 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black font-mono text-sm text-slate-900 dark:text-white">
                              {pin.code}
                            </span>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[120px]">
                              {pin.postOffice || pin.name || pin.area || 'Postal Zone'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>{pin.taluk || pin.area || 'General Area'}</span>
                            {assignedAgent ? (
                              <span className="text-emerald-500 font-bold truncate max-w-[100px]">
                                • {assignedAgent.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">• Unassigned</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleStatus('pincode', pin)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              pin.status === 'Active'
                                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}
                          >
                            {pin.status || 'Active'}
                          </button>
                          <button
                            onClick={() => { setModalData(pin); setActiveModal('edit-pincode'); }}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600"
                            title="Edit Pincode"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete('pincode', pin)}
                            className="p-1 hover:bg-rose-500/10 rounded-lg text-slate-400 hover:text-rose-500"
                            title="Delete Pincode"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── 3. TREE VIEW MODE ── */}
      {viewMode === 'tree' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree className="w-4 h-4 text-primary-500" />
                Territory Hierarchy Tree View
              </h3>
              <p className="text-xs text-slate-400">
                Expandable hierarchical view of States → Districts → Divisions → Pincodes.
              </p>
            </div>
            <button
              onClick={() => {
                const allExpanded = {};
                hierarchyData.forEach(st => {
                  allExpanded[st._id] = true;
                  (st.districts || []).forEach(d => {
                    allExpanded[d._id] = true;
                    (d.divisions || []).forEach(v => {
                      allExpanded[v._id] = true;
                    });
                  });
                });
                setExpandedNodes(allExpanded);
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
            >
              Expand All
            </button>
          </div>

          <div className="space-y-3">
            {hierarchyData.map(st => (
              <div key={st._id} className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden">
                <div
                  className="p-3.5 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleNode(st._id)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-slate-400">
                      {expandedNodes[st._id] ? <ChevronRight className="w-4 h-4 rotate-90 transition-transform" /> : <ChevronRight className="w-4 h-4 transition-transform" />}
                    </span>
                    <MapPin className="w-4 h-4 text-primary-500" />
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{st.name}</span>
                    <span className="text-xs font-mono font-bold text-slate-400">({st.code})</span>
                    <span className="text-[10px] text-slate-400">
                      • {st.districts?.length || 0} Districts • {st.totalPincodes || 0} Pins
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        setSelectedState(st);
                        setViewMode('hierarchy');
                      }}
                      className="px-2.5 py-1 bg-primary-50 dark:bg-primary-950/40 text-primary-600 rounded-lg text-xs font-bold"
                    >
                      View in Hierarchy
                    </button>
                  </div>
                </div>

                {expandedNodes[st._id] && (
                  <div className="p-3 space-y-2 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                    {(st.districts || []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic pl-6">No districts under {st.name}</p>
                    ) : (
                      st.districts.map(dst => (
                        <div key={dst._id} className="pl-6 border-l-2 border-indigo-500/20 space-y-2">
                          <div
                            className="flex items-center justify-between py-1.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 px-2 rounded-lg"
                            onClick={() => toggleNode(dst._id)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {expandedNodes[dst._id] ? <ChevronRight className="w-3.5 h-3.5 rotate-90 transition-transform" /> : <ChevronRight className="w-3.5 h-3.5 transition-transform" />}
                              </span>
                              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200">{dst.name}</span>
                              <span className="text-[10px] font-mono text-slate-400">({dst.code})</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{dst.divisions?.length || 0} Divisions</span>
                          </div>

                          {expandedNodes[dst._id] && (
                            <div className="pl-6 border-l-2 border-purple-500/20 space-y-2">
                              {(dst.divisions || []).length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No divisions under {dst.name}</p>
                              ) : (
                                dst.divisions.map(div => (
                                  <div key={div._id} className="space-y-1.5">
                                    <div
                                      className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer"
                                      onClick={() => toggleNode(div._id)}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-slate-400">
                                          {expandedNodes[div._id] ? <ChevronRight className="w-3 h-3 rotate-90 transition-transform" /> : <ChevronRight className="w-3 h-3 transition-transform" />}
                                        </span>
                                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                                        <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">{div.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400">({div.code})</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">{div.pincodes?.length || 0} Pincodes</span>
                                    </div>

                                    {expandedNodes[div._id] && (
                                      <div className="pl-6 flex flex-wrap gap-1.5 pb-2">
                                        {(div.pincodes || []).length === 0 ? (
                                          <p className="text-[11px] text-slate-400 italic">No pincodes</p>
                                        ) : (
                                          div.pincodes.map(pin => (
                                            <span
                                              key={pin._id}
                                              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                            >
                                              {pin.code}
                                            </span>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. AUDIT LOGS MODE ── */}
      {viewMode === 'audit' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-primary-500" /> Territory Audit Trail
              </h3>
              <p className="text-xs text-slate-400">Historical records of state, district, division, and pincode modifications.</p>
            </div>
            <button
              onClick={fetchAuditLogs}
              className="p-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No territory audit logs recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <th className="py-2.5 font-bold">Action</th>
                    <th className="py-2.5 font-bold">Territory Level</th>
                    <th className="py-2.5 font-bold">Entity Name</th>
                    <th className="py-2.5 font-bold">Modified By</th>
                    <th className="py-2.5 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {auditLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-850">
                      <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200">{log.action}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md font-bold text-[10px]">
                          {log.territoryType}
                        </span>
                      </td>
                      <td className="py-2.5 font-semibold text-primary-600">{log.territoryName}</td>
                      <td className="py-2.5 text-slate-500">{log.actorName || 'Super Admin'}</td>
                      <td className="py-2.5 text-slate-400 font-mono text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ── MODALS (ADD & EDIT) ── */}
      {/* ══════════════════════════════════════════════════════════════ */}

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
                  description: form.description.value.trim()
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
                <label className="block text-slate-400 font-bold uppercase mb-1">State ID (Auto if blank)</label>
                <input
                  name="stateId"
                  type="text"
                  defaultValue={modalData?.stateId || ''}
                  placeholder="e.g. ST-TN"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional territory notes..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save State'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. ADD / EDIT DISTRICT MODAL (AUTO-INHERITED STATE) */}
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
              {/* Inherited State (Locked & Readonly for Safety) */}
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">State (Auto-Inherited)</label>
                <div className="p-3 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-between">
                  <span>{modalData?.stateName || selectedState?.name || 'Selected State'}</span>
                  <span className="text-[10px] font-mono text-primary-500">Locked Hierarchy</span>
                </div>
                <input
                  type="hidden"
                  name="stateId"
                  value={modalData?.stateId?._id || modalData?.stateId || selectedState?._id || ''}
                />
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
                <label className="block text-slate-400 font-bold uppercase mb-1">Description</label>
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
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save District'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. ADD / EDIT DIVISION MODAL (AUTO-INHERITED STATE & DISTRICT) */}
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
                  stateId: form.stateId.value,
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
              {/* Inherited Hierarchy Badges */}
              <div className="p-3 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Inherited Hierarchy</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs">
                  <span>{modalData?.stateName || selectedState?.name || 'State'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {modalData?.districtName || selectedDistrict?.name || 'District'}
                  </span>
                </div>
              </div>

              <input
                type="hidden"
                name="stateId"
                value={modalData?.stateId?._id || modalData?.stateId || selectedState?._id || ''}
              />
              <input
                type="hidden"
                name="districtId"
                value={modalData?.districtId?._id || modalData?.districtId || selectedDistrict?._id || ''}
              />

              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">Division Name *</label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={modalData?.name || ''}
                  placeholder="e.g. Hosur"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Division Code *</label>
                  <input
                    name="code"
                    type="text"
                    required
                    maxLength={6}
                    defaultValue={modalData?.code || ''}
                    placeholder="e.g. HSR"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono uppercase text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Type</label>
                  <select
                    name="divisionType"
                    defaultValue={modalData?.divisionType || 'Administrative'}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  >
                    <option value="Administrative">Administrative</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Custom">Custom</option>
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
                  <label className="block text-slate-400 font-bold uppercase mb-1">Taluk Info</label>
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
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Division'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ADD / EDIT PINCODE MODAL (AUTO-INHERITED HIERARCHY & POSTAL LOOKUP) */}
      {(activeModal === 'add-pincode' || activeModal === 'edit-pincode') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-amber-500" />
                {activeModal === 'edit-pincode' ? 'Edit Pin Code' : 'Add Pin Code'}
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
                  code: form.code.value.trim(),
                  stateId: form.stateId.value,
                  districtId: form.districtId.value,
                  divisionId: form.divisionId.value,
                  area: form.area.value.trim(),
                  postOffice: form.postOffice.value.trim(),
                  taluk: form.taluk.value.trim(),
                  status: form.status.value,
                  description: form.description.value.trim()
                };

                // Validate 6 digits
                if (!/^\d{6}$/.test(payload.code)) {
                  setModalError('Valid 6-digit Pincode is required');
                  setSubmitting(false);
                  return;
                }

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
              {/* Inherited Hierarchy Display */}
              <div className="p-3 bg-slate-100 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Inherited Territory</span>
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs flex-wrap">
                  <span>{modalData?.stateName || selectedState?.name || 'State'}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {modalData?.districtName || selectedDistrict?.name || 'District'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="text-purple-600 dark:text-purple-400 font-black">
                    {modalData?.divisionName || selectedDivision?.name || 'Division'}
                  </span>
                </div>
              </div>

              <input
                type="hidden"
                name="stateId"
                value={modalData?.stateId?._id || modalData?.stateId || selectedState?._id || ''}
              />
              <input
                type="hidden"
                name="districtId"
                value={modalData?.districtId?._id || modalData?.districtId || selectedDistrict?._id || ''}
              />
              <input
                type="hidden"
                name="divisionId"
                value={modalData?.divisionId?._id || modalData?.divisionId || selectedDivision?._id || ''}
              />

              {/* Pincode & Postal API Auto-Lookup */}
              <div>
                <label className="block text-slate-400 font-bold uppercase mb-1">
                  6-Digit Postal Code *
                </label>
                <div className="flex gap-2">
                  <input
                    name="code"
                    type="text"
                    required
                    maxLength={6}
                    defaultValue={modalData?.code || ''}
                    placeholder="e.g. 635109"
                    onChange={(e) => {
                      if (e.target.value.length === 6) {
                        handlePostalLookup(e.target.value);
                      }
                    }}
                    className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 font-mono font-bold text-sm tracking-wider text-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const pinVal = document.querySelector('input[name="code"]')?.value;
                      if (pinVal) handlePostalLookup(pinVal);
                    }}
                    disabled={postalLookupLoading}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${postalLookupLoading ? 'animate-spin text-amber-500' : 'text-amber-500'}`} />
                    <span>Auto-Fill</span>
                  </button>
                </div>
              </div>

              {/* Suggestions from India Post API */}
              {postalOffices.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-600 block">Postal Office Candidates:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {postalOffices.map((po, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const poInput = document.querySelector('input[name="postOffice"]');
                          const talukInput = document.querySelector('input[name="taluk"]');
                          const areaInput = document.querySelector('input[name="area"]');
                          if (poInput) poInput.value = po.Name;
                          if (talukInput) talukInput.value = po.Taluk || po.Block || '';
                          if (areaInput) areaInput.value = po.Name;
                        }}
                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-amber-500/30 rounded-lg text-[10px] font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500 hover:text-white transition-colors"
                      >
                        {po.Name} ({po.BranchType})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Post Office / Zone Name *</label>
                  <input
                    name="postOffice"
                    type="text"
                    required
                    defaultValue={modalData?.postOffice || modalData?.name || ''}
                    placeholder="e.g. Hosur H.O"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Area / Locality</label>
                  <input
                    name="area"
                    type="text"
                    defaultValue={modalData?.area || ''}
                    placeholder="e.g. Industrial Complex"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-bold uppercase mb-1">Taluk</label>
                  <input
                    name="taluk"
                    type="text"
                    defaultValue={modalData?.taluk || ''}
                    placeholder="e.g. Hosur"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
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
                <label className="block text-slate-400 font-bold uppercase mb-1">Description</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={modalData?.description || ''}
                  placeholder="Optional postal zone details..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save Pin Code'}
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
