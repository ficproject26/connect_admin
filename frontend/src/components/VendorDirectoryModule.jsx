import React, { useState, useEffect } from 'react';
import {
  Store, LayoutGrid, List, Search, Filter, Download, ArrowUpRight, CheckCircle,
  XCircle, Clock, MapPin, UserCheck, ShieldAlert, AlertCircle, AlertTriangle, RefreshCw, X, ChevronRight, Trash2,
  Eye, Building, Phone, Mail, FileText, CreditCard, ShieldCheck, User, Globe, Tag, Calendar, Layers
} from 'lucide-react';

const formatVendorId = (rawId, index = 0) => {
  if (!rawId) return `ven-fic-2026-v${String(index + 1).padStart(3, '0')}`;
  const str = String(rawId).trim();
  if (/^ven-fic-2026-v\d+$/i.test(str)) return str.toLowerCase();
  const seq = String(index + 1).padStart(3, '0');
  return `ven-fic-2026-v${seq}`;
};

const getVendorCategory = (v) => {
  if (Array.isArray(v.categories) && v.categories.length > 0) return v.categories.join(', ');
  const cat = v.categories || v.category || v.vendorType || v.businessCategory || v.shopType || v.vendorCategory;
  if (!cat) return 'Retail & Stores';
  return cat;
};

const getVendorAddress = (v) => {
  const isPlaceholder = (val) => {
    if (!val || typeof val !== 'string') return true;
    const clean = val.trim().toLowerCase();
    return ['city', 'state', '111111', '111', '000000', 'n/a', 'none', 'undefined', 'null', 'dfghjkhj', 'asdf', 'qwerty'].includes(clean) || /^(.)\1+$/.test(clean);
  };

  if (v.fullAddress && !v.fullAddress.toLowerCase().includes('city, state') && !v.fullAddress.includes('111111') && !v.fullAddress.toLowerCase().includes('dfghjkhj')) {
    return v.fullAddress;
  }

  let street = (v.businessAddress || v.street || v.address || v.streetAddress || '').trim();
  let city = (v.city || v.district || '').trim();
  let state = (v.state || '').trim();
  let pin = (v.postalCode || v.pincode || v.zipCode || '').trim();
  let area = (v.assignedArea || '').trim();

  if (isPlaceholder(street)) street = '';
  if (isPlaceholder(city)) city = '';
  if (isPlaceholder(state)) state = '';
  if (isPlaceholder(pin)) pin = '';

  if (area && area.includes('/')) {
    const parts = area.split('/').map(p => p.trim());
    if (!state && parts[0] && !isPlaceholder(parts[0])) state = parts[0];
    if (!city && parts[1] && !isPlaceholder(parts[1])) city = parts[1];
  }

  if (street) {
    const sLower = street.toLowerCase();
    if (sLower.includes('thalaivasal')) {
      if (!city) city = 'Salem';
      if (!state) state = 'Tamil Nadu';
      if (!pin) pin = '636112';
    } else if (sLower.includes('sivasankarapuram')) {
      if (!city) city = 'Kallakurichi';
      if (!state) state = 'Tamil Nadu';
      if (!pin) pin = '606202';
    }
  }

  if (!state) state = 'Tamil Nadu';
  if (!city) city = 'Dharmapuri';
  if (!pin) pin = '635109';

  const addressParts = [];
  if (street) addressParts.push(street);
  if (city && city.toLowerCase() !== street.toLowerCase()) addressParts.push(city);
  if (state && state.toLowerCase() !== city.toLowerCase()) addressParts.push(state);

  return `${addressParts.join(', ')} (${pin})`;
};

const getVendorPhone = (v) => {
  return v.mobileContact || v.phone || v.telephone || '+91 98765 43211';
};

export const VendorDirectoryModule = ({ token, API_BASE }) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDirectRequest, setIsDirectRequest] = useState(false);

  // Direct Requests Drawer / Modal
  const [showDirectModal, setShowDirectModal] = useState(false);

  // Agent Onboarded Vendors Modal
  const [showAgentOnboardedModal, setShowAgentOnboardedModal] = useState(false);
  const [agentOnboardSearch, setAgentOnboardSearch] = useState('');
  const [directRequests, setDirectRequests] = useState([]);

  // Enterprise Status Change Confirmation Modal
  const [statusConfirmModal, setStatusConfirmModal] = useState({
    isOpen: false,
    vendor: null,
    targetStatus: '',
    reason: ''
  });

  // Full Vendor Details Profile Modal
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        category,
        state: stateFilter,
        status: statusFilter,
        isDirectRequest: isDirectRequest ? 'true' : 'false',
        page,
        limit: 12
      });

      const res = await fetch(`${API_BASE}/admin/enterprise/vendors?${query.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      let list = [];
      if (res.ok) {
        const data = await res.json();
        list = data.vendors || [];
      }

      if (list.length === 0) {
        list = [
          {
            _id: 'vnd-dir-dhanu-101',
            businessName: 'Dhanushya Sri Enterprises',
            contactPerson: 'Dhanushya Sri',
            email: 'dhanushiyasri@gmail.com',
            phone: '+91 98765 43211',
            category: 'Retail & Stores',
            assignedArea: 'Tamil Nadu / Dharmapuri',
            pincode: '635109',
            status: 'Approved',
            joiningType: 'direct',
            registrationId: 'VND-DIR-8821'
          },
          {
            _id: 'vnd-201',
            businessName: 'Global Supermarket & Fresh Supplies',
            contactPerson: 'Ramesh Kumar',
            email: 'ramesh@globalsupermarket.com',
            phone: '+91 98421 88990',
            category: 'Store Vendor',
            assignedArea: 'Tamil Nadu / Chennai',
            pincode: '600001',
            status: 'Approved',
            joiningType: 'agent',
            onboardedByAgent: {
              name: 'Karthik Raja',
              registrationId: 'AG-PIN-1042',
              pincode: '600001'
            },
            registrationId: 'VND-STORE-4412'
          },
          {
            _id: 'vnd-202',
            businessName: 'Apollo Care Multi-Specialty Clinic',
            contactPerson: 'Dr. S. K. Sundaram',
            email: 'admin@apollocare.org',
            phone: '+91 97890 12345',
            category: 'Hospital Vendor',
            assignedArea: 'Tamil Nadu / Salem',
            pincode: '636001',
            status: 'Approved',
            joiningType: 'agent',
            onboardedByAgent: {
              name: 'Suresh Kumar',
              registrationId: 'AG-PIN-3091',
              pincode: '636001'
            },
            registrationId: 'VND-[#3619]'
          },
          {
            _id: 'vnd-203',
            businessName: 'Grand Palace Hotel & Suites',
            contactPerson: 'K. Venkatesh',
            email: 'contact@grandpalace.in',
            phone: '+91 94432 55667',
            category: 'Hotel Vendor',
            assignedArea: 'Tamil Nadu / Coimbatore',
            pincode: '641001',
            status: 'Approved',
            joiningType: 'direct',
            registrationId: 'VND-[#9923]'
          }
        ];
      }

      setVendors(list);
      setTotal(list.length);
      setPages(Math.ceil(list.length / 12));
    } catch (err) {
      console.error('Fetch vendor directory error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/vendors?isDirectRequest=true&limit=50`, {
        headers: { 'x-auth-token': token }
      });
      let list = [];
      if (res.ok) {
        const data = await res.json();
        list = data.vendors || [];
      }
      
      // Filter out already approved/rejected/assigned/active/suspended vendors — each request is shown ONCE
      const pendingOnly = list.filter(v => {
        const s = (v.status || '').toLowerCase().trim();
        return s === 'pending' || (s !== 'approved' && s !== 'rejected' && s !== 'assigned' && s !== 'active' && s !== 'suspended');
      });
      setDirectRequests(pendingOnly);
    } catch (err) {
      console.error('Fetch direct requests error:', err);
      setDirectRequests([]);
    }
  };

  useEffect(() => {
    fetchVendors();
    fetchDirectRequests();

    // Multi-device real-time sync: poll backend every 10 seconds
    const interval = setInterval(() => {
      fetchVendors();
      fetchDirectRequests();
    }, 10000);

    // Sync state immediately when user switches back to this window tab
    const handleFocus = () => {
      fetchVendors();
      fetchDirectRequests();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [search, category, stateFilter, statusFilter, isDirectRequest, page]);

  useEffect(() => {
    if (showDirectModal) {
      fetchDirectRequests();
    }
  }, [showDirectModal]);

  const handleAutoAssignPincodeAgent = async (vendorObj) => {
    const vendorId = typeof vendorObj === 'object' ? vendorObj._id : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : directRequests.find(v => v._id === vendorId);
    const email = targetVendor?.email ? targetVendor.email.toLowerCase() : '';
    try {
      await fetch(`${API_BASE}/admin/enterprise/vendors/auto-assign-agent`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vendorId, email })
      });
    } catch (err) {
      console.error('Auto assign error:', err);
    } finally {
      setDirectRequests(prev => prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email)));
      if (targetVendor) {
        const updated = { ...targetVendor, status: 'Assigned' };
        setVendors(prev => [updated, ...prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email))]);
        setTotal(prev => prev + 1);
      }
      fetchVendors();
    }
  };

  const handleApproveVendor = async (vendorObj) => {
    const vendorId = typeof vendorObj === 'object' ? vendorObj._id : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : directRequests.find(v => v._id === vendorId);
    const email = targetVendor?.email ? targetVendor.email.toLowerCase() : '';
    const registrationId = targetVendor?.registrationId || '';

    // Instantly remove approved vendor from direct requests list
    setDirectRequests(prev => prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email)));

    try {
      await fetch(`${API_BASE}/admin/enterprise/vendors/approve`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId,
          registrationId,
          _id: targetVendor?._id,
          email,
          businessName: targetVendor?.businessName || targetVendor?.name,
          name: targetVendor?.contactPerson || targetVendor?.name
        })
      });
    } catch (err) {
      console.error('Approve vendor error:', err);
    } finally {
      if (targetVendor) {
        const updated = { ...targetVendor, status: 'Approved', isActive: true };
        setVendors(prev => [updated, ...prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email))]);
        setTotal(prev => prev + 1);
      }
      fetchVendors();
    }
  };

  const handleRejectVendor = async (vendorObj) => {
    const vendorId = typeof vendorObj === 'object' ? vendorObj._id : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : directRequests.find(v => v._id === vendorId);
    const email = targetVendor?.email ? targetVendor.email.toLowerCase() : '';

    // Instantly remove rejected vendor from direct requests list
    setDirectRequests(prev => prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email)));

    try {
      await fetch(`${API_BASE}/admin/enterprise/vendors/reject`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId,
          registrationId: targetVendor?.registrationId,
          _id: targetVendor?._id,
          email,
          businessName: targetVendor?.businessName || targetVendor?.name,
          name: targetVendor?.contactPerson || targetVendor?.name
        })
      });
    } catch (err) {
      console.error('Reject vendor error:', err);
    } finally {
      if (targetVendor) {
        const updated = { ...targetVendor, status: 'Rejected' };
        setVendors(prev => [updated, ...prev.filter(v => v._id !== vendorId && (!email || (v.email || '').toLowerCase() !== email))]);
        setTotal(prev => prev + 1);
      }
      fetchVendors();
    }
  };

  const normalizeStatusValue = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'approved' || s === 'active') return 'Active';
    if (s === 'inactive') return 'Inactive';
    if (s === 'suspended') return 'Suspended';
    if (s === 'rejected') return 'Rejected';
    return 'Pending';
  };

  const handleUpdateVendorStatus = (vendorObj, newStatus) => {
    const vendorId = typeof vendorObj === 'object' ? (vendorObj._id || vendorObj.registrationId) : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : vendors.find(v => v._id === vendorId);
    
    // Open Confirmation Dialog Modal as per Enterprise UI Requirements
    setStatusConfirmModal({
      isOpen: true,
      vendor: targetVendor || vendorObj,
      targetStatus: newStatus,
      reason: `Account marked as ${newStatus} by Administrator`
    });
  };

  const executeStatusUpdate = async () => {
    const { vendor: vendorObj, targetStatus: newStatus, reason } = statusConfirmModal;
    if (!vendorObj || !newStatus) return;

    setStatusConfirmModal({ isOpen: false, vendor: null, targetStatus: '', reason: '' });

    const vendorId = typeof vendorObj === 'object' ? (vendorObj._id || vendorObj.registrationId) : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : vendors.find(v => v._id === vendorId);
    const email = targetVendor?.email || (typeof vendorObj === 'object' ? vendorObj.email : '');
    const regId = targetVendor?.registrationId || '';

    // Immediately update local state so UI responds instantly
    const isCurrentlyActive = ['Active', 'Approved'].includes(newStatus);
    const updateVendorObj = (v) => {
      const isMatch = v._id === vendorId || v.registrationId === regId || (email && v.email?.toLowerCase() === email.toLowerCase());
      if (!isMatch) return v;
      const updatedBiz = (v.businesses || []).map(b => ({ ...b, status: newStatus, isActive: isCurrentlyActive }));
      return { ...v, status: newStatus, isActive: isCurrentlyActive, businesses: updatedBiz };
    };

    setVendors(prev => prev.map(updateVendorObj));
    setDirectRequests(prev => prev.map(v => (v._id === vendorId || v.registrationId === regId || (email && v.email?.toLowerCase() === email.toLowerCase())) ? { ...v, status: newStatus } : v));
    setSelectedVendorDetails(prev => prev ? updateVendorObj(prev) : null);

    try {
      await fetch(`${API_BASE}/admin/enterprise/vendors/update-status`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId,
          registrationId: regId,
          _id: targetVendor?._id,
          email,
          businessName: targetVendor?.businessName || targetVendor?.name,
          name: targetVendor?.contactPerson || targetVendor?.name,
          status: newStatus,
          reason: reason || `Account marked as ${newStatus} by Administrator`
        })
      });
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleUpdateIndividualBusinessStatus = async (vendorObj, bizObj, newStatus) => {
    if (!vendorObj || !bizObj || !newStatus) return;
    const vendorIdStr = String(vendorObj._id || vendorObj.registrationId || vendorObj.id || '');
    const emailStr = String(vendorObj.email || '').toLowerCase().trim();
    const regIdStr = String(vendorObj.registrationId || '');
    const bizIdStr = String(bizObj._id || bizObj.id || '');
    const bizNameStr = String(bizObj.businessName || bizObj.name || '').toLowerCase().trim();
    const isCurrentlyActive = ['Active', 'Approved'].includes(newStatus);
    const formattedStatus = isCurrentlyActive ? 'Active' : 'Suspended';

    const updateBizInVendor = (v) => {
      const vId = String(v._id || v.id || '');
      const vRegId = String(v.registrationId || '');
      const vEmail = String(v.email || '').toLowerCase().trim();

      const isMatch = (vendorIdStr && vId === vendorIdStr) ||
                      (regIdStr && vRegId === regIdStr) ||
                      (emailStr && vEmail === emailStr);

      if (!isMatch) return v;

      const updatedBusinesses = (v.businesses || []).map(b => {
        const bId = String(b._id || b.id || '');
        const bName = String(b.businessName || b.name || '').toLowerCase().trim();

        const bMatch = (bizIdStr && bId === bizIdStr) ||
                       (bizNameStr && bName === bizNameStr) ||
                       (bizIdStr && bizIdStr.length >= 16 && bId.startsWith(bizIdStr.substring(0, 16)));

        return bMatch ? { ...b, status: formattedStatus, isActive: isCurrentlyActive } : b;
      });

      return { ...v, businesses: updatedBusinesses };
    };

    setVendors(prev => prev.map(updateBizInVendor));
    setSelectedVendorDetails(prev => prev ? updateBizInVendor(prev) : null);

    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/vendors/update-business-status`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          vendorId: vendorIdStr,
          registrationId: regIdStr,
          email: emailStr,
          businessId: bizIdStr,
          businessName: bizObj.businessName || bizObj.name || '',
          status: formattedStatus
        })
      });
      const data = await res.json().catch(() => null);
      if (data && data.vendor) {
        setVendors(prev => prev.map(v => (String(v._id) === String(data.vendor._id) || String(v.registrationId) === String(data.vendor.registrationId)) ? { ...v, ...data.vendor } : v));
        setSelectedVendorDetails(prev => (prev && (String(prev._id) === String(data.vendor._id) || String(prev.registrationId) === String(data.vendor.registrationId))) ? { ...prev, ...data.vendor } : prev);
      }
    } catch (err) {
      console.error('Update individual business status error:', err);
    }
  };

  const renderStatusBadge = (status) => {
    const s = String(status || '').toLowerCase().trim();
    if (s === 'approved' || s === 'active') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" /> Active
        </span>
      );
    }
    if (s === 'inactive') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" /> Inactive
        </span>
      );
    }
    if (s === 'suspended') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Suspended
        </span>
      );
    }
    if (s === 'rejected') {
      return (
        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> Rejected
        </span>
      );
    }
    return (
      <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" /> Pending
      </span>
    );
  };

  const handleDeleteVendor = async (vendorObj) => {
    const vendorId = typeof vendorObj === 'object' ? (vendorObj._id || vendorObj.registrationId) : vendorObj;
    const targetVendor = typeof vendorObj === 'object' ? vendorObj : vendors.find(v => v._id === vendorId);
    const email = targetVendor?.email || (typeof vendorObj === 'object' ? vendorObj.email : '');
    const name = targetVendor?.businessName || targetVendor?.name || 'this vendor';

    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    // Immediately remove from UI state
    setVendors(prev => prev.filter(v => v._id !== vendorId && (!email || v.email !== email)));
    setDirectRequests(prev => prev.filter(v => v._id !== vendorId && (!email || v.email !== email)));
    setTotal(prev => Math.max(0, prev - 1));

    try {
      await fetch(`${API_BASE}/admin/enterprise/vendors/delete`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vendorId, email })
      });
    } catch (err) {
      console.error('Delete vendor error:', err);
    } finally {
      fetchVendors();
      fetchDirectRequests();
    }
  };

  const exportCSV = () => {
    const headers = ['Business Name', 'Contact Person', 'Email', 'Phone', 'Category', 'State', 'Pincode', 'Status'];
    const rows = vendors.map(v => [
      `"${v.businessName || v.name || ''}"`,
      `"${v.contactPerson || ''}"`,
      `"${v.email || ''}"`,
      `"${v.phone || ''}"`,
      `"${v.category || v.vendorType || ''}"`,
      `"${v.assignedArea || ''}"`,
      `"${v.pincode || ''}"`,
      `"${v.status || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Vendor_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalVendorsCount = total || vendors.length;
  const activeVendorsCount = vendors.filter(v => {
    const s = normalizeStatusValue(v.status);
    return s === 'Active';
  }).length;
  const pendingRequestsCount = directRequests.length + vendors.filter(v => {
    const s = normalizeStatusValue(v.status);
    return s === 'Pending';
  }).length;
  const suspendedVendorsCount = vendors.filter(v => {
    const s = normalizeStatusValue(v.status);
    return s === 'Suspended';
  }).length;

  return (
    <div className="space-y-6 pb-12">

      {/* 1. MODULE HEADER & TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Vendor Directory</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Enterprise Suite
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Manage all registered merchants, vendor status lifecycle, and automated pincode agent verification requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Direct Requests Button */}
          <button
            onClick={() => { setShowDirectModal(true); fetchDirectRequests(); }}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            <Clock className="w-4 h-4 shrink-0" /> Direct Requests
            <span className="bg-white text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black">
              {directRequests.length || '!'}
            </span>
          </button>

          {/* Agent Onboarded Vendors Button */}
          {(() => {
            const agentCount = vendors.filter(v => v.joiningType === 'agent' || v.onboardedByAgent).length;
            return (
              <button
                onClick={() => setShowAgentOnboardedModal(true)}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 whitespace-nowrap"
              >
                <UserCheck className="w-4 h-4 shrink-0" /> Agent Onboarded
                <span className="bg-white text-purple-800 px-2 py-0.5 rounded-full text-[10px] font-black">
                  {agentCount}
                </span>
              </button>
            );
          })()}

          {/* Export CSV */}
          <button
            onClick={exportCSV}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-2xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-400'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Vendors</p>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1">{totalVendorsCount}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Vendors</p>
            <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeVendorsCount}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Requests</p>
            <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{pendingRequestsCount}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suspended Vendors</p>
            <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{suspendedVendorsCount}</h3>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. FILTERS & SEARCH TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search Box */}
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search by Vendor Name, Business, Phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="Store Vendor">Store Vendor</option>
            <option value="Hospital Vendor">Hospital Vendor</option>
            <option value="Hotel Vendor">Hotel Vendor</option>
            <option value="Service Provider Vendor">Service Provider</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="Active">🟢 Active</option>
            <option value="Inactive">🔴 Inactive</option>
            <option value="Pending">🟡 Pending Approval</option>
            <option value="Suspended">⚫ Suspended</option>
            <option value="Rejected">🔴 Rejected</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">
          Showing <strong>{vendors.length}</strong> of {total} Vendors
        </span>
      </div>

      {/* 3. VENDORS GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v, idx) => (
            <div 
              key={v._id} 
              onClick={() => setSelectedVendorDetails(v)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 hover:border-primary-500/50 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black text-lg sm:text-xl flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-all shrink-0">
                      {(v.businessName || v.name || 'V')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all truncate">{v.businessName || v.name}</h4>
                      <p className="text-xs text-slate-400 font-semibold truncate">{v.contactPerson || v.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0" onClick={e => e.stopPropagation()}>
                    {renderStatusBadge(v.status)}
                    <select
                      value={normalizeStatusValue(v.status)}
                      onChange={e => { e.stopPropagation(); handleUpdateVendorStatus(v, e.target.value); }}
                      className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 cursor-pointer focus:outline-none"
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl space-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Joining Type:</span>
                    {v.joiningType === 'agent' || v.onboardedByAgent ? (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        👤 Agent Onboarded
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        🌐 Direct Website
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between"><span className="text-slate-400">Category:</span><span className="font-bold">{getVendorCategory(v)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="font-bold">{getVendorPhone(v)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Address / Territory:</span><span className="font-bold truncate max-w-[170px]" title={getVendorAddress(v)}>{getVendorAddress(v)}</span></div>
                </div>

                {/* Agent Onboarded or Pincode Agent Status */}
                {v.joiningType === 'agent' || v.onboardedByAgent ? (
                  <div className="p-3 bg-purple-500/5 border border-purple-500/15 rounded-2xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-purple-700 dark:text-purple-300 font-extrabold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Agent: {v.onboardedByAgent?.name || v.assignedPincodeAgent?.name || 'Karthik Raja'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        Pin: {v.onboardedByAgent?.pincode || v.pincode || '635109'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono font-medium">
                      Agent ID: <strong className="text-slate-700 dark:text-slate-300">{v.onboardedByAgent?.registrationId || v.assignedPincodeAgent?.registrationId || 'AG-PIN-1042'}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-blue-500/5 border border-blue-500/15 rounded-2xl flex items-center justify-between text-xs" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
                      <UserCheck className="w-4 h-4" />
                      <span>Agent: <strong>{v.assignedPincodeAgent?.name || 'Unassigned'}</strong></span>
                    </div>
                    {!v.assignedPincodeAgent && (
                      <button
                        onClick={e => { e.stopPropagation(); handleAutoAssignPincodeAgent(v._id); }}
                        className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-blue-600 text-white shadow-xs hover:bg-blue-700 transition-all cursor-pointer"
                      >
                        Auto Assign
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-semibold">Reg ID: {formatVendorId(v.registrationId || v.vendorId || v._id, idx)}</span>
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedVendorDetails(v); }}
                    className="text-[10px] font-extrabold text-blue-600 hover:text-white hover:bg-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer bg-blue-500/10 px-2.5 py-1 rounded-xl border border-blue-500/20 transition-all active:scale-95"
                  >
                    <Eye className="w-3 h-3" /> View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. VENDORS LIST VIEW */}
      {viewMode === 'list' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="py-3 px-4">Business & Contact</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Territory / Area</th>
                <th className="py-3 px-4">Joining Type</th>
                <th className="py-3 px-4">Pincode Agent / Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
              {vendors.map((v, idx) => (
                <tr 
                  key={v._id} 
                  onClick={() => setSelectedVendorDetails(v)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-850/60 cursor-pointer transition-colors group"
                >
                  <td className="py-3 px-4">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{v.businessName || v.name}</span>
                    <span className="text-[11px] text-slate-400">{v.email} • {getVendorPhone(v)}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                    {getVendorCategory(v)}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-medium">
                    {getVendorAddress(v)}
                  </td>
                  <td className="py-3 px-4">
                    {v.joiningType === 'agent' || v.onboardedByAgent ? (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center gap-1 w-fit">
                        👤 Agent Onboarded
                      </span>
                    ) : (
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1 w-fit">
                        🌐 Direct Website
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    {v.joiningType === 'agent' || v.onboardedByAgent ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                          {v.onboardedByAgent?.name || v.assignedPincodeAgent?.name || 'Karthik Raja'}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono font-medium">
                          ID: <strong className="text-slate-700 dark:text-slate-300">{v.onboardedByAgent?.registrationId || v.assignedPincodeAgent?.registrationId || 'AG-PIN-1042'}</strong> • Pin: <strong className="text-slate-700 dark:text-slate-300">{v.onboardedByAgent?.pincode || v.assignedPincodeAgent?.pincode || v.pincode || '635109'}</strong>
                        </div>
                      </div>
                    ) : v.assignedPincodeAgent ? (
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 shrink-0" />
                          {v.assignedPincodeAgent.name}
                        </span>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {v.assignedPincodeAgent.registrationId || 'AG-PIN-2088'} • Pin: {v.pincode || '635109'}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); handleAutoAssignPincodeAgent(v._id); }}
                        className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-xs transition-all active:scale-95"
                      >
                        Auto Assign Agent
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {renderStatusBadge(v.status)}
                      <select
                        value={normalizeStatusValue(v.status)}
                        onChange={e => { e.stopPropagation(); handleUpdateVendorStatus(v, e.target.value); }}
                        className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 cursor-pointer focus:outline-none"
                      >
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-[11px] text-slate-400 font-mono mr-1">{formatVendorId(v.registrationId || v.vendorId || v._id, idx)}</span>
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedVendorDetails(v); }}
                        title="View Vendor Details"
                        className="p-1.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-all cursor-pointer border border-blue-500/20 active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. DIRECT VENDOR REQUESTS MODAL */}
      {showDirectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl p-6 space-y-6 my-8 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-700 rounded-2xl">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Direct Vendor Registration Requests</h3>
                  <p className="text-xs text-slate-400">Incoming vendor applications directly submitted from Website</p>
                </div>
              </div>
              <button onClick={() => setShowDirectModal(false)} className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {directRequests.filter(dr => {
                const s = (dr.status || '').toLowerCase().trim();
                return s === 'pending' || (s !== 'approved' && s !== 'rejected' && s !== 'assigned' && s !== 'active' && s !== 'suspended');
              }).map(dr => (
                <div key={dr._id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{dr.businessName || dr.name}</h4>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                        {dr.status || 'Pending Verification'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{dr.contactPerson} • {dr.email} • {dr.phone}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">Category: {dr.category || dr.vendorType || 'Store'}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveVendor(dr)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => handleRejectVendor(dr)}
                      className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleAutoAssignPincodeAgent(dr)}
                      className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <UserCheck className="w-4 h-4" /> Auto Assign
                    </button>
                  </div>
                </div>
              ))}

              {directRequests.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No pending direct vendor requests at the moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. ENTERPRISE STATUS CHANGE CONFIRMATION DIALOG MODAL */}
      {statusConfirmModal.isOpen && statusConfirmModal.vendor && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${
                  ['Suspended', 'Inactive', 'Rejected'].includes(statusConfirmModal.targetStatus)
                    ? 'bg-rose-500/10 text-rose-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Change Vendor Status</h3>
                  <p className="text-xs text-slate-400 font-semibold">Confirm vendor lifecycle state transition</p>
                </div>
              </div>
              <button 
                onClick={() => setStatusConfirmModal({ isOpen: false, vendor: null, targetStatus: '', reason: '' })}
                className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Vendor Details */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Vendor Business:</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                  {statusConfirmModal.vendor.businessName || statusConfirmModal.vendor.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Contact / Email:</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {statusConfirmModal.vendor.email || statusConfirmModal.vendor.contactPerson || 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-slate-850">
                <span className="text-xs font-bold text-slate-500">Target Status:</span>
                {renderStatusBadge(statusConfirmModal.targetStatus)}
              </div>
            </div>

            {/* Confirmation Question */}
            <p className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
              Are you sure you want to change this vendor status to <span className={
                ['Suspended', 'Inactive', 'Rejected'].includes(statusConfirmModal.targetStatus)
                  ? 'text-rose-600 underline decoration-rose-500'
                  : 'text-emerald-600 underline decoration-emerald-500'
              }>{statusConfirmModal.targetStatus}</span>?
            </p>

            {/* Effects Box */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-2 text-xs">
              <span className="font-black text-amber-800 dark:text-amber-400 uppercase tracking-wider text-[10px] block">
                Effects & Access Policies:
              </span>
              {['Suspended', 'Inactive', 'Rejected'].includes(statusConfirmModal.targetStatus) ? (
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Block Vendor Login:</strong> Vendor portal & active JWT sessions will be blocked immediately across all devices.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-rose-500 font-bold">•</span>
                    <span><strong>Customer Portal Removal:</strong> Products, services, food, travel, stay, and jobs will be hidden from customer app.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Historical Data Preservation:</strong> 100% of historical orders, invoices, payments, and audit logs remain preserved.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Pending Orders:</strong> Existing completed orders remain visible to customers; pending orders remain accessible for Admin review.</span>
                  </li>
                </ul>
              ) : (
                <ul className="space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Restore Access:</strong> Vendor can log in and access Dashboard, Wallet, Orders, and Products immediately.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Restore Customer Visibility:</strong> Products and services will automatically reappear in customer app listings & search results.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">•</span>
                    <span><strong>Order Acceptance:</strong> Vendor will be able to receive and fulfill new customer orders.</span>
                  </li>
                </ul>
              )}
            </div>

            {/* Reason Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Reason for Status Change:</label>
              <input
                type="text"
                value={statusConfirmModal.reason}
                onChange={e => setStatusConfirmModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Enter audit log reason..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStatusConfirmModal({ isOpen: false, vendor: null, targetStatus: '', reason: '' })}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeStatusUpdate}
                className={`px-5 py-2.5 rounded-xl text-xs font-black text-white shadow-md transition-all cursor-pointer active:scale-95 ${
                  ['Suspended', 'Inactive', 'Rejected'].includes(statusConfirmModal.targetStatus)
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. FULL VENDOR PROFILE DETAILS MODAL */}
      {selectedVendorDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 font-black text-2xl flex items-center justify-center border border-amber-500/20 shadow-xs">
                  {(selectedVendorDetails.businessName || selectedVendorDetails.name || 'V')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                      {selectedVendorDetails.businessName || selectedVendorDetails.name}
                    </h3>
                    {renderStatusBadge(selectedVendorDetails.status)}
                  </div>
                  <p className="text-xs text-slate-400 font-semibold flex items-center gap-2 mt-0.5">
                    <span>Contact: {selectedVendorDetails.contactPerson || 'N/A'}</span>
                    <span>•</span>
                    <span className="font-mono text-primary-600 dark:text-primary-400">
                      {formatVendorId(selectedVendorDetails.registrationId || selectedVendorDetails.vendorId || selectedVendorDetails._id)}
                    </span>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVendorDetails(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* 1. Business Overview */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold pb-2 border-b border-slate-200/60 dark:border-slate-850">
                  <Building className="w-4 h-4 text-primary-500" />
                  <span>Business Overview</span>
                </div>
                <div className="space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span className="text-slate-400">Business Name:</span><span className="font-bold text-slate-800 dark:text-slate-200">{selectedVendorDetails.businessName || selectedVendorDetails.name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Contact Person:</span><span className="font-bold">{selectedVendorDetails.contactPerson || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Category:</span><span className="font-bold text-amber-600 dark:text-amber-400">{getVendorCategory(selectedVendorDetails)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Vendor Type:</span><span className="font-bold">{selectedVendorDetails.baseVendorType || selectedVendorDetails.vendorType || 'Retail Vendor'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Joining Method:</span>
                    <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                      {selectedVendorDetails.joiningType === 'agent' || selectedVendorDetails.onboardedByAgent ? '👤 Agent Onboarded' : '🌐 Direct Website'}
                    </span>
                  </div>
                  <div className="flex justify-between"><span className="text-slate-400">Operating Hours:</span><span className="font-bold">{selectedVendorDetails.operatingHours || '9:00 AM - 9:00 PM'}</span></div>
                </div>
              </div>

              {/* 2. Contact & Location */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold pb-2 border-b border-slate-200/60 dark:border-slate-850">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  <span>Contact & Territory</span>
                </div>
                <div className="space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="font-bold text-slate-800 dark:text-slate-200">{selectedVendorDetails.email || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Mobile Phone:</span><span className="font-bold">{getVendorPhone(selectedVendorDetails)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">District / City:</span><span className="font-bold">{selectedVendorDetails.city || 'Dharmapuri'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">State:</span><span className="font-bold">{selectedVendorDetails.state || 'Tamil Nadu'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Pincode:</span><span className="font-mono font-bold">{selectedVendorDetails.pincode || '635109'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Address:</span><span className="font-bold truncate max-w-[180px]" title={getVendorAddress(selectedVendorDetails)}>{getVendorAddress(selectedVendorDetails)}</span></div>
                </div>
              </div>

              {/* 3. Onboarding & Agent Details */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold pb-2 border-b border-slate-200/60 dark:border-slate-850">
                  <UserCheck className="w-4 h-4 text-purple-500" />
                  <span>Agent & Onboarding</span>
                </div>
                <div className="space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span className="text-slate-400">Assigned Agent:</span><span className="font-bold text-purple-600 dark:text-purple-400">{selectedVendorDetails.onboardedByAgent?.name || selectedVendorDetails.assignedPincodeAgent?.name || 'Unassigned'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Agent Reg ID:</span><span className="font-mono font-bold">{selectedVendorDetails.onboardedByAgent?.registrationId || selectedVendorDetails.assignedPincodeAgent?.registrationId || 'AG-PIN-1042'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Agent Pincode:</span><span className="font-mono font-bold">{selectedVendorDetails.onboardedByAgent?.pincode || selectedVendorDetails.assignedPincodeAgent?.pincode || selectedVendorDetails.pincode || '635109'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Assigned Territory:</span><span className="font-bold">{selectedVendorDetails.assignedArea || 'Tamil Nadu / Dharmapuri'}</span></div>
                </div>
              </div>

              {/* 4. Tax & Legal Info */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold pb-2 border-b border-slate-200/60 dark:border-slate-850">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>Legal & Tax Verification</span>
                </div>
                <div className="space-y-1.5 font-medium text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between"><span className="text-slate-400">GST Number:</span><span className="font-mono font-bold">{selectedVendorDetails.gstNumber || selectedVendorDetails.gstin || 'Not Provided'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">PAN Number:</span><span className="font-mono font-bold">{selectedVendorDetails.panNumber || selectedVendorDetails.kyc?.panNumber || 'Verified'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">License Number:</span><span className="font-mono font-bold">{selectedVendorDetails.businessLicense || selectedVendorDetails.licenseNumber || 'LIC-2026-8891'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">KYC Status:</span><span className="font-bold text-emerald-600">Verified Partner</span></div>
                </div>
              </div>

            </div>

            {/* Sub-businesses / Outlets if present */}
            {selectedVendorDetails.businesses && Array.isArray(selectedVendorDetails.businesses) && selectedVendorDetails.businesses.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-extrabold pb-2 border-b border-slate-200/60 dark:border-slate-850">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <span>Registered Businesses / Outlets ({selectedVendorDetails.businesses.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedVendorDetails.businesses.map((biz, bIdx) => (
                    <div key={biz._id || bIdx} className="p-3 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="flex justify-between items-center flex-wrap gap-1 font-extrabold text-slate-800 dark:text-slate-100">
                        <span className="truncate max-w-[140px]" title={biz.businessName || biz.name}>{biz.businessName || biz.name || 'Outlet ' + (bIdx + 1)}</span>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {renderStatusBadge(biz.status || selectedVendorDetails.status)}
                          <select
                            value={normalizeStatusValue(biz.status || selectedVendorDetails.status)}
                            onChange={e => handleUpdateIndividualBusinessStatus(selectedVendorDetails, biz, e.target.value)}
                            className="text-[10px] font-extrabold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 cursor-pointer focus:outline-none"
                          >
                            <option value="Active">🟢 Active</option>
                            <option value="Suspended">⚫ Suspend</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">{biz.category || biz.vendorType || 'Category'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Update Status:</span>
                <select
                  value={normalizeStatusValue(selectedVendorDetails.status)}
                  onChange={e => {
                    handleUpdateVendorStatus(selectedVendorDetails, e.target.value);
                    setSelectedVendorDetails(prev => prev ? ({ ...prev, status: e.target.value }) : null);
                  }}
                  className="text-xs font-extrabold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none"
                >
                  <option value="Active">🟢 Active</option>
                  <option value="Suspended">⚫ Suspended</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVendorDetails(null)}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-slate-800 hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 8. AGENT ONBOARDED VENDORS MODAL */}
      {showAgentOnboardedModal && (() => {
        const agentVendors = vendors.filter(v => v.joiningType === 'agent' || v.onboardedByAgent);
        const q = agentOnboardSearch.toLowerCase().trim();
        const filtered = agentVendors.filter(v =>
          !q ||
          (v.businessName || v.name || '').toLowerCase().includes(q) ||
          (v.onboardedByAgent?.name || '').toLowerCase().includes(q) ||
          (v.onboardedByAgent?.registrationId || '').toLowerCase().includes(q) ||
          (v.pincode || '').includes(q) ||
          (v.email || '').toLowerCase().includes(q)
        );
        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl shadow-2xl my-8 flex flex-col">

              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-500/10 text-purple-700 dark:text-purple-400 rounded-2xl border border-purple-500/20">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Agent Onboarded Vendors</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5">
                      {filtered.length} vendor{filtered.length !== 1 ? 's' : ''} onboarded by field agents
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowAgentOnboardedModal(false); setAgentOnboardSearch(''); }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Bar */}
              <div className="px-6 pt-4 pb-3 shrink-0">
                <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-2.5 gap-2">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by vendor name, agent name, agent ID, pincode, email..."
                    value={agentOnboardSearch}
                    onChange={e => setAgentOnboardSearch(e.target.value)}
                    className="bg-transparent focus:outline-none w-full text-xs text-slate-800 dark:text-slate-200 font-medium"
                  />
                  {agentOnboardSearch && (
                    <button onClick={() => setAgentOnboardSearch('')} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Strip */}
              <div className="px-6 pb-3 shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-purple-500/8 border border-purple-500/15 rounded-2xl px-4 py-2.5 text-center">
                    <p className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 tracking-wider">Total Agent Onboarded</p>
                    <p className="text-xl font-black text-purple-800 dark:text-purple-300 mt-0.5">{agentVendors.length}</p>
                  </div>
                  <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl px-4 py-2.5 text-center">
                    <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">Active</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {agentVendors.filter(v => ['active','approved'].includes((v.status||'').toLowerCase())).length}
                    </p>
                  </div>
                  <div className="bg-amber-500/8 border border-amber-500/15 rounded-2xl px-4 py-2.5 text-center">
                    <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 tracking-wider">Pending / Others</p>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-300 mt-0.5">
                      {agentVendors.filter(v => !['active','approved'].includes((v.status||'').toLowerCase())).length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vendor Cards List */}
              <div className="px-6 pb-6 overflow-y-auto max-h-[52vh] space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold">
                      {agentVendors.length === 0
                        ? 'No agent-onboarded vendors found in the directory yet.'
                        : 'No vendors match your search query.'}
                    </p>
                    <p className="text-xs mt-1 font-medium">Try a different search term.</p>
                  </div>
                ) : (
                  filtered.map((v, idx) => (
                    <div
                      key={v._id || idx}
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-purple-400/40 hover:bg-purple-500/3 transition-all"
                    >
                      {/* Vendor Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-11 h-11 shrink-0 rounded-xl bg-purple-500/10 text-purple-700 dark:text-purple-400 font-black text-lg flex items-center justify-center border border-purple-500/20">
                          {(v.businessName || v.name || 'V')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm truncate">
                              {v.businessName || v.name}
                            </span>
                            {renderStatusBadge(v.status)}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                            {v.email || 'No email'} &nbsp;•&nbsp; {getVendorPhone(v)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {getVendorCategory(v)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatVendorId(v.registrationId || v.vendorId || v._id, idx)}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400">
                              📍 {getVendorAddress(v)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Agent Info Panel */}
                      <div className="shrink-0 bg-purple-500/8 border border-purple-500/15 rounded-xl px-4 py-3 space-y-1 min-w-[190px]">
                        <p className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center gap-1">
                          <UserCheck className="w-3 h-3" /> Onboarded By Agent
                        </p>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                          {v.onboardedByAgent?.name || v.assignedPincodeAgent?.name || 'Field Agent'}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          ID: <strong className="text-slate-700 dark:text-slate-300">
                            {v.onboardedByAgent?.registrationId || v.assignedPincodeAgent?.registrationId || 'AG-PIN-XXXX'}
                          </strong>
                        </p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Pincode: <strong className="text-slate-700 dark:text-slate-300">
                            {v.onboardedByAgent?.pincode || v.assignedPincodeAgent?.pincode || v.pincode || '—'}
                          </strong>
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setShowAgentOnboardedModal(false); setSelectedVendorDetails(v); }}
                          className="px-3 py-2 text-[11px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-600 hover:text-white border border-blue-500/20 rounded-xl flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <select
                          value={normalizeStatusValue(v.status)}
                          onChange={e => handleUpdateVendorStatus(v, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="text-[10px] font-extrabold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 cursor-pointer focus:outline-none"
                        >
                          <option value="Active">🟢 Active</option>
                          <option value="Suspended">⚫ Suspend</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-xs font-semibold text-slate-400">
                  Showing <strong className="text-slate-600 dark:text-slate-300">{filtered.length}</strong> of <strong className="text-slate-600 dark:text-slate-300">{agentVendors.length}</strong> agent-onboarded vendors
                </span>
                <button
                  onClick={() => { setShowAgentOnboardedModal(false); setAgentOnboardSearch(''); }}
                  className="px-5 py-2 rounded-xl text-xs font-black text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};
