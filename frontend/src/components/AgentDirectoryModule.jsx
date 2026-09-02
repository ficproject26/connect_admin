// Module-level in-memory cache for instant zero-latency rendering across tab navigation
let MEMORY_AGENT_CACHE = null;

const getCachedAgents = () => {
  if (Array.isArray(MEMORY_AGENT_CACHE) && MEMORY_AGENT_CACHE.length > 0) {
    return MEMORY_AGENT_CACHE;
  }
  try {
    const raw = sessionStorage.getItem('connect_agent_directory_cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        MEMORY_AGENT_CACHE = parsed;
        return parsed;
      }
    }
  } catch (e) {}
  return [];
};

const setCachedAgents = (list) => {
  if (Array.isArray(list) && list.length > 0) {
    MEMORY_AGENT_CACHE = list;
    try {
      sessionStorage.setItem('connect_agent_directory_cache', JSON.stringify(list));
    } catch (e) {}
  }
};

export default function AgentDirectoryModule({ 
  token, 
  API_BASE, 
  initialAgents = [],
  onAgentsUpdated,
  onOpenOnboardingModal, 
  onOpenAddAgentModal 
}) {
  // Stale-While-Revalidate: Instant initialization from parent or module cache
  const cachedInitial = useMemo(() => {
    if (Array.isArray(initialAgents) && initialAgents.length > 0) return initialAgents;
    return getCachedAgents();
  }, [initialAgents]);

  const [agents, setAgents] = useState(() => cachedInitial);
  const [loading, setLoading] = useState(() => cachedInitial.length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [bgNotice, setBgNotice] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [agentLevelFilter, setAgentLevelFilter] = useState('all');
  const [agentViewMode, setAgentViewMode] = useState('tree'); // 'tree' | 'list' | 'grid'
  const [expandedNodes, setExpandedNodes] = useState({});
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const inFlightPromiseRef = useRef(null);

  // Synchronize when initialAgents updates from parent
  useEffect(() => {
    if (Array.isArray(initialAgents) && initialAgents.length > 0) {
      setAgents(initialAgents);
      setCachedAgents(initialAgents);
      setLoading(false);
    }
  }, [initialAgents]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Fast & reliable fetch helper (Primary relative proxy FIRST with 12s timeout)
  const safeFetchAgents = useCallback(async () => {
    if (!token) return null;
    const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
    
    const primaryUrl = `${API_BASE}/admin/agents`.replace(/\/+/g, '/').replace(':/', '://');
    const urls = [
      '/api/admin/agents',
      primaryUrl,
      'https://connect-admin-qlcy.onrender.com/api/admin/agents'
    ];

    const uniqueUrls = [...new Set(urls.filter(Boolean))];
    for (const url of uniqueUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data !== null && data !== undefined) return data;
          }
        }
      } catch (e) {
        // Try fallback endpoint
      }
    }
    return null;
  }, [token, API_BASE]);

  // Normalize Agent Data Record
  const normalizeAgentList = useCallback((data) => {
    if (!data) return [];
    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.agents)) {
      list = data.agents;
    } else if (data && Array.isArray(data.data)) {
      list = data.data;
    }

    const seen = new Set();
    const normalized = list.map(item => {
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
      else if (rawLvlStr.includes('pincode') || rawLvlStr.includes('pin')) resolvedLvl = 'pincode';

      return {
        ...ag,
        _id: ag._id || item._id,
        name: ag.name || item.name || ag.fullName || 'Agent Partner',
        email: ag.email || item.email || '',
        phone: ag.phone || item.phone || ag.mobile || '',
        role: ag.role || item.role || 'agent',
        level: resolvedLvl,
        status: rawStatus,
        kycStatus: rawKycStatus,
        registrationId: ag.registrationId || ag.id || (ag._id ? `REG-${String(ag._id).substring(18, 24).toUpperCase()}` : 'REG-N/A'),
        assignedState: ag.assignedState || ag.state || ag.territory?.state || '',
        assignedDistrict: ag.assignedDistrict || ag.district || ag.territory?.district || '',
        assignedDivision: ag.assignedDivision || ag.division || ag.territory?.division || '',
        assignedPincode: ag.assignedPincode || ag.pincode || ag.territory?.pincode || '',
        assignedArea: ag.assignedArea || (ag.territory ? Object.values(ag.territory).filter(Boolean).join(' / ') : ''),
        territory: ag.territory || {},
        balance: ag.balance !== undefined ? ag.balance : (metrics.revenue || 0),
        commissionEarned: ag.commissionEarned !== undefined ? ag.commissionEarned : (metrics.commission || 0),
        createdAt: ag.createdAt || ag.created_at || new Date().toISOString()
      };
    }).filter(Boolean);

    // Deduplicate by Primary Key (_id, registrationId, or email)
    return normalized.filter(ag => {
      const idStr = (ag._id || '').toString().toLowerCase().trim();
      const regId = (ag.registrationId || ag.id || '').toString().toLowerCase().trim();
      const email = (ag.email || '').toLowerCase().trim();

      let primaryKey = null;
      if (idStr) primaryKey = `id_${idStr}`;
      else if (regId && regId !== 'undefined' && regId !== 'null') primaryKey = `reg_${regId}`;
      else if (email && email !== 'undefined' && email !== 'null') primaryKey = `email_${email}`;

      if (!primaryKey || seen.has(primaryKey)) return false;
      seen.add(primaryKey);
      return true;
    });
  }, []);

  // Primary Data Fetcher with Request Deduplication & Stale-While-Revalidate Caching
  const loadAgentData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (agents.length === 0 && getCachedAgents().length === 0) setLoading(true);

    setError(null);
    setBgNotice(null);

    // Reuse in-flight request to eliminate duplicate API requests
    if (inFlightPromiseRef.current) {
      try {
        const data = await inFlightPromiseRef.current;
        if (data) {
          const parsedAgents = normalizeAgentList(data);
          if (parsedAgents.length > 0) {
            setAgents(parsedAgents);
            setCachedAgents(parsedAgents);
            if (typeof onAgentsUpdated === 'function') onAgentsUpdated(parsedAgents);
            setError(null);
          }
        }
      } catch (e) {}
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const fetchPromise = safeFetchAgents();
      inFlightPromiseRef.current = fetchPromise;
      const data = await fetchPromise;
      inFlightPromiseRef.current = null;

      if (data !== null && data !== undefined) {
        const parsedAgents = normalizeAgentList(data);
        setAgents(parsedAgents);
        setCachedAgents(parsedAgents);
        if (typeof onAgentsUpdated === 'function') onAgentsUpdated(parsedAgents);
        setError(null);
        setBgNotice(null);
      } else {
        if (agents.length === 0 && getCachedAgents().length === 0) {
          setError('Unable to load Agent Directory. Please check server connection.');
        } else {
          setBgNotice('Unable to refresh latest server data. Showing cached directory.');
        }
      }
    } catch (err) {
      inFlightPromiseRef.current = null;
      if (agents.length === 0 && getCachedAgents().length === 0) {
        setError('Network error fetching agent network.');
      } else {
        setBgNotice('Network connection timed out. Showing cached directory.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [safeFetchAgents, normalizeAgentList, agents.length, onAgentsUpdated]);

  useEffect(() => {
    loadAgentData(false);
  }, [loadAgentData]);

  // Helper Filters
  const isApprovedAgent = (agent) => {
    if (!agent) return false;
    const status = (agent.status || '').toLowerCase().trim();
    const kycStatus = (agent.kycStatus || '').toLowerCase().trim();
    return !['rejected', 'suspended', 'deactivated', 'blocked'].includes(status) &&
           !['rejected', 'suspended', 'deactivated', 'blocked'].includes(kycStatus);
  };

  const isPendingAgent = (agent) => {
    if (!agent) return false;
    const status = (agent.status || '').toLowerCase().trim();
    const kycStatus = (agent.kycStatus || '').toLowerCase().trim();
    return ['pending', 'pending_approval', 'under_verification', 'requested'].includes(status) ||
           ['pending', 'under_verification'].includes(kycStatus);
  };

  const extractAgentTerritory = (ag) => {
    let state = (ag.assignedState || ag.territory?.state || '').trim();
    let district = (ag.assignedDistrict || ag.territory?.district || '').trim();
    let division = (ag.assignedDivision || ag.territory?.division || '').trim();
    let pincode = (ag.assignedPincode?.code || ag.assignedPincode || ag.territory?.pincode || '').trim();

    if (ag.assignedArea && typeof ag.assignedArea === 'string') {
      const parts = ag.assignedArea.split('/').map(s => s.trim()).filter(Boolean);
      if (!state && parts[0]) state = parts[0];
      if (!district && parts[1]) district = parts[1];
      if (!division && parts[2]) division = parts[2];
      if (!pincode && parts[3] && /^\d{6}$/.test(parts[3])) pincode = parts[3];
    }

    return {
      state: state || 'General State',
      district: district || 'General District',
      division: division || 'General Division',
      pincode: pincode || 'N/A'
    };
  };

  // Counts Calculation
  const approvedAgents = agents.filter(isApprovedAgent);
  const pendingCount = agents.filter(isPendingAgent).length;

  const counts = {
    total: approvedAgents.length,
    state: approvedAgents.filter(a => a.level === 'state').length,
    district: approvedAgents.filter(a => a.level === 'district').length,
    division: approvedAgents.filter(a => a.level === 'division').length,
    pincode: approvedAgents.filter(a => a.level === 'pincode').length,
    rejected: agents.filter(a => (a.status || '').toLowerCase() === 'rejected').length
  };

  // Filtered Agent List
  const filteredAgents = agents.filter(a => {
    if (!a) return false;
    const query = debouncedSearch.toLowerCase().trim();
    const terr = extractAgentTerritory(a);
    const matchesSearch = !query ||
      (a.name || '').toLowerCase().includes(query) ||
      (a.email || '').toLowerCase().includes(query) ||
      (a.phone && a.phone.includes(query)) ||
      (a.registrationId && a.registrationId.toLowerCase().includes(query)) ||
      terr.state.toLowerCase().includes(query) ||
      terr.district.toLowerCase().includes(query) ||
      terr.division.toLowerCase().includes(query) ||
      terr.pincode.includes(query);

    const aStatus = (a.status || '').toLowerCase();
    if (agentLevelFilter === 'rejected') {
      return matchesSearch && aStatus === 'rejected';
    } else {
      if (!isApprovedAgent(a)) return false;
      let matchesLevel = true;
      if (agentLevelFilter === 'state') matchesLevel = a.level === 'state';
      else if (agentLevelFilter === 'district') matchesLevel = a.level === 'district';
      else if (agentLevelFilter === 'division') matchesLevel = a.level === 'division';
      else if (agentLevelFilter === 'pincode') matchesLevel = a.level === 'pincode';
      return matchesSearch && matchesLevel;
    }
  });

  // Hierarchy Tree Map Builder (State -> District -> Division -> Pincode -> Agents)
  const buildHierarchyMap = () => {
    const map = {};
    filteredAgents.forEach(ag => {
      const terr = extractAgentTerritory(ag);
      const s = terr.state;
      const d = terr.district;
      const v = terr.division;
      const p = terr.pincode;

      if (!map[s]) map[s] = { stateName: s, stateAgents: [], districts: {} };

      if (ag.level === 'state') {
        map[s].stateAgents.push(ag);
      } else {
        if (!map[s].districts[d]) map[s].districts[d] = { districtName: d, districtAgents: [], divisions: {} };
        if (ag.level === 'district') {
          map[s].districts[d].districtAgents.push(ag);
        } else {
          if (!map[s].districts[d].divisions[v]) map[s].districts[d].divisions[v] = { divisionName: v, divisionAgents: [], pincodes: {} };
          if (ag.level === 'division') {
            map[s].districts[d].divisions[v].divisionAgents.push(ag);
          } else {
            if (!map[s].districts[d].divisions[v].pincodes[p]) {
              map[s].districts[d].divisions[v].pincodes[p] = { pincodeCode: p, pincodeAgents: [] };
            }
            map[s].districts[d].divisions[v].pincodes[p].pincodeAgents.push(ag);
          }
        }
      }
    });
    return map;
  };

  // Node Toggle Helper
  const toggleNode = (nodeId) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // Auto-expand all nodes when search is active
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.trim().length > 0) {
      const autoExpanded = {};
      filteredAgents.forEach(ag => {
        const terr = extractAgentTerritory(ag);
        const sKey = `st_${terr.state}`;
        const dKey = `dist_${terr.state}_${terr.district}`;
        const vKey = `div_${terr.state}_${terr.district}_${terr.division}`;
        const pKey = `pin_${terr.state}_${terr.district}_${terr.division}_${terr.pincode}`;
        autoExpanded[sKey] = true;
        autoExpanded[dKey] = true;
        autoExpanded[vKey] = true;
        autoExpanded[pKey] = true;
      });
      setExpandedNodes(autoExpanded);
    }
  }, [debouncedSearch, filteredAgents]);

  // Auto-expand all State & District nodes by default when agent data arrives
  useEffect(() => {
    if (agents.length > 0) {
      const hMap = buildHierarchyMap();
      const defaultExpanded = {};
      Object.values(hMap).forEach(st => {
        const sKey = `st_${st.stateName}`;
        defaultExpanded[sKey] = true;
        Object.values(st.districts).forEach(dist => {
          const dKey = `dist_${st.stateName}_${dist.districtName}`;
          defaultExpanded[dKey] = true;
        });
      });
      setExpandedNodes(prev => (Object.keys(prev).length === 0 ? defaultExpanded : prev));
    }
  }, [agents]);

  const expandAllNodes = (hMap) => {
    const allExpanded = {};
    Object.values(hMap).forEach(st => {
      const sKey = `st_${st.stateName}`;
      allExpanded[sKey] = true;
      Object.values(st.districts).forEach(dist => {
        const dKey = `dist_${st.stateName}_${dist.districtName}`;
        allExpanded[dKey] = true;
        Object.values(dist.divisions).forEach(div => {
          const vKey = `div_${st.stateName}_${dist.districtName}_${div.divisionName}`;
          allExpanded[vKey] = true;
          Object.values(div.pincodes).forEach(pin => {
            const pKey = `pin_${st.stateName}_${dist.districtName}_${div.divisionName}_${pin.pincodeCode}`;
            allExpanded[pKey] = true;
          });
        });
      });
    });
    setExpandedNodes(allExpanded);
  };

  const collapseAllNodes = () => {
    setExpandedNodes({});
  };

  // Total Subtree Count Helpers
  const getStateTotalCount = (st) => {
    let count = st.stateAgents.length;
    Object.values(st.districts).forEach(d => {
      count += d.districtAgents.length;
      Object.values(d.divisions).forEach(div => {
        count += div.divisionAgents.length;
        Object.values(div.pincodes).forEach(pin => {
          count += pin.pincodeAgents.length;
        });
      });
    });
    return count;
  };

  const getDistrictTotalCount = (d) => {
    let count = d.districtAgents.length;
    Object.values(d.divisions).forEach(div => {
      count += div.divisionAgents.length;
      Object.values(div.pincodes).forEach(pin => {
        count += pin.pincodeAgents.length;
      });
    });
    return count;
  };

  const getDivisionTotalCount = (div) => {
    let count = div.divisionAgents.length;
    Object.values(div.pincodes).forEach(pin => {
      count += pin.pincodeAgents.length;
    });
    return count;
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER & NETWORK BREAKDOWN ── */}
      {bgNotice && agents.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold px-4 py-2 rounded-xl flex items-center justify-between">
          <span>{bgNotice}</span>
          <button type="button" onClick={() => setBgNotice(null)} className="text-amber-500 hover:text-amber-700 font-bold ml-2 cursor-pointer">✕</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-500" />
            Agent Directory
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time territory breakdown, agent hierarchy structure, and operational status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadAgentData(true)}
            disabled={refreshing}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-primary-500' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowOnboardingModal(true);
              loadAgentData(true);
              if (typeof onOpenOnboardingModal === 'function') {
                onOpenOnboardingModal();
              }
            }}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            Onboarding Requests
            {pendingCount > 0 && (
              <span className="bg-white text-amber-900 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenAddAgentModal}
            className="bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Agent
          </button>
        </div>
      </div>

      {/* KPI NETWORK BREAKDOWN CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { id: 'all', label: 'Total Agents', count: counts.total, color: 'text-primary-500', bg: 'bg-primary-500/10 border-primary-500' },
          { id: 'state', label: 'State Agents', count: counts.state, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500' },
          { id: 'district', label: 'District Agents', count: counts.district, color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500' },
          { id: 'division', label: 'Divisional Agents', count: counts.division, color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500' },
          { id: 'pincode', label: 'Pincode Agents', count: counts.pincode, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500' }
        ].map(card => (
          <div
            key={card.id}
            onClick={() => setAgentLevelFilter(card.id)}
            className={`p-4 rounded-2xl text-center cursor-pointer transition-all border ${
              agentLevelFilter === card.id ? card.bg + ' shadow-sm font-bold' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <span className={`block text-2xl font-black ${card.color}`}>
              {loading && agents.length === 0 ? '...' : card.count}
            </span>
            <span className="text-xs font-semibold text-slate-400 mt-1 block">{card.label}</span>
          </div>
        ))}
      </div>

      {/* ── TOOLBAR: SEARCH, FILTERS & VIEW MODE ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          {/* Search Bar */}
          <div className="flex gap-2.5 items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ID, email, area, pincode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent focus:outline-none text-xs w-full text-slate-800 dark:text-slate-100"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 text-xs">
                ✕
              </button>
            )}
          </div>

          {/* View Mode Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            {[
              { id: 'tree', label: 'Hierarchy Tree', icon: Layers },
              { id: 'list', label: 'List View', icon: List },
              { id: 'grid', label: 'Grid View', icon: Grid }
            ].map(v => {
              const IconComp = v.icon;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setAgentViewMode(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    agentViewMode === v.id
                      ? 'bg-white dark:bg-slate-900 text-primary-600 dark:text-primary-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  {v.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Level Pills */}
        <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter Level:</span>
          {[
            { id: 'all', label: 'All Agents', count: counts.total },
            { id: 'state', label: 'State Agents', count: counts.state },
            { id: 'district', label: 'District Agents', count: counts.district },
            { id: 'division', label: 'Divisional Agents', count: counts.division },
            { id: 'pincode', label: 'Pincode Agents', count: counts.pincode },
            { id: 'rejected', label: 'Rejected Agents', count: counts.rejected }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setAgentLevelFilter(f.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                agentLevelFilter === f.id
                  ? f.id === 'rejected' ? 'bg-rose-600 text-white font-bold' : 'bg-primary-600 text-white font-bold'
                  : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
              }`}
            >
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                agentLevelFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
              }`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ERROR BADGE NOTIFICATION IF PREVIOUS DATA RETAINED */}
      {error && agents.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 p-3 rounded-xl text-xs font-semibold flex justify-between items-center">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error} (Displaying cached agent network)
          </span>
          <button onClick={() => loadAgentData(true)} className="underline font-bold hover:text-amber-700">
            Retry Now
          </button>
        </div>
      )}

      {/* ── RENDERING CONTENT STATES ── */}
      {loading && agents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary-500 animate-spin mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Loading Agent Directory...</p>
          <p className="text-xs text-slate-400">Fetching live agent network hierarchy from server.</p>
        </div>
      ) : error && agents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-12 text-center space-y-4">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">Unable to Load Agent Directory</h4>
            <p className="text-xs text-slate-400 mt-1">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => loadAgentData(true)}
            className="bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm transition-all"
          >
            Retry Fetching Data
          </button>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-2">
          <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No agents found</p>
          <p className="text-xs text-slate-400">
            {debouncedSearch ? `No results matching "${debouncedSearch}".` : 'No agents registered under this filter yet.'}
          </p>
        </div>
      ) : (
        /* ── DYNAMIC VIEW RENDERERS ── */
        <div>
          {/* 1. HIERARCHY TREE VIEW (State -> District -> Division -> Pincode -> Agent) */}
          {agentViewMode === 'tree' && (() => {
            const hMap = buildHierarchyMap();
            const stateList = Object.values(hMap);

            return (
              <div className="space-y-4">
                {/* Tree Toolbar Controls */}
                <div className="flex justify-between items-center px-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Territory Hierarchy ({stateList.length} States)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => expandAllNodes(hMap)}
                      className="text-[11px] font-bold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                    >
                      Expand All
                    </button>
                    <span className="text-slate-300 dark:text-slate-700">|</span>
                    <button
                      type="button"
                      onClick={collapseAllNodes}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Collapse All
                    </button>
                  </div>
                </div>

                {stateList.map(st => {
                  const sKey = `st_${st.stateName}`;
                  const isStateExpanded = !!expandedNodes[sKey];
                  const stateAgentCount = getStateTotalCount(st);
                  const districtList = Object.values(st.districts);

                  return (
                    <div key={st.stateName} className="space-y-3">
                      {/* LEVEL 1: STATE HEADER CARD */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs border-l-4 border-l-purple-600 transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-[240px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              STATE AGENT
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 font-bold">
                              ID: STATE-{st.stateName.toUpperCase()}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-purple-500" /> Active State
                            </span>
                          </div>
                          <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
                            {st.stateName} State
                          </h3>
                          <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                            <span>Territory: {st.stateName}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">REVENUE</span>
                            <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₹0</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">TIEUPS (TODAY / YEST / TOTAL)</span>
                            <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">0 / 0 / {stateAgentCount}</span>
                          </div>
                          <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SUB-DISTRICTS</span>
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              {districtList.length} Districts
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0">
                          <button
                            type="button"
                            onClick={() => toggleNode(sKey)}
                            className="px-4 py-2 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          >
                            {isStateExpanded ? 'Collapse ▲' : 'Explore Districts >'}
                          </button>
                        </div>
                      </div>

                      {/* LEVEL 1 SUB-CONTENT: Direct State Agents & Districts */}
                      {isStateExpanded && (
                        <div className="pl-4 space-y-4">
                          {/* Direct State Level Agents */}
                          {st.stateAgents.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500 block px-1">State Level Assigned Agents</span>
                              {st.stateAgents.map(ag => (
                                <AgentCardItem key={ag._id} agent={ag} levelBadge="State Agent" levelColor="purple" />
                              ))}
                            </div>
                          )}

                          {/* Districts Sub-Tree */}
                          {districtList.length > 0 ? (
                            districtList.map(dist => {
                              const dKey = `dist_${st.stateName}_${dist.districtName}`;
                              const isDistExpanded = !!expandedNodes[dKey];
                              const distAgentCount = getDistrictTotalCount(dist);
                              const divisionList = Object.values(dist.divisions);

                              return (
                                <div key={dist.districtName} className="space-y-3">
                                  {/* LEVEL 2: DISTRICT HEADER CARD */}
                                  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs border-l-4 border-l-blue-600 transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                    <div className="space-y-1.5 min-w-[240px]">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                          DISTRICT AGENT
                                        </span>
                                        <span className="text-[11px] font-mono text-slate-400 font-bold">
                                          ID: REG-{dist.districtName.toUpperCase().replace(/\s+/g, '-')}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center gap-1">
                                          <MapPin className="w-3 h-3 text-blue-500" /> Active District
                                        </span>
                                      </div>
                                      <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
                                        {dist.districtName} District
                                      </h3>
                                      <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                        <span>District: {dist.districtName} ({st.stateName})</span>
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                                      <div className="text-center">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">REVENUE</span>
                                        <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₹0</span>
                                      </div>
                                      <div className="text-center">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">TIEUPS (TODAY / YEST / TOTAL)</span>
                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">0 / 0 / {distAgentCount}</span>
                                      </div>
                                      <div className="text-center">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SUB-DIVISIONS</span>
                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                          {divisionList.length} Divisions
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0">
                                      <button
                                        type="button"
                                        onClick={() => toggleNode(dKey)}
                                        className="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                      >
                                        {isDistExpanded ? 'Collapse ▲' : 'Explore Divisions >'}
                                      </button>
                                    </div>
                                  </div>

                                  {/* LEVEL 2 SUB-CONTENT: Direct District Agents & Divisions */}
                                  {isDistExpanded && (
                                    <div className="pl-4 space-y-3 pt-1">
                                      {dist.districtAgents.length > 0 && (
                                        <div className="space-y-2">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block px-1">District Level Assigned Agents</span>
                                          {dist.districtAgents.map(ag => (
                                            <AgentCardItem key={ag._id} agent={ag} levelBadge="District Agent" levelColor="blue" />
                                          ))}
                                        </div>
                                      )}

                                      {/* Divisions Sub-Tree */}
                                      {divisionList.length > 0 ? (
                                        divisionList.map(div => {
                                          const vKey = `div_${st.stateName}_${dist.districtName}_${div.divisionName}`;
                                          const isDivExpanded = !!expandedNodes[vKey];
                                          const divAgentCount = getDivisionTotalCount(div);
                                          const pincodeList = Object.values(div.pincodes);

                                          return (
                                            <div key={div.divisionName} className="space-y-3">
                                              {/* LEVEL 3: DIVISION HEADER CARD */}
                                              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs border-l-4 border-l-indigo-600 transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="space-y-1.5 min-w-[240px]">
                                                  <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                                      DIVISIONAL AGENT
                                                    </span>
                                                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                                                      ID: REG-{div.divisionName.toUpperCase().replace(/\s+/g, '-')}
                                                    </span>
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center gap-1">
                                                      <MapPin className="w-3 h-3 text-indigo-500" /> Active Division
                                                    </span>
                                                  </div>
                                                  <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
                                                    {div.divisionName} Division
                                                  </h3>
                                                  <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                                    <span>Division: {div.divisionName} ({dist.districtName})</span>
                                                  </p>
                                                </div>

                                                <div className="flex items-center gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                                                  <div className="text-center">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">REVENUE</span>
                                                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₹0</span>
                                                  </div>
                                                  <div className="text-center">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">TIEUPS (TODAY / YEST / TOTAL)</span>
                                                    <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">0 / 0 / {divAgentCount}</span>
                                                  </div>
                                                  <div className="text-center">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SUB-PINCODES</span>
                                                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                                                      {pincodeList.length} Pincodes
                                                    </span>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0">
                                                  <button
                                                    type="button"
                                                    onClick={() => toggleNode(vKey)}
                                                    className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                  >
                                                    {isDivExpanded ? 'Collapse ▲' : 'Explore Pincodes >'}
                                                  </button>
                                                </div>
                                              </div>

                                              {/* LEVEL 3 SUB-CONTENT: Direct Division Agents & Pincodes */}
                                              {isDivExpanded && (
                                                <div className="pl-4 space-y-3 pt-1">
                                                  {div.divisionAgents.length > 0 && (
                                                    <div className="space-y-2">
                                                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 block px-1">Divisional Level Assigned Agents</span>
                                                      {div.divisionAgents.map(ag => (
                                                        <AgentCardItem key={ag._id} agent={ag} levelBadge="Divisional Agent" levelColor="indigo" />
                                                      ))}
                                                    </div>
                                                  )}

                                                  {/* Pincodes Sub-Tree */}
                                                  {pincodeList.length > 0 ? (
                                                    pincodeList.map(pin => {
                                                      const pKey = `pin_${st.stateName}_${dist.districtName}_${div.divisionName}_${pin.pincodeCode}`;
                                                      const isPinExpanded = !!expandedNodes[pKey];

                                                      return (
                                                        <div key={pin.pincodeCode} className="space-y-2">
                                                          {/* LEVEL 4: PINCODE HEADER CARD */}
                                                          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs border-l-4 border-l-emerald-600 transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                            <div className="space-y-1.5 min-w-[240px]">
                                                              <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                                  PINCODE AGENT
                                                                </span>
                                                                <span className="text-[11px] font-mono text-slate-400 font-bold">
                                                                  ID: REG-{pin.pincodeCode}
                                                                </span>
                                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                                                                  <MapPin className="w-3 h-3 text-emerald-500" /> Active Pincode
                                                                </span>
                                                              </div>
                                                              <h3 className="text-base font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
                                                                {pin.pincodeCode} Pincode
                                                              </h3>
                                                              <p className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                                                                <span>Pincode: {pin.pincodeCode} ({div.divisionName})</span>
                                                              </p>
                                                            </div>

                                                            <div className="flex items-center gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
                                                              <div className="text-center">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">REVENUE</span>
                                                                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₹0</span>
                                                              </div>
                                                              <div className="text-center">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">TIEUPS (TODAY / YEST / TOTAL)</span>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">0 / 0 / {pin.pincodeAgents.length}</span>
                                                              </div>
                                                              <div className="text-center">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SUB-AGENTS</span>
                                                                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                                                  {pin.pincodeAgents.length} Agents
                                                                </span>
                                                              </div>
                                                            </div>

                                                            <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0">
                                                              <button
                                                                type="button"
                                                                onClick={() => toggleNode(pKey)}
                                                                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                              >
                                                                {isPinExpanded ? 'Collapse ▲' : 'Explore Agents >'}
                                                              </button>
                                                            </div>
                                                          </div>

                                                          {/* LEVEL 4 SUB-CONTENT: Pincode Agent Cards */}
                                                          {isPinExpanded && (
                                                            <div className="pl-4 space-y-2 pt-1">
                                                              {pin.pincodeAgents.length > 0 ? (
                                                                pin.pincodeAgents.map(ag => (
                                                                  <AgentCardItem key={ag._id} agent={ag} levelBadge="Pincode Agent" levelColor="emerald" />
                                                                ))
                                                              ) : (
                                                                <p className="text-[11px] text-slate-400 italic px-2">No agents available.</p>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      );
                                                    })
                                                  ) : (
                                                    <p className="text-[11px] text-slate-400 italic px-2">No pincode data available.</p>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <p className="text-[11px] text-slate-400 italic px-2">No division data available.</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-[11px] text-slate-400 italic px-2">No district data available.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* 2. LIST VIEW (Detailed Table) */}
          {agentViewMode === 'list' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                      <th className="px-5 py-3.5">Agent Info</th>
                      <th className="px-5 py-3.5">Level</th>
                      <th className="px-5 py-3.5">Territory Location</th>
                      <th className="px-5 py-3.5">Contact</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Reg. Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {filteredAgents.map(ag => {
                      const terr = extractAgentTerritory(ag);
                      return (
                        <tr key={ag._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-3.5">
                            <span className="block font-bold text-slate-880 dark:text-slate-100">{ag.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">{ag.registrationId}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              ag.level === 'state' ? 'bg-purple-500/10 text-purple-500' :
                              ag.level === 'district' ? 'bg-blue-500/10 text-blue-500' :
                              ag.level === 'division' ? 'bg-indigo-500/10 text-indigo-500' : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {ag.level}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="block text-slate-700 dark:text-slate-300 font-semibold">{terr.state} / {terr.district}</span>
                            <span className="text-[10px] text-slate-400">{terr.division} {terr.pincode !== 'N/A' ? `(${terr.pincode})` : ''}</span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                            <span className="block">{ag.email || 'N/A'}</span>
                            <span className="text-[10px] font-mono">{ag.phone || 'N/A'}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                              ag.status?.toLowerCase() === 'approved' || ag.status?.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-500' :
                              ag.status?.toLowerCase() === 'rejected' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              {ag.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-slate-400 text-[10px]">
                            {new Date(ag.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. GRID VIEW (Profile Cards) */}
          {agentViewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredAgents.map(ag => (
                <AgentCardItem key={ag._id} agent={ag} levelBadge={`${ag.level.toUpperCase()} AGENT`} levelColor={
                  ag.level === 'state' ? 'purple' : ag.level === 'district' ? 'blue' : ag.level === 'division' ? 'indigo' : 'emerald'
                } />
              ))}
            </div>
          )}
        </div>
      )}
      {/* AGENT ONBOARDING REQUESTS MODAL (Internal Component Fallback) */}
      {showOnboardingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-500" />
                  Agent Onboarding Requests ({agents.filter(isPendingAgent).length})
                </h3>
                <p className="text-xs text-slate-400 mt-1">Review pending agent registration and KYC approval applications</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => loadAgentData(true)}
                  disabled={refreshing}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/50 hover:bg-primary-100 dark:hover:bg-primary-900/50 px-3 py-1.5 rounded-xl border border-primary-200 dark:border-primary-800 transition-all cursor-pointer disabled:opacity-50"
                  title="Reload onboarding requests from server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh List
                </button>
                <button 
                  type="button"
                  onClick={() => setShowOnboardingModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg font-bold p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {agents.filter(isPendingAgent).map((pAgent) => {
                const terr = extractAgentTerritory(pAgent);
                const terrStr = `${terr.state} → ${terr.district} → ${terr.division} → ${terr.pincode}`;

                return (
                  <div key={pAgent._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-base">{pAgent.name}</span>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                          {pAgent.level || 'Pincode'} Agent
                        </span>
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 capitalize">
                          {pAgent.status || pAgent.kycStatus || 'Pending Review'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{pAgent.email || 'No email'} • {pAgent.phone || 'No phone'}</p>
                      <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                        Territory: {terrStr}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        REG ID: {pAgent.registrationId} | Applied: {new Date(pAgent.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex gap-2 shrink-0 flex-wrap">
                      <button
                        type="button"
                        disabled={refreshing}
                        onClick={async (e) => {
                          const targetBtn = e.currentTarget;
                          targetBtn.disabled = true;
                          try {
                            const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
                            const body = JSON.stringify({ status: 'rejected' });
                            const urls = [`/api/admin/approve-agent/${pAgent._id}`, `${API_BASE}/admin/approve-agent/${pAgent._id}`];
                            for (const u of urls) {
                              try {
                                const res = await fetch(u, { method: 'PUT', headers, body });
                                if (res.ok) break;
                              } catch (e) {}
                            }
                            loadAgentData(true);
                          } catch (err) {
                          } finally {
                            targetBtn.disabled = false;
                          }
                        }}
                        className="bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 text-xs font-semibold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={refreshing}
                        onClick={async (e) => {
                          const targetBtn = e.currentTarget;
                          targetBtn.disabled = true;
                          try {
                            const headers = { 'x-auth-token': token, 'Content-Type': 'application/json' };
                            const body = JSON.stringify({ status: 'approved' });
                            const urls = [`/api/admin/approve-agent/${pAgent._id}`, `${API_BASE}/admin/approve-agent/${pAgent._id}`];
                            for (const u of urls) {
                              try {
                                const res = await fetch(u, { method: 'PUT', headers, body });
                                if (res.ok) break;
                              } catch (e) {}
                            }
                            loadAgentData(true);
                          } catch (err) {
                          } finally {
                            targetBtn.disabled = false;
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-md cursor-pointer disabled:opacity-50"
                      >
                        Approve Agent
                      </button>
                    </div>
                  </div>
                );
              })}

              {agents.filter(isPendingAgent).length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <UserCheck className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-semibold">No pending agent onboarding requests at this time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-Component for Rendering Individual Agent Item Cards (Matches exact user screenshot design)
function AgentCardItem({ agent, levelBadge, levelColor, onExplore, exploreLabel }) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const levelStyles = {
    purple: {
      border: 'border-l-purple-600',
      pill: 'bg-purple-600 text-white',
      badgeBg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      btn: 'bg-purple-600 hover:bg-purple-500 text-white'
    },
    blue: {
      border: 'border-l-blue-600',
      pill: 'bg-blue-600 text-white',
      badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      btn: 'bg-blue-600 hover:bg-blue-500 text-white'
    },
    indigo: {
      border: 'border-l-indigo-600',
      pill: 'bg-indigo-600 text-white',
      badgeBg: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      btn: 'bg-indigo-600 hover:bg-indigo-500 text-white'
    },
    emerald: {
      border: 'border-l-emerald-600',
      pill: 'bg-emerald-600 text-white',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white'
    },
    amber: {
      border: 'border-l-amber-500',
      pill: 'bg-amber-500 text-white',
      badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      btn: 'bg-amber-500 hover:bg-amber-400 text-white'
    }
  };

  const currentStyle = levelStyles[levelColor] || levelStyles.blue;
  const isApproved = (agent.status === 'approved' || agent.kycStatus === 'approved' || agent.isApproved);
  const formattedId = agent.registrationId || (agent._id ? `REG-${agent._id.substring(0, 8)}` : 'REG-20260831-0000');
  const districtName = agent.assignedDistrict || agent.territory?.district || 'General District';
  const stateName = agent.assignedState || agent.territory?.state || 'General State';

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs border-l-4 ${currentStyle.border} transition-all hover:shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}>
      {/* Left Details */}
      <div className="space-y-1.5 min-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${currentStyle.badgeBg}`}>
            {levelBadge}
          </span>
          <span className="text-[11px] font-mono text-slate-400 font-bold">
            ID: {formattedId}
          </span>
          {isApproved ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Approved
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" /> Pending KYC
            </span>
          )}
        </div>

        <h4 className="text-base font-extrabold text-slate-850 dark:text-slate-100 tracking-tight">
          {agent.name}
        </h4>

        <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>District: {districtName} ({stateName})</span>
        </div>
      </div>

      {/* Middle Metrics */}
      <div className="flex items-center gap-6 md:gap-10 border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-start">
        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">REVENUE</span>
          <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">₹{agent.revenue || 0}</span>
        </div>

        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">TIEUPS (TODAY / YEST / TOTAL)</span>
          <span className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono">0 / 0 / 0</span>
        </div>

        <div className="text-center">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SUB-DIVISIONS</span>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${currentStyle.badgeBg}`}>
            0 Divisions
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto justify-end pt-2 md:pt-0">
        <button
          type="button"
          onClick={() => setShowDetailsModal(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" /> Details
        </button>

        {onExplore && (
          <button
            type="button"
            onClick={onExplore}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold ${currentStyle.btn} shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95`}
          >
            {exploreLabel || 'Explore Divisions >'}
          </button>
        )}
      </div>

      {/* AGENT DETAILS SCORECARD MODAL */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{agent.name}</h3>
                <p className="text-xs text-slate-400 font-mono">REG ID: {formattedId}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Role / Level</span>
                  <p className="font-extrabold capitalize text-slate-800 dark:text-slate-200">{agent.level || 'Pincode'} Agent</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                  <p className="font-extrabold capitalize text-slate-800 dark:text-slate-200">{agent.status || 'Pending'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Email</span>
                  <p className="font-mono truncate text-slate-700 dark:text-slate-300">{agent.email || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Phone</span>
                  <p className="font-mono text-slate-700 dark:text-slate-300">{agent.phone || 'N/A'}</p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Territory</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {stateName} → {districtName} → {agent.assignedDivision || agent.territory?.division || 'General Division'} → {agent.assignedPincode || agent.territory?.pincode || 'General Pincode'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <span className="text-[10px] font-black text-purple-600 block">TOTAL REVENUE</span>
                  <span className="text-sm font-black text-purple-700 dark:text-purple-300">₹{agent.revenue || 0}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] font-black text-blue-600 block">ACTIVE TIEUPS</span>
                  <span className="text-sm font-black text-blue-700 dark:text-blue-300">0</span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <span className="text-[10px] font-black text-emerald-600 block">JOINED DATE</span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">{new Date(agent.createdAt || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Close Scorecard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
