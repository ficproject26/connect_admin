import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Shield, ShieldCheck, Award, Users, ChevronDown, ChevronRight, Plus, Search,
  Filter, RefreshCw, X, User, Phone, Mail, MapPin, Building, Building2, Store,
  CheckCircle, XCircle, Clock, AlertTriangle, ArrowRight, Eye, Edit2, Lock,
  ChevronUp, UserCheck, Briefcase, FileText, Download, Layers
} from 'lucide-react';

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", 
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", 
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", 
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", 
  "Uttarakhand", "West Bengal", "Delhi", "Puducherry"
];

const MANAGER_LIMITS = {
  state: 8,
  district: 2,
  division: 2,
  pincode: 2
};

export const AdminManagementModule = ({ token, API_BASE, currentUser, onToast }) => {
  // Primary Tabs
  const [activeTab, setActiveTab] = useState('hierarchy'); // 'hierarchy' | 'managers' | 'requests'

  // Data States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [managers, setManagers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [isMainAdmin, setIsMainAdmin] = useState(true);
  const [currentUserTier, setCurrentUserTier] = useState('main');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');

  // Tree Expansion State
  const [expandedNodes, setExpandedNodes] = useState({});

  // Slide-out Profile Details Modal
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);

  // Modal States
  const [showAddAdminModal, setShowAddAdminModal] = useState(false);
  const [addAdminLevel, setAddAdminLevel] = useState('state'); // 'state' | 'district' | 'division' | 'pincode'
  const [prefilledTerritory, setPrefilledTerritory] = useState({});

  const [showRequestManagerModal, setShowRequestManagerModal] = useState(false);
  const [managerRequestLevel, setManagerRequestLevel] = useState('state');

  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form Submitting States
  const [submitting, setSubmitting] = useState(false);

  // Add Admin Form Fields
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    phone: '',
    altPhone: '',
    password: '',
    adminLevel: 'state',
    assignedState: '',
    assignedDistrict: '',
    assignedDivision: '',
    assignedPincode: '',
    postOffice: '',
    address: '',
    status: 'Active'
  });

  // Request Manager Form Fields
  const [managerFormData, setManagerFormData] = useState({
    name: '',
    email: '',
    phone: '',
    altPhone: '',
    level: 'state',
    assignedState: '',
    assignedDistrict: '',
    assignedDivision: '',
    assignedPincode: '',
    address: '',
    notes: ''
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

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const fetchAdmins = async () => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/hierarchy-admins`, {
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins || []);
        setIsMainAdmin(!!data.isMainAdmin);
        setCurrentUserTier(data.currentUserTier || 'main');
      } else {
        throw new Error(`Failed to load admins (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error('Fetch hierarchy admins error:', err);
      setError('Unable to load administrator hierarchy. Please retry.');
    }
  };

  const fetchManagers = async () => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/managers`, {
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setManagers(data.managers || []);
      }
    } catch (err) {
      console.error('Fetch managers error:', err);
    }
  };

  const fetchRequests = async () => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/managers/requests`, {
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Fetch manager requests error:', err);
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    await Promise.all([fetchAdmins(), fetchManagers(), fetchRequests()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Fetch cascading territory options when state/district/division changes in form
  const fetchTerritoryOptions = async (stateVal, distVal, divVal) => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const params = new URLSearchParams();
      if (stateVal) params.append('state', stateVal);
      if (distVal) params.append('district', distVal);
      if (divVal) params.append('division', divVal);

      const res = await fetch(`${API_BASE}/admin/territory/options?${params.toString()}`, {
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTerritoryOptions({
          states: data.states || INDIAN_STATES,
          districts: data.districts || [],
          divisions: data.divisions || [],
          pincodes: data.pincodes || []
        });
      }
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
  // Group Admins & Managers by Territory Tree:
  // State -> State Admins, State Managers, Districts -> District Admins, District Managers, Divisions -> Division Admins, Division Managers, Pincodes -> Pincode Admins, Pincode Managers
  const hierarchyTree = useMemo(() => {
    const statesMap = {};

    // 1. Process Admins
    admins.forEach(admin => {
      const stateName = (admin.assignedState || 'Unassigned State').trim();
      const distName = (admin.assignedDistrict || '').trim();
      const divName = (admin.assignedDivision || '').trim();
      const pinCode = (admin.assignedPincode || '').trim();
      const level = (admin.adminLevel || admin.level || '').toLowerCase();

      if (!statesMap[stateName]) {
        statesMap[stateName] = {
          name: stateName,
          stateAdmins: [],
          stateManagers: [],
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
            districtManagers: [],
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
              divisionManagers: [],
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
                pincodeAdmins: [],
                pincodeManagers: []
              };
            }
            statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey].pincodeAdmins.push(admin);
          }
        }
      }
    });

    // 2. Process Managers
    managers.forEach(mgr => {
      const stateName = (mgr.assignedState || 'Unassigned State').trim();
      const distName = (mgr.assignedDistrict || '').trim();
      const divName = (mgr.assignedDivision || '').trim();
      const pinCode = (mgr.assignedPincode || '').trim();
      const level = (mgr.level || '').toLowerCase();

      if (!statesMap[stateName]) {
        statesMap[stateName] = {
          name: stateName,
          stateAdmins: [],
          stateManagers: [],
          districts: {}
        };
      }

      if (level === 'state') {
        statesMap[stateName].stateManagers.push(mgr);
      } else if (distName) {
        const dKey = distName;
        if (!statesMap[stateName].districts[dKey]) {
          statesMap[stateName].districts[dKey] = {
            name: dKey,
            districtAdmins: [],
            districtManagers: [],
            divisions: {}
          };
        }

        if (level === 'district') {
          statesMap[stateName].districts[dKey].districtManagers.push(mgr);
        } else if (divName) {
          const vKey = divName;
          if (!statesMap[stateName].districts[dKey].divisions[vKey]) {
            statesMap[stateName].districts[dKey].divisions[vKey] = {
              name: vKey,
              divisionAdmins: [],
              divisionManagers: [],
              pincodes: {}
            };
          }

          if (level === 'division') {
            statesMap[stateName].districts[dKey].divisions[vKey].divisionManagers.push(mgr);
          } else if (pinCode) {
            const pKey = pinCode;
            if (!statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey]) {
              statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey] = {
                code: pKey,
                pincodeAdmins: [],
                pincodeManagers: []
              };
            }
            statesMap[stateName].districts[dKey].divisions[vKey].pincodes[pKey].pincodeManagers.push(mgr);
          }
        }
      }
    });

    return Object.values(statesMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [admins, managers]);

  // Filtered Hierarchy for UI Search
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim() && roleFilter === 'All' && statusFilter === 'All' && stateFilter === 'All') {
      return hierarchyTree;
    }
    const q = searchQuery.toLowerCase().trim();

    return hierarchyTree.filter(st => {
      if (stateFilter !== 'All' && st.name.toLowerCase() !== stateFilter.toLowerCase()) return false;
      if (!q) return true;

      const matchesState = st.name.toLowerCase().includes(q);
      const matchesAdmin = st.stateAdmins.some(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.phone.includes(q));
      const matchesDist = Object.values(st.districts).some(d =>
        d.name.toLowerCase().includes(q) ||
        d.districtAdmins.some(a => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
      );
      return matchesState || matchesAdmin || matchesDist;
    });
  }, [hierarchyTree, searchQuery, roleFilter, statusFilter, stateFilter]);

  // Aggregate Counts
  const totalStateAdmins = admins.filter(a => (a.adminLevel || a.level) === 'state').length;
  const totalDistrictAdmins = admins.filter(a => (a.adminLevel || a.level) === 'district').length;
  const totalDivisionAdmins = admins.filter(a => (a.adminLevel || a.level) === 'division').length;
  const totalPincodeAdmins = admins.filter(a => (a.adminLevel || a.level) === 'pincode').length;

  const pendingRequestsCount = requests.filter(r => r.status === 'Pending').length;

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

  // Open "Request Manager" Modal
  const openRequestManagerModal = (level, territory = {}) => {
    setManagerRequestLevel(level);
    setManagerFormData({
      name: '',
      email: '',
      phone: '',
      altPhone: '',
      level,
      assignedState: territory.state || currentUser?.assignedState || '',
      assignedDistrict: territory.district || currentUser?.assignedDistrict || '',
      assignedDivision: territory.division || currentUser?.assignedDivision || '',
      assignedPincode: territory.pincode || currentUser?.assignedPincode || '',
      address: '',
      notes: ''
    });
    setShowRequestManagerModal(true);
  };

  // Handle Create Admin Submit
  const handleCreateAdminSubmit = async (e) => {
    e.preventDefault();
    if (!adminFormData.name || !adminFormData.email || !adminFormData.password) {
      notify('Please fill in all required fields.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/hierarchy-admins`, {
        method: 'POST',
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adminFormData)
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.msg || 'Administrator created successfully.', 'success');
        setShowAddAdminModal(false);
        fetchAdmins();
      } else {
        notify(data.msg || data.message || 'Failed to create administrator.', 'error');
      }
    } catch (err) {
      console.error('Create admin error:', err);
      notify('Error creating administrator.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Request Manager Submit
  const handleRequestManagerSubmit = async (e) => {
    e.preventDefault();
    if (!managerFormData.name || !managerFormData.email || !managerFormData.phone) {
      notify('Please fill in candidate details.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/managers/request`, {
        method: 'POST',
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(managerFormData)
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.msg || 'Manager onboarding request submitted successfully.', 'success');
        setShowRequestManagerModal(false);
        fetchRequests();
      } else {
        notify(data.msg || data.message || 'Failed to request manager.', 'error');
      }
    } catch (err) {
      console.error('Request manager error:', err);
      notify('Error requesting manager.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve Manager Request
  const handleApproveRequest = async (requestId) => {
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/managers/requests/${requestId}/approve`, {
        method: 'PUT',
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.msg || 'Manager request approved.', 'success');
        fetchRequests();
        fetchManagers();
      } else {
        notify(data.msg || 'Failed to approve request.', 'error');
      }
    } catch (err) {
      console.error('Approve manager error:', err);
      notify('Error approving manager request.', 'error');
    }
  };

  // Handle Reject Manager Request
  const handleRejectRequest = async () => {
    if (!rejectingRequest) return;
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('token') : '');
      const res = await fetch(`${API_BASE}/admin/managers/requests/${rejectingRequest._id}/reject`, {
        method: 'PUT',
        headers: {
          'x-auth-token': activeToken || '',
          'Authorization': activeToken ? `Bearer ${activeToken}` : '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: rejectionReason || 'Rejected by Main Admin' })
      });
      const data = await res.json();
      if (res.ok) {
        notify(data.msg || 'Manager request rejected.', 'info');
        setRejectingRequest(null);
        setRejectionReason('');
        fetchRequests();
      } else {
        notify(data.msg || 'Failed to reject request.', 'error');
      }
    } catch (err) {
      console.error('Reject manager error:', err);
      notify('Error rejecting manager request.', 'error');
    }
  };

  // Helper Badge Color
  const getRoleBadge = (role, level) => {
    const l = (level || role || '').toLowerCase();
    if (l.includes('state')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (l.includes('dist')) return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
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
            <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-linear-to-r from-primary-600 to-indigo-600 text-white shadow-xs">
              Hierarchy Suite
            </span>
            {isMainAdmin && (
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                👑 Super Admin Access
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Hierarchical Administration & Territory Governance: State Admin → District Admin → Division Admin → Pincode Admin.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Main Admin Only: Add State Admin */}
          {isMainAdmin && (
            <button
              onClick={() => openAddAdminModal('state')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" /> Add State Admin
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

      {/* 2. STATS KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">State Admins</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalStateAdmins}</h3>
          <span className="text-[10px] text-emerald-500 font-bold">State Territory Chiefs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">District Admins</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalDistrictAdmins}</h3>
          <span className="text-[10px] text-blue-500 font-bold">District Operations</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Division Admins</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalDivisionAdmins}</h3>
          <span className="text-[10px] text-purple-500 font-bold">Divisional Hubs</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pincode Admins</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <MapPin className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalPincodeAdmins}</h3>
          <span className="text-[10px] text-amber-500 font-bold">Grassroots Coverage</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Active Managers</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">{managers.length}</h3>
          <span className="text-[10px] text-indigo-500 font-bold">
            {pendingRequestsCount > 0 ? `${pendingRequestsCount} Pending Requests` : 'Full Territory Staffing'}
          </span>
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
            onClick={() => setActiveTab('managers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${activeTab === 'managers' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Users className="w-3.5 h-3.5" /> Managers
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'managers' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
              {managers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${activeTab === 'requests' ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Manager Requests
            {pendingRequestsCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-rose-500 text-white animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
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

      {/* 4. MAIN CONTENT TABS */}
      {/* ========================================================= */}
      {/* TAB 1: ADMIN HIERARCHY TREE VIEW */}
      {/* ========================================================= */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          {filteredTree.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Shield className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Administrators Found</h4>
              <p className="text-xs text-slate-400">
                {isMainAdmin ? 'Click "Add State Admin" to begin populating state administrative leadership.' : 'No administrators assigned to your permitted territory scope.'}
              </p>
              {isMainAdmin && (
                <button
                  onClick={() => openAddAdminModal('state')}
                  className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add State Admin
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTree.map((stateNode) => {
                const stateKey = `state_${stateNode.name}`;
                const isStateExpanded = !!expandedNodes[stateKey];

                const totalDistCount = Object.keys(stateNode.districts).length;
                const totalMgrCount = stateNode.stateManagers.length + Object.values(stateNode.districts).reduce((s, d) => s + d.districtManagers.length, 0);

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
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            Districts: <strong>{totalDistCount}</strong>
                          </span>
                          <span className="bg-white dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            Managers: <strong>{totalMgrCount}</strong>
                          </span>
                        </div>

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

                        {/* Request State Manager */}
                        <button
                          onClick={() => openRequestManagerModal('state', { state: stateNode.name })}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                          title="Nominate State Manager"
                        >
                          <Users className="w-3.5 h-3.5" /> Request Mgr
                        </button>

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
                                  className="p-4 bg-slate-100/60 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-sm border border-blue-500/20 shrink-0">
                                      🏢
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                          DISTRICT
                                        </span>
                                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">{distNode.name}</h4>
                                      </div>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        {distNode.districtAdmins.length > 0 ? (
                                          <>District Admin: <strong className="text-slate-700 dark:text-slate-200">{distNode.districtAdmins.map(a => a.name).join(', ')}</strong></>
                                        ) : (
                                          <span className="text-amber-500">No District Admin</span>
                                        )}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                    <span className="text-xs text-slate-400 font-semibold bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                      Divisions: <strong>{totalDivCount}</strong>
                                    </span>

                                    {/* Action: Add Division Admin */}
                                    {(isMainAdmin || currentUserTier === 'state' || currentUserTier === 'district') && (
                                      <button
                                        onClick={() => openAddAdminModal('division', { state: stateNode.name, district: distNode.name })}
                                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                        title="Add Division Admin under this District"
                                      >
                                        <Plus className="w-3.5 h-3.5" /> Division Admin
                                      </button>
                                    )}

                                    {/* Request District Manager */}
                                    <button
                                      onClick={() => openRequestManagerModal('district', { state: stateNode.name, district: distNode.name })}
                                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                      title="Nominate District Manager"
                                    >
                                      <Users className="w-3.5 h-3.5" /> Request Mgr
                                    </button>

                                    <button onClick={() => toggleNode(distKey)} className="p-1 text-slate-400 hover:text-slate-600">
                                      {isDistExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                {/* DISTRICT CONTENT: DIVISIONS ACCORDION */}
                                {isDistExpanded && (
                                  <div className="p-4 space-y-4 bg-slate-50/20 dark:bg-slate-900/20">
                                    {/* District Admins Cards */}
                                    {distNode.districtAdmins.length > 0 && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                        {distNode.districtAdmins.map(admin => (
                                          <div 
                                            key={admin._id}
                                            onClick={() => setSelectedAdmin(admin)}
                                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl hover:border-blue-500/50 cursor-pointer flex justify-between items-center"
                                          >
                                            <div>
                                              <span className="text-[10px] font-black uppercase text-blue-600">District Admin</span>
                                              <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100">{admin.name}</h5>
                                              <span className="text-[11px] text-slate-400">{admin.phone}</span>
                                            </div>
                                            <Eye className="w-4 h-4 text-slate-400" />
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* LEVEL 3: DIVISIONS */}
                                    <div className="space-y-3 pl-0 md:pl-3 border-l-2 border-slate-200 dark:border-slate-800">
                                      {Object.values(distNode.divisions).map(divNode => {
                                        const divKey = `div_${distKey}_${divNode.name}`;
                                        const isDivExpanded = !!expandedNodes[divKey];
                                        const totalPinCount = Object.keys(divNode.pincodes).length;

                                        return (
                                          <div key={divKey} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                            {/* DIVISION HEADER */}
                                            <div 
                                              onClick={() => toggleNode(divKey)}
                                              className="p-3 bg-slate-50 dark:bg-slate-850/50 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                                                  DIVISION
                                                </span>
                                                <h5 className="text-xs font-black text-slate-800 dark:text-slate-100">{divNode.name}</h5>
                                                {divNode.divisionAdmins.length > 0 && (
                                                  <span className="text-[11px] text-slate-400">({divNode.divisionAdmins.map(a => a.name).join(', ')})</span>
                                                )}
                                              </div>

                                              <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                <span className="text-[10px] text-slate-400 font-semibold bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                                                  Pincodes: <strong>{totalPinCount}</strong>
                                                </span>

                                                {/* Action: Add Pincode Admin */}
                                                {(isMainAdmin || currentUserTier === 'state' || currentUserTier === 'district' || currentUserTier === 'division') && (
                                                  <button
                                                    onClick={() => openAddAdminModal('pincode', { state: stateNode.name, district: distNode.name, division: divNode.name })}
                                                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                                    title="Add Pincode Admin"
                                                  >
                                                    <Plus className="w-3 h-3" /> Pincode Admin
                                                  </button>
                                                )}

                                                <button
                                                  onClick={() => openRequestManagerModal('division', { state: stateNode.name, district: distNode.name, division: divNode.name })}
                                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2 py-1 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                                  title="Nominate Division Manager"
                                                >
                                                  <Users className="w-3 h-3" /> Req Mgr
                                                </button>

                                                <button onClick={() => toggleNode(divKey)} className="p-1 text-slate-400">
                                                  {isDivExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                </button>
                                              </div>
                                            </div>

                                            {/* LEVEL 4: PINCODES */}
                                            {isDivExpanded && (
                                              <div className="p-3 space-y-2 bg-slate-50/20 dark:bg-slate-900/30">
                                                {/* Division Admin Card */}
                                                {divNode.divisionAdmins.length > 0 && (
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                                    {divNode.divisionAdmins.map(admin => (
                                                      <div 
                                                        key={admin._id}
                                                        onClick={() => setSelectedAdmin(admin)}
                                                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg hover:border-purple-500/50 cursor-pointer flex justify-between items-center"
                                                      >
                                                        <div>
                                                          <span className="text-[9px] font-black uppercase text-purple-600">Division Admin</span>
                                                          <h6 className="text-xs font-bold text-slate-800 dark:text-slate-100">{admin.name}</h6>
                                                          <span className="text-[10px] text-slate-400">{admin.phone}</span>
                                                        </div>
                                                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}

                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                                                  {Object.values(divNode.pincodes).map(pinNode => (
                                                    <div 
                                                      key={pinNode.code}
                                                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-xl space-y-2 shadow-2xs"
                                                    >
                                                      <div className="flex items-center justify-between">
                                                        <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                                          PIN: {pinNode.code}
                                                        </span>
                                                        <button
                                                          onClick={() => openRequestManagerModal('pincode', { state: stateNode.name, district: distNode.name, division: divNode.name, pincode: pinNode.code })}
                                                          className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer flex items-center gap-0.5"
                                                        >
                                                          + Req Mgr
                                                        </button>
                                                      </div>

                                                      {pinNode.pincodeAdmins.length > 0 ? (
                                                        pinNode.pincodeAdmins.map(admin => (
                                                          <div 
                                                            key={admin._id} 
                                                            onClick={() => setSelectedAdmin(admin)}
                                                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 p-1.5 rounded-lg transition-colors"
                                                          >
                                                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{admin.name}</p>
                                                            <p className="text-[10px] text-slate-400">{admin.phone}</p>
                                                          </div>
                                                        ))
                                                      ) : (
                                                        <p className="text-[10px] text-slate-400 italic">No Pincode Admin</p>
                                                      )}
                                                    </div>
                                                  ))}
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
      {/* TAB 2: MANAGERS HIERARCHY TREE */}
      {/* ========================================================= */}
      {activeTab === 'managers' && (
        <div className="space-y-4">
          <div className="bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-blue-500/10 border border-indigo-500/20 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-indigo-900 dark:text-indigo-200">Territory Operational Managers</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Managers are nominated by territory administrators and approved by Main Admin. Limits: State (8), District (2), Division (2), Pincode (2).
              </p>
            </div>
            <button
              onClick={() => openRequestManagerModal('state')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Request Manager
            </button>
          </div>

          {managers.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Territory Managers Onboarded</h4>
              <p className="text-xs text-slate-400">
                Territory administrators can submit manager onboarding requests for Main Admin approval.
              </p>
              <button
                onClick={() => openRequestManagerModal('state')}
                className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Request Manager
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {managers.map(mgr => (
                <div 
                  key={mgr._id}
                  onClick={() => setSelectedManager(mgr)}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs hover:border-indigo-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getRoleBadge(mgr.level, mgr.level)}`}>
                        {mgr.level.toUpperCase()} MANAGER
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {mgr.status || 'Active'}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-850 dark:text-slate-100 text-sm">{mgr.name}</h4>
                      <p className="text-xs text-slate-400 font-medium">{mgr.email}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between"><span className="text-slate-400">Mobile:</span><strong>{mgr.phone}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">State:</span><strong>{mgr.assignedState || '—'}</strong></div>
                      {mgr.assignedDistrict && <div className="flex justify-between"><span className="text-slate-400">District:</span><strong>{mgr.assignedDistrict}</strong></div>}
                      {mgr.assignedDivision && <div className="flex justify-between"><span className="text-slate-400">Division:</span><strong>{mgr.assignedDivision}</strong></div>}
                      {mgr.assignedPincode && <div className="flex justify-between"><span className="text-slate-400">Pincode:</span><strong className="font-mono">{mgr.assignedPincode}</strong></div>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                    <span className="text-[10px] text-slate-400 font-mono">ID: {mgr.managerId || 'MGR-—'}</span>
                    <span className="text-indigo-600 font-bold flex items-center gap-1 text-[11px]">View <ArrowRight className="w-3 h-3" /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: MANAGER REQUESTS WORKFLOW */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs flex justify-between items-center">
            <div>
              <h4 className="text-sm font-bold text-slate-850 dark:text-slate-100">Manager Onboarding Requests</h4>
              <p className="text-xs text-slate-400">
                Incoming candidate nominations from territory administrators. Main Admin can review, approve, or reject.
              </p>
            </div>
            <button
              onClick={() => openRequestManagerModal('state')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> New Nomination
            </button>
          </div>

          {requests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-2">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Manager Requests</h4>
              <p className="text-xs text-slate-400">All submitted manager requests have been processed.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-3 px-4">Request ID & Candidate</th>
                    <th className="py-3 px-4">Level</th>
                    <th className="py-3 px-4">Territory</th>
                    <th className="py-3 px-4">Nominated By</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    {isMainAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                  {requests.map(req => (
                    <tr key={req._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono text-[10px] text-slate-400 font-bold block">{req.requestId}</span>
                        <strong className="text-slate-800 dark:text-slate-100 text-xs block">{req.name}</strong>
                        <span className="text-slate-400 text-[11px]">{req.phone} • {req.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${getRoleBadge(req.level, req.level)}`}>
                          {req.level} Manager
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <strong>{req.assignedState}</strong>
                        {req.assignedDistrict && <span className="block text-[11px] text-slate-400">Dist: {req.assignedDistrict}</span>}
                        {req.assignedDivision && <span className="block text-[11px] text-slate-400">Div: {req.assignedDivision}</span>}
                        {req.assignedPincode && <span className="block text-[11px] font-mono text-slate-400">Pin: {req.assignedPincode}</span>}
                      </td>
                      <td className="py-3 px-4">
                        <strong className="text-slate-700 dark:text-slate-200">{req.requestingAdminName || req.requestedBy?.name || 'Field Admin'}</strong>
                        <span className="text-[10px] text-slate-400 block uppercase">{req.requestingAdminRole || req.requestedBy?.adminRole || 'Admin'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${req.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : req.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20 animate-pulse'}`}>
                          {req.status}
                        </span>
                      </td>
                      {isMainAdmin && (
                        <td className="py-3 px-4 text-right">
                          {req.status === 'Pending' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApproveRequest(req._id)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setRejectingRequest(req); setRejectionReason(''); }}
                                className="bg-slate-100 hover:bg-rose-50 text-rose-600 font-bold text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Processed</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. SLIDE-OUT PROFILE DETAILS MODAL (ADMIN / MANAGER) */}
      {/* ========================================================= */}
      {(selectedAdmin || selectedManager) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-primary-600 to-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                  {((selectedAdmin || selectedManager).name || 'A')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                    {(selectedAdmin || selectedManager).name}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    {(selectedAdmin || selectedManager).email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedAdmin(null); setSelectedManager(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* DETAILS ACCORDIONS */}
            <div className="space-y-4 text-xs">
              {/* Personal Details */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2">
                <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Personal Contact</h5>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div><span className="text-slate-400 block text-[10px]">Primary Mobile:</span><strong>{(selectedAdmin || selectedManager).phone || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Alternate Mobile:</span><strong>{(selectedAdmin || selectedManager).altPhone || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Registration / ID:</span><strong className="font-mono">{(selectedAdmin || selectedManager).registrationId || (selectedAdmin || selectedManager).managerId || '—'}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Status:</span><strong className="text-emerald-500">{(selectedAdmin || selectedManager).status}</strong></div>
                </div>
              </div>

              {/* Territory Details & Breadcrumb */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2">
                <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Assigned Territory & Breadcrumb</h5>
                <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                  <span className="text-emerald-600">{(selectedAdmin || selectedManager).assignedState || 'India'}</span>
                  {(selectedAdmin || selectedManager).assignedDistrict && <><span>→</span><span className="text-blue-600">{(selectedAdmin || selectedManager).assignedDistrict}</span></>}
                  {(selectedAdmin || selectedManager).assignedDivision && <><span>→</span><span className="text-purple-600">{(selectedAdmin || selectedManager).assignedDivision}</span></>}
                  {(selectedAdmin || selectedManager).assignedPincode && <><span>→</span><span className="text-amber-600 font-mono">{(selectedAdmin || selectedManager).assignedPincode}</span></>}
                </div>
                {(selectedAdmin || selectedManager).address && (
                  <p className="text-[11px] text-slate-500 pt-1">
                    Address: {(selectedAdmin || selectedManager).address || (selectedAdmin || selectedManager).fullAddress}
                  </p>
                )}
              </div>

              {/* Administrative Access & Scope */}
              {selectedAdmin && (
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl space-y-2">
                  <h5 className="font-extrabold uppercase tracking-wider text-slate-400 text-[10px]">Access & Scope</h5>
                  <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                    <div><span className="text-slate-400 block text-[10px]">Parent Administrator:</span><strong>{selectedAdmin.parentAdmin?.name || 'Main Super Admin'}</strong></div>
                    <div><span className="text-slate-400 block text-[10px]">Admin Rank:</span><strong>{selectedAdmin.adminLevel?.toUpperCase()} ADMIN</strong></div>
                    <div><span className="text-slate-400 block text-[10px]">Direct Sub-Admins:</span><strong>{selectedAdmin.childAdminCount || 0}</strong></div>
                    <div><span className="text-slate-400 block text-[10px]">Managed Territory Staff:</span><strong>{selectedAdmin.managerCount || 0}</strong></div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => { setSelectedAdmin(null); setSelectedManager(null); }}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL: ADD ADMINISTRATOR (STATE / DISTRICT / DIVISION / PINCODE) */}
      {/* ========================================================= */}
      {showAddAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                  Add {addAdminLevel.charAt(0).toUpperCase() + addAdminLevel.slice(1)} Administrator
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {addAdminLevel === 'state' ? 'ONLY Main Admin can assign state administration leadership.' : `Assign a new administrative leader under ${adminFormData.assignedState || 'permitted territory'}.`}
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
                    value={adminFormData.phone}
                    onChange={e => setAdminFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Alternate Mobile</label>
                  <input
                    type="tel"
                    value={adminFormData.altPhone}
                    onChange={e => setAdminFormData(prev => ({ ...prev, altPhone: e.target.value }))}
                    placeholder="Optional backup mobile"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={adminFormData.password}
                  onChange={e => setAdminFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                />
              </div>

              {/* Territory Selectors */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Territory Assignment</span>

                {/* State Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">State *</label>
                  {isMainAdmin && addAdminLevel === 'state' ? (
                    <select
                      required
                      value={adminFormData.assignedState}
                      onChange={e => {
                        const val = e.target.value;
                        setAdminFormData(prev => ({ ...prev, assignedState: val }));
                        fetchTerritoryOptions(val, '', '');
                      }}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold cursor-pointer"
                    >
                      <option value="">Select State...</option>
                      {territoryOptions.states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      value={adminFormData.assignedState}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-700 dark:text-slate-300"
                    />
                  )}
                </div>

                {/* District Selection if level >= district */}
                {['district', 'division', 'pincode'].includes(addAdminLevel) && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">District *</label>
                    {currentUserTier === 'district' ? (
                      <input
                        type="text"
                        readOnly
                        value={adminFormData.assignedDistrict}
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-bold"
                      />
                    ) : territoryOptions.districts.length > 0 ? (
                      <select
                        required
                        value={adminFormData.assignedDistrict}
                        onChange={e => {
                          const val = e.target.value;
                          setAdminFormData(prev => ({ ...prev, assignedDistrict: val }));
                          fetchTerritoryOptions(adminFormData.assignedState, val, '');
                        }}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold cursor-pointer"
                      >
                        <option value="">Select District...</option>
                        {territoryOptions.districts.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        value={adminFormData.assignedDistrict}
                        onChange={e => setAdminFormData(prev => ({ ...prev, assignedDistrict: e.target.value }))}
                        placeholder="Enter District Name"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold"
                      />
                    )}
                  </div>
                )}

                {/* Division Selection if level >= division */}
                {['division', 'pincode'].includes(addAdminLevel) && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Division *</label>
                    <input
                      type="text"
                      required
                      value={adminFormData.assignedDivision}
                      onChange={e => setAdminFormData(prev => ({ ...prev, assignedDivision: e.target.value }))}
                      placeholder="e.g. Palacode Division"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-bold"
                    />
                  </div>
                )}

                {/* Pincode Selection if level === pincode */}
                {addAdminLevel === 'pincode' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Pincode (6-digit) *</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={adminFormData.assignedPincode}
                      onChange={e => setAdminFormData(prev => ({ ...prev, assignedPincode: e.target.value.replace(/\D/g, '') }))}
                      placeholder="e.g. 636808"
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-mono font-bold"
                    />
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Account Status</label>
                <select
                  value={adminFormData.status}
                  onChange={e => setAdminFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-semibold cursor-pointer"
                >
                  <option value="Active">Active (Permit Login immediately)</option>
                  <option value="Inactive">Inactive / Suspended</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddAdminModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Administrator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL: REQUEST MANAGER ONBOARDING */}
      {/* ========================================================= */}
      {showRequestManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-3xl p-6 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-850 dark:text-slate-100">
                  Request {managerRequestLevel.charAt(0).toUpperCase() + managerRequestLevel.slice(1)} Manager
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  Candidate request will be sent to Main Admin for formal review and approval.
                </p>
              </div>
              <button
                onClick={() => setShowRequestManagerModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRequestManagerSubmit} className="space-y-4 text-xs">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-700 dark:text-indigo-300 font-semibold flex items-center justify-between">
                <span>Territory Limit: Max {MANAGER_LIMITS[managerRequestLevel] || 2} Managers</span>
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-900">
                  {managerRequestLevel} Tier
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Candidate Name *</label>
                  <input
                    type="text"
                    required
                    value={managerFormData.name}
                    onChange={e => setManagerFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full legal name"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={managerFormData.email}
                    onChange={e => setManagerFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="candidate@example.com"
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
                    value={managerFormData.phone}
                    onChange={e => setManagerFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="10-digit mobile"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Alternate Mobile</label>
                  <input
                    type="tel"
                    value={managerFormData.altPhone}
                    onChange={e => setManagerFormData(prev => ({ ...prev, altPhone: e.target.value }))}
                    placeholder="Optional mobile"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 font-medium"
                  />
                </div>
              </div>

              {/* Territory Preview */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400">Territory Scope</span>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div><span className="text-slate-400 block text-[10px]">State:</span><strong>{managerFormData.assignedState || 'Tamil Nadu'}</strong></div>
                  {['district', 'division', 'pincode'].includes(managerRequestLevel) && (
                    <div><span className="text-slate-400 block text-[10px]">District:</span><strong>{managerFormData.assignedDistrict || 'Dharmapuri'}</strong></div>
                  )}
                  {['division', 'pincode'].includes(managerRequestLevel) && (
                    <div><span className="text-slate-400 block text-[10px]">Division:</span><strong>{managerFormData.assignedDivision || 'Palacode'}</strong></div>
                  )}
                  {managerRequestLevel === 'pincode' && (
                    <div><span className="text-slate-400 block text-[10px]">Pincode:</span><strong className="font-mono">{managerFormData.assignedPincode || '636808'}</strong></div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Notes / Qualification</label>
                <textarea
                  rows={2}
                  value={managerFormData.notes}
                  onChange={e => setManagerFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Operational experience, qualification details..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowRequestManagerModal(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Nomination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL: REJECT MANAGER REQUEST WITH REASON */}
      {/* ========================================================= */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-black text-slate-850 dark:text-slate-100">Reject Manager Request</h4>
            <p className="text-xs text-slate-400 font-medium">
              Specify reason for rejecting nomination of <strong>{rejectingRequest.name}</strong> ({rejectingRequest.level} manager).
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Territory manager limit reached, verification failed..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequest}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementModule;
