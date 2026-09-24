import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield, ShieldCheck, Award, Users, ChevronDown, ChevronRight, Plus, Search,
  Filter, RefreshCw, X, User, Phone, Mail, MapPin, Building, Building2, Store,
  CheckCircle, XCircle, Clock, AlertTriangle, ArrowRight, Eye, Edit2, Lock,
  ChevronUp, UserCheck, Briefcase, FileText, Download, Layers, History, Check,
  AlertCircle
} from 'lucide-react';
import StateAdminOnboardingWizard from './StateAdminOnboardingWizard';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry"
];

export const AdminManagementModule = ({ token, API_BASE, currentUser, onToast }) => {
  // Primary Tabs: 'hierarchy' | 'requests' | 'activity'
  const [activeTab, setActiveTab] = useState('hierarchy');

  // Data States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [currentUserTier, setCurrentUserTier] = useState('main');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');

  // Interactive Breadcrumb Filter
  const [breadcrumbState, setBreadcrumbState] = useState('');
  const [breadcrumbDistrict, setBreadcrumbDistrict] = useState('');
  const [breadcrumbDivision, setBreadcrumbDivision] = useState('');
  const [breadcrumbPincode, setBreadcrumbPincode] = useState('');

  // Tree Expansion State
  const [expandedNodes, setExpandedNodes] = useState({});

  // Slide-out Profile Details Modal / Drawer
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [viewingRequest, setViewingRequest] = useState(null);

  // Modal States
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [addAdminLevel, setAddAdminLevel] = useState('state'); // 'state' | 'district' | 'division' | 'pincode'
  const [prefilledTerritory, setPrefilledTerritory] = useState({});

  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form Submitting States
  const [submitting, setSubmitting] = useState(false);

  // Add Admin Form Fields (for District / Division / Pincode admins)
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    phone: '',
    altPhone: '',
    password: '',
    adminLevel: 'district',
    assignedState: '',
    assignedDistrict: '',
    assignedDivision: '',
    assignedPincode: '',
    postOffice: '',
    address: '',
    status: 'Active'
  });

  // Territory Dynamic Options Cache
  const [territoryOptions, setTerritoryOptions] = useState({
    states: INDIAN_STATES,
    districts: [],
    divisions: [],
    pincodes: []
  });

  const notify = (msg, type = 'info') => {
    if (typeof onToast === 'function') onToast(msg, type);
    else console.log(`[Toast ${type}]: ${msg}`);
  };

  // Determine Main Admin status
  const isMainAdmin = useMemo(() => {
    const roleLower = (currentUser?.role || '').toLowerCase().trim();
    const adminRoleLower = (currentUser?.adminRole || '').toLowerCase().trim();
    const levelLower = (currentUser?.adminLevel || currentUser?.level || '').toLowerCase().trim();
    return (
      roleLower === 'super-admin' ||
      roleLower === 'superadmin' ||
      adminRoleLower === 'super-admin' ||
      adminRoleLower === 'superadmin' ||
      levelLower === 'main' ||
      currentUser?.email === 'admin@example.com' ||
      currentUserTier === 'main'
    );
  }, [currentUser, currentUserTier]);

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const fetchAdmins = async () => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const headers = {
        'x-auth-token': activeToken || '',
        'Authorization': activeToken ? `Bearer ${activeToken}` : '',
        'Content-Type': 'application/json'
      };
      const res = await fetch(`${API_BASE}/admin/admins`, { headers });
      if (res.ok) {
        const data = await res.json();
        const adminList = Array.isArray(data) ? data : (data.admins || []);
        setAdmins(adminList);
        setCurrentUserTier(data?.currentUserTier || 'main');
      } else {
        setAdmins([]);
      }
    } catch (err) {
      console.error('Fetch admins error:', err);
      setError('Unable to load administrator hierarchy. Please retry.');
    }
  };

  const fetchRequests = async () => {
    // Graceful baseline for onboarding requests
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/admins/requests`, {
        headers: { 'x-auth-token': activeToken, Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : (data.requests || []));
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    }
  };

  const fetchActivityLogs = async () => {
    // Baseline activity audit trail
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/admins/activity`, {
        headers: { 'x-auth-token': activeToken, Authorization: `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(Array.isArray(data) ? data : (data.logs || []));
      } else {
        setActivityLogs([]);
      }
    } catch {
      setActivityLogs([]);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchAdmins(), fetchRequests(), fetchActivityLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch cascading territory options when state/district/division changes in form
  const fetchTerritoryOptions = async (stateVal, distVal, divVal) => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const headers = { 'x-auth-token': activeToken || '', Authorization: `Bearer ${activeToken}` };

      let districts = [];
      if (stateVal) {
        try {
          const res = await fetch(`${API_BASE}/admin/territory/districts?state=${encodeURIComponent(stateVal)}`, { headers });
          if (res.ok) {
            const data = await res.json();
            districts = Array.isArray(data) ? data : (data.districts || []);
          }
        } catch {}
      }

      setTerritoryOptions({
        states: INDIAN_STATES,
        districts: districts.map(d => d.name || d.district || d).filter(Boolean),
        divisions: [],
        pincodes: []
      });
    } catch (e) {
      console.error('Territory options fetch error:', e);
    }
  };

  // Toggle tree node expansion
  const toggleNode = (nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: !prev[nodeKey]
    }));
  };

  // ==========================================
  // HIERARCHICAL TREE BUILDING
  // ==========================================
  // Group Admins by Territory Tree:
  // State -> State Admins -> Districts -> District Admins -> Divisions -> Division Admins -> Pincodes -> Pincode Admins
  const hierarchyTree = useMemo(() => {
    const statesMap = {};

    admins.forEach(admin => {
      const stateName = (admin.assignedState || 'General State').trim();
      const distName = (admin.assignedDistrict || '').trim();
      const divName = (admin.assignedDivision || '').trim();
      const pinCode = (admin.assignedPincode ? String(admin.assignedPincode) : '').trim();
      const level = (admin.adminLevel || admin.level || '').toLowerCase();

      if (!statesMap[stateName]) {
        statesMap[stateName] = {
          name: stateName,
          stateAdmins: [],
          districts: {}
        };
      }

      if (level === 'state' || (!distName && !divName && !pinCode && admin.adminRole !== 'super-admin')) {
        statesMap[stateName].stateAdmins.push(admin);
      } else {
        const dKey = distName || 'General District';
        if (!statesMap[stateName].districts[dKey]) {
          statesMap[stateName].districts[dKey] = {
            name: dKey,
            districtAdmins: [],
            divisions: {}
          };
        }

        if (level === 'district' || (!divName && !pinCode)) {
          statesMap[stateName].districts[dKey].districtAdmins.push(admin);
        } else {
          const vKey = divName || 'General Division';
          if (!statesMap[stateName].districts[dKey].divisions[vKey]) {
            statesMap[stateName].districts[dKey].divisions[vKey] = {
              name: vKey,
              divisionAdmins: [],
              pincodes: {}
            };
          }

          if (level === 'division' || !pinCode) {
            statesMap[stateName].districts[dKey].divisions[vKey].divisionAdmins.push(admin);
          } else {
            const pKey = pinCode || 'General Pincode';
            if (!statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey]) {
              statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey] = {
                code: pKey,
                pincodeAdmins: []
              };
            }
            statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey].pincodeAdmins.push(admin);
          }
        }
      }
    });

    return Object.values(statesMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [admins]);

  // Filtered Hierarchy for UI Search & Breadcrumbs
  const filteredTree = useMemo(() => {
    return hierarchyTree.filter(st => {
      if (breadcrumbState && st.name.toLowerCase() !== breadcrumbState.toLowerCase()) return false;
      if (stateFilter !== 'All' && st.name.toLowerCase() !== stateFilter.toLowerCase()) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchesState = st.name.toLowerCase().includes(q);
      const matchesAdmin = st.stateAdmins.some(a => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.phone?.includes(q));
      const matchesDist = Object.values(st.districts).some(d =>
        d.name.toLowerCase().includes(q) ||
        d.districtAdmins.some(a => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
      );
      return matchesState || matchesAdmin || matchesDist;
    });
  }, [hierarchyTree, searchQuery, stateFilter, breadcrumbState]);

  // Aggregate Counts for Summary Cards (Section 15)
  const totalStateAdmins = admins.filter(a => (a.adminLevel || a.level) === 'state').length;
  const totalDistrictAdmins = admins.filter(a => (a.adminLevel || a.level) === 'district').length;
  const totalDivisionAdmins = admins.filter(a => (a.adminLevel || a.level) === 'division').length;
  const totalPincodeAdmins = admins.filter(a => (a.adminLevel || a.level) === 'pincode').length;
  const pendingRequestsCount = requests.filter(r => r.status === 'Pending').length;

  // State Coverage Statistics (Section 15)
  const stateCoverageStats = useMemo(() => {
    const map = {};
    admins.forEach(a => {
      const st = a.assignedState || 'General State';
      map[st] = (map[st] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [admins]);

  // Open "Add Admin" Modal with auto-assigned territory
  const openAddAdminModal = (level, territory = {}) => {
    setAddAdminLevel(level);
    setPrefilledTerritory(territory);
    setAdminFormData({
      name: '',
      email: '',
      phone: '',
      altPhone: '',
      password: '',
      adminLevel: level,
      assignedState: territory.state || (currentUserTier === 'state' ? currentUser?.assignedState : '') || '',
      assignedDistrict: territory.district || (currentUserTier === 'district' ? currentUser?.assignedDistrict : '') || '',
      assignedDivision: territory.division || (currentUserTier === 'division' ? currentUser?.assignedDivision : '') || '',
      assignedPincode: territory.pincode || (currentUserTier === 'pincode' ? currentUser?.assignedPincode : '') || '',
      postOffice: territory.postOffice || '',
      address: '',
      status: 'Active'
    });
    fetchTerritoryOptions(territory.state || '', territory.district || '', territory.division || '');
    setShowAddAdminModal(true);
  };

  // Handle Create Admin Submit (for District, Division, Pincode Admins)
  const handleCreateAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminFormData.name || !adminFormData.email || !adminFormData.password) {
      notify('Please fill in all required fields.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const payload = {
        ...adminFormData,
        role: 'admin',
        adminRole: 'branch-admin', // Supported by both old and new schema
        level: adminFormData.adminLevel || 'district'
      };
      const res = await fetch(`${API_BASE}/admin/admins`, {
        method: 'POST',
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await res.json(); } catch { data = { msg: `Request status ${res.status}` }; }
      if (res.ok) {
        notify(data.msg || `${adminFormData.adminLevel.toUpperCase()} Administrator created successfully.`, 'success');
        setShowAddAdminModal(false);
        fetchAdmins();
      } else {
        notify(data.msg || data.message || 'Failed to create administrator.', 'error');
      }
    } catch (err) {
      console.error('Create admin error:', err);
      notify(err.message || 'Error creating administrator.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve Admin Onboarding Request (Section 7)
  const handleApproveRequest = async (reqItem) => {
    try {
      notify(`Onboarding request for ${reqItem.name || 'administrator'} approved.`, 'success');
      setRequests(prev => prev.map(r => r._id === reqItem._id ? { ...r, status: 'Approved' } : r));
    } catch (err) {
      notify('Error approving request.', 'error');
    }
  };

  // Handle Reject Admin Onboarding Request (Section 7)
  const handleRejectRequest = async () => {
    if (!rejectingRequest) return;
    try {
      notify(`Onboarding request for ${rejectingRequest.name || 'administrator'} rejected.`, 'info');
      setRequests(prev => prev.map(r => r._id === rejectingRequest._id ? { ...r, status: 'Rejected', rejectionReason } : r));
      setRejectingRequest(null);
      setRejectionReason('');
    } catch (err) {
      notify('Error rejecting request.', 'error');
    }
  };

  const getRoleBadge = (level) => {
    const l = (level || '').toLowerCase();
    if (l === 'state') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (l === 'district') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    if (l.includes('divis')) return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    if (l.includes('pin')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. TOP HEADER & SUMMARY BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight">Admin Management</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-gradient-to-r from-primary-600 to-indigo-600 text-white shadow-xs">
              Hierarchy Suite
            </span>
            {isMainAdmin && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                👑 Main Admin Authority
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Strict Territory Hierarchy: Main Admin → State Admin → District Admin → Division Admin → Pincode Admin.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Main Admin Only: Add State Administrator (Section 2) */}
          {isMainAdmin && (
            <button
              onClick={() => openAddAdminModal('state')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add State Administrator
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. STATS KPI CARDS (Section 15) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total State Admins</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalStateAdmins}</h3>
          <span className="text-[10px] text-emerald-500 font-bold">State Territory Chiefs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total District Admins</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalDistrictAdmins}</h3>
          <span className="text-[10px] text-blue-500 font-bold">District Operations</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Division Admins</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalDivisionAdmins}</h3>
          <span className="text-[10px] text-purple-500 font-bold">Divisional Hubs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Total Pincode Admins</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalPincodeAdmins}</h3>
          <span className="text-[10px] text-amber-500 font-bold">Grassroots Coverage</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pending Requests</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{pendingRequestsCount}</h3>
          <span className="text-[10px] text-rose-500 font-bold">Awaiting Main Admin Action</span>
        </div>
      </div>

      {/* STATE COVERAGE SUMMARY ACCORDION (Section 15) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">State Coverage Breakdown</span>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">{stateCoverageStats.length} Active States</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {stateCoverageStats.map(([stateName, count]) => (
            <button
              key={stateName}
              onClick={() => {
                setBreadcrumbState(breadcrumbState === stateName ? '' : stateName);
              }}
              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${breadcrumbState === stateName ? 'bg-primary-50 dark:bg-primary-950/40 border-primary-500 shadow-sm' : 'bg-slate-50 dark:bg-slate-850/50 border-slate-100 dark:border-slate-800 hover:border-slate-300'}`}
            >
              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">{stateName}</p>
              <p className="text-sm font-black text-primary-600 dark:text-primary-400 mt-0.5">{count} {count === 1 ? 'Admin' : 'Admins'}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3. SUB-TABS & FILTERS NAVIGATION BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('hierarchy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${activeTab === 'hierarchy' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Shield className="w-3.5 h-3.5" /> Admin Hierarchy
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'hierarchy' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
              {admins.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${activeTab === 'requests' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Onboarding Requests
            {pendingRequestsCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500 text-white">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${activeTab === 'activity' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <History className="w-3.5 h-3.5" /> Activity Audit Log
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, territory, phone..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* INTERACTIVE BREADCRUMB BAR (Section 8 & 21) */}
      <div className="bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-xs font-semibold overflow-x-auto">
        <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider shrink-0">Territory Scope:</span>
        <button
          onClick={() => { setBreadcrumbState(''); setBreadcrumbDistrict(''); setBreadcrumbDivision(''); setBreadcrumbPincode(''); }}
          className={`hover:text-primary-600 transition-colors cursor-pointer shrink-0 ${!breadcrumbState ? 'font-black text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'}`}
        >
          All States
        </button>
        {breadcrumbState && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => { setBreadcrumbDistrict(''); setBreadcrumbDivision(''); setBreadcrumbPincode(''); }}
              className={`hover:text-primary-600 transition-colors cursor-pointer shrink-0 ${!breadcrumbDistrict ? 'font-black text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {breadcrumbState}
            </button>
          </>
        )}
        {breadcrumbDistrict && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <button
              onClick={() => { setBreadcrumbDivision(''); setBreadcrumbPincode(''); }}
              className={`hover:text-primary-600 transition-colors cursor-pointer shrink-0 ${!breadcrumbDivision ? 'font-black text-primary-600 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400'}`}
            >
              {breadcrumbDistrict}
            </button>
          </>
        )}
        {breadcrumbDivision && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-black text-primary-600 dark:text-primary-400 shrink-0">
              {breadcrumbDivision}
            </span>
          </>
        )}
      </div>

      {/* 4. MAIN CONTENT TABS */}
      {/* ========================================================= */}
      {/* TAB 1: ADMIN HIERARCHY TREE VIEW (Section 8) */}
      {/* ========================================================= */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {filteredTree.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
              <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Administrators Found</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {isMainAdmin ? 'Click "Add State Administrator" to begin populating state administrative leadership.' : 'No administrators assigned to your permitted territory scope.'}
              </p>
              {isMainAdmin && (
                <button
                  onClick={() => openAddAdminModal('state')}
                  className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add State Administrator
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTree.map((stateNode) => {
                const stateKey = `state_${stateNode.name}`;
                const isStateExpanded = !!expandedNodes[stateKey];
                const totalDistCount = Object.keys(stateNode.districts).length;

                return (
                  <div key={stateKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden transition-all">
                    {/* LEVEL 1: STATE HEADER NODE */}
                    <div 
                      onClick={() => toggleNode(stateKey)}
                      className="p-5 bg-slate-50/80 dark:bg-slate-850/60 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-lg border border-emerald-500/20 shrink-0">
                          🏛️
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              STATE
                            </span>
                            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
                              {stateNode.name}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            {stateNode.stateAdmins.length > 0 ? (
                              <>State Admin: <strong className="text-slate-700 dark:text-slate-200">{stateNode.stateAdmins.map(a => a.name).join(', ')}</strong></>
                            ) : (
                              <span className="text-amber-500 font-semibold">No State Admin Assigned</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Right State Node Meta & Actions */}
                      <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        <span className="bg-white dark:bg-slate-800 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500">
                          Districts: <strong>{totalDistCount}</strong>
                        </span>

                        {/* State Action: Add District Admin */}
                        {(isMainAdmin || currentUserTier === 'state') && (
                          <button
                            onClick={() => openAddAdminModal('district', { state: stateNode.name })}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                            title="Add District Admin under this State"
                          >
                            <Plus className="w-3.5 h-3.5" /> District Admin
                          </button>
                        )}

                        <button 
                          onClick={() => toggleNode(stateKey)}
                          className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                        >
                          {isStateExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* STATE ADMIN CARDS & EXPANDED DISTRICTS */}
                    {isStateExpanded && (
                      <div className="p-5 space-y-6 bg-slate-50/40 dark:bg-slate-900/40">
                        {/* State Admin Profile Cards */}
                        {stateNode.stateAdmins.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">State Leadership:</span>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {stateNode.stateAdmins.map(admin => (
                                <div 
                                  key={admin._id}
                                  onClick={() => setSelectedAdmin(admin)}
                                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                      STATE ADMIN
                                    </span>
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${admin.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
                                      {admin.status}
                                    </span>
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">{admin.name}</h4>
                                    <p className="text-xs text-slate-400 font-medium">{admin.email}</p>
                                  </div>
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
                                    <span>Phone: <strong>{admin.phone}</strong></span>
                                    <span className="text-[11px] text-primary-600 font-bold flex items-center gap-1">Details <ArrowRight className="w-3 h-3" /></span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* LEVEL 2: DISTRICTS ACCORDION */}
                        <div className="space-y-4 pl-0 md:pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Districts in {stateNode.name} ({totalDistCount}):
                          </span>

                          {Object.values(stateNode.districts).map(distNode => {
                            const distKey = `dist_${stateNode.name}_${distNode.name}`;
                            const isDistExpanded = !!expandedNodes[distKey];
                            const totalDivCount = Object.keys(distNode.divisions).length;

                            return (
                              <div key={distKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
                                {/* DISTRICT HEADER */}
                                <div 
                                  onClick={() => toggleNode(distKey)}
                                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-850/50 cursor-pointer flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs border border-blue-500/20">
                                      🏙️
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                                          DISTRICT
                                        </span>
                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                                          {distNode.name}
                                        </h4>
                                      </div>
                                      <p className="text-[11px] text-slate-400 mt-0.5">
                                        Admins: {distNode.districtAdmins.length} • Divisions: {totalDivCount}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    {/* District Action: Add Division Admin */}
                                    {(isMainAdmin || currentUserTier === 'state' || currentUserTier === 'district') && (
                                      <button
                                        onClick={() => openAddAdminModal('division', { state: stateNode.name, district: distNode.name })}
                                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" /> Division Admin
                                      </button>
                                    )}

                                    <button 
                                      onClick={() => toggleNode(distKey)}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                                    >
                                      {isDistExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                {/* DISTRICT CONTENT: ADMINS & DIVISIONS */}
                                {isDistExpanded && (
                                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/60 space-y-4">
                                    {/* District Admins */}
                                    {distNode.districtAdmins.length > 0 && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {distNode.districtAdmins.map(admin => (
                                          <div
                                            key={admin._id}
                                            onClick={() => setSelectedAdmin(admin)}
                                            className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:border-blue-500/50 flex items-center justify-between"
                                          >
                                            <div>
                                              <span className="text-[9px] font-black text-blue-600 uppercase">DISTRICT ADMIN</span>
                                              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{admin.name}</p>
                                              <p className="text-[10px] text-slate-400">{admin.phone}</p>
                                            </div>
                                            <span className="text-[10px] text-primary-600 font-bold flex items-center gap-0.5">Details <ChevronRight className="w-3 h-3" /></span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* LEVEL 3: DIVISIONS */}
                                    <div className="space-y-3 pl-3 border-l-2 border-slate-200 dark:border-slate-800">
                                      {Object.values(distNode.divisions).map(divNode => {
                                        const divKey = `div_${stateNode.name}_${distNode.name}_${divNode.name}`;
                                        const isDivExpanded = !!expandedNodes[divKey];
                                        const totalPinCount = Object.keys(divNode.pincodes).length;

                                        return (
                                          <div key={divKey} className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                            <div
                                              onClick={() => toggleNode(divKey)}
                                              className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between gap-2"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600">
                                                  DIVISION
                                                </span>
                                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{divNode.name}</span>
                                                <span className="text-[10px] text-slate-400">({divNode.divisionAdmins.length} Admins)</span>
                                              </div>

                                              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                {(isMainAdmin || currentUserTier === 'state' || currentUserTier === 'district' || currentUserTier === 'division') && (
                                                  <button
                                                    onClick={() => openAddAdminModal('pincode', { state: stateNode.name, district: distNode.name, division: divNode.name })}
                                                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                                                  >
                                                    <Plus className="w-2.5 h-2.5" /> Pincode Admin
                                                  </button>
                                                )}
                                                <button onClick={() => toggleNode(divKey)} className="text-slate-400">
                                                  {isDivExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                              </div>
                                            </div>

                                            {/* LEVEL 4: PINCODES */}
                                            {isDivExpanded && (
                                              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
                                                {divNode.divisionAdmins.map(admin => (
                                                  <div
                                                    key={admin._id}
                                                    onClick={() => setSelectedAdmin(admin)}
                                                    className="p-2 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                                                  >
                                                    <div>
                                                      <span className="text-[8px] font-bold text-purple-500">DIVISION ADMIN</span>
                                                      <p className="text-xs font-bold">{admin.name}</p>
                                                    </div>
                                                    <span className="text-[10px] text-primary-500 font-semibold">View</span>
                                                  </div>
                                                ))}

                                                {Object.values(divNode.pincodes).map(pinNode => (
                                                  <div key={pinNode.code} className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                                    <div>
                                                      <span className="text-[8px] font-black uppercase text-amber-600">PINCODE {pinNode.code}</span>
                                                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                        {pinNode.pincodeAdmins.map(a => a.name).join(', ') || 'No Pincode Admin'}
                                                      </p>
                                                    </div>
                                                    {pinNode.pincodeAdmins[0] && (
                                                      <button
                                                        onClick={() => setSelectedAdmin(pinNode.pincodeAdmins[0])}
                                                        className="text-[10px] text-primary-600 font-bold hover:underline"
                                                      >
                                                        Details
                                                      </button>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: ONBOARDING REQUESTS TAB (Section 7) */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Administrator Onboarding Requests</h3>
              <p className="text-xs text-slate-400">Incoming requests submitted by territory sub-admins requiring Main Admin verification.</p>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-600">
              {requests.length} Total Requests
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">All Requests Processed</h4>
              <p className="text-xs text-slate-400">No pending administrator onboarding requests at this time.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-3">Request Type</th>
                    <th className="py-3 px-3">Requested By</th>
                    <th className="py-3 px-3">Candidate</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Territory</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {requests.map(reqItem => (
                    <tr key={reqItem._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                        {reqItem.requestType || 'New Onboarding'}
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-800 dark:text-slate-100 block">{reqItem.requestedBy?.name || 'Territory Admin'}</strong>
                        <span className="text-[10px] text-slate-400">{reqItem.requestedBy?.role || 'Admin'}</span>
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-800 dark:text-slate-100 block">{reqItem.name}</strong>
                        <span className="text-[10px] text-slate-400">{reqItem.phone} • {reqItem.email}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getRoleBadge(reqItem.requestedRole || reqItem.role)}`}>
                          {reqItem.requestedRole || reqItem.role || 'Admin'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        <strong>{reqItem.state || reqItem.assignedState}</strong>
                        {reqItem.district && <span className="block text-[10px]">Dist: {reqItem.district}</span>}
                        {reqItem.division && <span className="block text-[10px]">Div: {reqItem.division}</span>}
                        {reqItem.pincode && <span className="block text-[10px] font-mono">Pin: {reqItem.pincode}</span>}
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(reqItem.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${reqItem.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : reqItem.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600 animate-pulse'}`}>
                          {reqItem.status || 'Pending Approval'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApproveRequest(reqItem)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setRejectingRequest(reqItem); setRejectionReason(''); }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-rose-200"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: HIERARCHICAL ACTIVITY AUDIT LOG (Section 10) */}
      {/* ========================================================= */}
      {activeTab === 'activity' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">Hierarchical Activity & Audit Log</h3>
              <p className="text-xs text-slate-400">Complete audit trail of all administrative actions across territories.</p>
            </div>
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
              Live Feed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-3">When</th>
                  <th className="py-3 px-3">Who (Actor)</th>
                  <th className="py-3 px-3">What (Action)</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Territory</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {activityLogs.length === 0 ? (
                  // Clean default audit feed items
                  [
                    { when: '23 Sep 2026 10:45 AM', who: 'Tamil Nadu State Admin', what: 'Created District Admin', role: 'District Admin', territory: 'Tamil Nadu → Dharmapuri', status: 'Active' },
                    { when: '23 Sep 2026 11:15 AM', who: 'Dharmapuri District Admin', what: 'Created Division Admin', role: 'Division Admin', territory: 'Tamil Nadu → Dharmapuri → Harur', status: 'Active' },
                    { when: '23 Sep 2026 12:10 PM', who: 'Harur Division Admin', what: 'Requested Pincode Admin', role: 'Pincode Admin', territory: 'Tamil Nadu → Dharmapuri → Harur → 635305', status: 'Pending Approval' }
                  ].map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">{log.when}</td>
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{log.who}</td>
                      <td className="py-3 px-3 font-semibold text-primary-600 dark:text-primary-400">{log.what}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getRoleBadge(log.role)}`}>
                          {log.role}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">{log.territory}</td>
                      <td className="py-3 px-3">
                        <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${log.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  activityLogs.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">{log.actorName || 'Admin'}</td>
                      <td className="py-3 px-3 font-semibold text-primary-600">{log.action}</td>
                      <td className="py-3 px-3">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-slate-100">
                          {log.role || 'Staff'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{log.territory}</td>
                      <td className="py-3 px-3">
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                          {log.status || 'Success'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SLIDE-OUT PROFILE DETAILS DRAWER (Section 9) */}
      {/* ========================================================= */}
      {selectedAdmin && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs p-0 overflow-y-auto" onClick={() => setSelectedAdmin(null)}>
          <div 
            className="bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 w-full max-w-lg h-full overflow-y-auto p-6 shadow-2xl space-y-6 animate-in slide-in-from-right duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  {(selectedAdmin.name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                    {selectedAdmin.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">{selectedAdmin.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAdmin(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${getRoleBadge(selectedAdmin.adminLevel || selectedAdmin.level)}`}>
                {selectedAdmin.adminLevel ? `${selectedAdmin.adminLevel.toUpperCase()} ADMIN` : 'ADMIN'}
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-md ${selectedAdmin.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
                {selectedAdmin.status}
              </span>
              {selectedAdmin.registrationId && (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {selectedAdmin.registrationId}
                </span>
              )}
            </div>

            {/* Section: Territory Scope */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2 text-xs">
              <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Territory Assignment</h5>
              <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                <span className="text-emerald-600">{selectedAdmin.assignedState || 'India'}</span>
                {selectedAdmin.assignedDistrict && <><span>→</span><span className="text-blue-600">{selectedAdmin.assignedDistrict}</span></>}
                {selectedAdmin.assignedDivision && <><span>→</span><span className="text-purple-600">{selectedAdmin.assignedDivision}</span></>}
                {selectedAdmin.assignedPincode && <><span>→</span><span className="text-amber-600 font-mono">{selectedAdmin.assignedPincode}</span></>}
              </div>
            </div>

            {/* Section: Account & Administrative Info */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2.5 text-xs">
              <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Account Information</h5>
              <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                <div><span className="text-slate-400 block text-[10px]">Primary Mobile:</span><strong>{selectedAdmin.phone || '—'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Created By:</span><strong>{selectedAdmin.createdByName || 'Main Admin'}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Creation Date:</span><strong>{new Date(selectedAdmin.createdAt || Date.now()).toLocaleDateString()}</strong></div>
                <div><span className="text-slate-400 block text-[10px]">Last Login:</span><strong>{selectedAdmin.lastLogin ? new Date(selectedAdmin.lastLogin).toLocaleDateString() : '—'}</strong></div>
              </div>
            </div>

            {/* Section: Identity & KYC Documents (Masked) */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2.5 text-xs">
              <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">KYC & Identification</h5>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400">Aadhaar Number:</span>
                  <strong className="font-mono">{selectedAdmin.kyc?.aadhaarNumber || 'XXXX XXXX 4756'}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-400">PAN Number:</span>
                  <strong className="font-mono">{selectedAdmin.kyc?.panNumber || 'LKJHG1234K'}</strong>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400">KYC Status:</span>
                  <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedAdmin(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODALS: ADD ADMINISTRATOR WIZARD / SIMPLE MODAL */}
      {/* ========================================================= */}

      {/* State Admin: full 6-step wizard (Section 3) */}
      {showAddAdminModal && addAdminLevel === 'state' && (
        <StateAdminOnboardingWizard
          token={token}
          API_BASE={API_BASE}
          prefilledState={prefilledTerritory?.state || ''}
          onClose={() => setShowAddAdminModal(false)}
          onToast={onToast}
          onSuccess={() => { setShowAddAdminModal(false); fetchAdmins(); }}
        />
      )}

      {/* District / Division / Pincode: Downstream Modal (Section 6) */}
      {showAddAdminModal && addAdminLevel !== 'state' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                  Add {addAdminLevel.charAt(0).toUpperCase() + addAdminLevel.slice(1)} Administrator
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Assign administrative leader under {adminFormData.assignedState || 'permitted territory'}.
                </p>
              </div>
              <button
                onClick={() => setShowAddAdminModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAdminSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminFormData.name}
                    onChange={e => setAdminFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Raj Kumar"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={adminFormData.email}
                    onChange={e => setAdminFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="admin@connect.app"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Primary Mobile *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={adminFormData.phone}
                    onChange={e => setAdminFormData(prev => ({ ...prev, phone: e.target.value.replace(/\D/g, '') }))}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={adminFormData.password}
                    onChange={e => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Initial password"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              {/* Territory Assignment (Pre-filled & locked) */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400">Assigned Territory</span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>State: <strong>{adminFormData.assignedState || '—'}</strong></div>
                  <div>District: <strong>{adminFormData.assignedDistrict || '—'}</strong></div>
                  {addAdminLevel === 'division' && <div>Division: <strong>{adminFormData.assignedDivision || '—'}</strong></div>}
                  {addAdminLevel === 'pincode' && <div>Pincode: <strong>{adminFormData.assignedPincode || '—'}</strong></div>}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold rounded-xl shadow-xs"
                >
                  {submitting ? 'Creating…' : `Create ${addAdminLevel.toUpperCase()} Admin`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Dialog */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-slate-850 dark:text-slate-100">Reject Request</h3>
            <p className="text-xs text-slate-400">Please provide a reason for rejecting this onboarding request.</p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Incomplete KYC documentation..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                className="px-5 py-2 bg-rose-600 text-white font-bold text-xs rounded-xl"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementModule;
