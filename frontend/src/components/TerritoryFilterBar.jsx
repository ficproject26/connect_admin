import React, { useState, useEffect, useRef } from 'react';
import { MapPin, RotateCcw, RefreshCw, ChevronDown } from 'lucide-react';

// In-memory module cache for territory hierarchy to prevent redundant API roundtrips across modules
const territoryCache = {
  states: null,
  districts: {}, // key: state
  divisions: {}, // key: `${state}_${district}`
  pincodes: {}   // key: `${state}_${district}_${division}`
};

/**
 * Universal Cascading Territory Filter Bar for Main Admin Portal
 * Hierarchy: State -> District -> Division -> Pincode -> Reset
 *
 * Supported across:
 * 1. Customers
 * 2. Membership Cards
 * 3. Managers
 * 4. Total Orders
 * 5. Bookings
 * 6. Jobs
 * 7. Queries
 * 8. Payment Dashboard
 * 9. Payment History
 * 10. Manager Reports
 * 11. Admin Reports
 * 12. Admin Tasks
 * 13. Vendor Subscription
 */
export const TerritoryFilterBar = ({
  territoryFilter,
  setTerritoryFilter,
  selectedState: propSelectedState,
  onStateChange,
  selectedDistrict: propSelectedDistrict,
  onDistrictChange,
  selectedDivision: propSelectedDivision,
  onDivisionChange,
  selectedPincode: propSelectedPincode,
  onPincodeChange,
  onReset,
  API_BASE: propApiBase,
  className = '',
  compact = false,
  label = 'Territory:'
}) => {
  // Support either territoryFilter object OR individual selectedState/District/etc. props
  const selectedState = territoryFilter?.state !== undefined ? territoryFilter.state : (propSelectedState || 'All');
  const selectedDistrict = territoryFilter?.district !== undefined ? territoryFilter.district : (propSelectedDistrict || 'All');
  const selectedDivision = territoryFilter?.division !== undefined ? territoryFilter.division : (propSelectedDivision || 'All');
  const selectedPincode = territoryFilter?.pincode !== undefined ? territoryFilter.pincode : (propSelectedPincode || 'All');

  const [states, setStates] = useState(territoryCache.states || []);
  const [districts, setDistricts] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [pincodes, setPincodes] = useState([]);

  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [loadingPincodes, setLoadingPincodes] = useState(false);

  // Derive API BASE URL
  const apiBase = propApiBase || (typeof window !== 'undefined' ? (window.__API_BASE__ || '') : '');

  // 1. Fetch States on Mount (cached)
  useEffect(() => {
    if (territoryCache.states && territoryCache.states.length > 0) {
      setStates(territoryCache.states);
      return;
    }

    let isMounted = true;
    const fetchStates = async () => {
      setLoadingStates(true);
      try {
        const res = await fetch(`${apiBase}/api/territory/states?status=Active`);
        if (res.ok) {
          const data = await res.json();
          const stateNames = (Array.isArray(data) ? data : (data.states || []))
            .map(s => (typeof s === 'string' ? s : s.name))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
          
          if (isMounted) {
            territoryCache.states = stateNames;
            setStates(stateNames);
          }
        }
      } catch (err) {
        console.warn('[TerritoryFilterBar] Error loading states:', err.message);
      } finally {
        if (isMounted) setLoadingStates(false);
      }
    };

    fetchStates();
    return () => { isMounted = false; };
  }, [apiBase]);

  // 2. Fetch Districts when State changes
  useEffect(() => {
    if (!selectedState || selectedState === 'All') {
      setDistricts([]);
      setDivisions([]);
      setPincodes([]);
      return;
    }

    if (territoryCache.districts[selectedState]) {
      setDistricts(territoryCache.districts[selectedState]);
      return;
    }

    let isMounted = true;
    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      try {
        const res = await fetch(`${apiBase}/api/territory/districts?state=${encodeURIComponent(selectedState)}&status=Active`);
        if (res.ok) {
          const data = await res.json();
          const distNames = (Array.isArray(data) ? data : (data.districts || []))
            .map(d => (typeof d === 'string' ? d : d.name))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

          if (isMounted) {
            territoryCache.districts[selectedState] = distNames;
            setDistricts(distNames);
          }
        }
      } catch (err) {
        console.warn('[TerritoryFilterBar] Error loading districts:', err.message);
      } finally {
        if (isMounted) setLoadingDistricts(false);
      }
    };

    fetchDistricts();
    return () => { isMounted = false; };
  }, [selectedState, apiBase]);

  // 3. Fetch Divisions when District changes
  useEffect(() => {
    if (!selectedState || selectedState === 'All' || !selectedDistrict || selectedDistrict === 'All') {
      setDivisions([]);
      setPincodes([]);
      return;
    }

    const cacheKey = `${selectedState}_${selectedDistrict}`;
    if (territoryCache.divisions[cacheKey]) {
      setDivisions(territoryCache.divisions[cacheKey]);
      return;
    }

    let isMounted = true;
    const fetchDivisions = async () => {
      setLoadingDivisions(true);
      try {
        const res = await fetch(`${apiBase}/api/territory/divisions?state=${encodeURIComponent(selectedState)}&district=${encodeURIComponent(selectedDistrict)}&status=Active`);
        if (res.ok) {
          const data = await res.json();
          const divNames = (Array.isArray(data) ? data : (data.divisions || []))
            .map(v => (typeof v === 'string' ? v : v.name))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

          if (isMounted) {
            territoryCache.divisions[cacheKey] = divNames;
            setDivisions(divNames);
          }
        }
      } catch (err) {
        console.warn('[TerritoryFilterBar] Error loading divisions:', err.message);
      } finally {
        if (isMounted) setLoadingDivisions(false);
      }
    };

    fetchDivisions();
    return () => { isMounted = false; };
  }, [selectedState, selectedDistrict, apiBase]);

  // 4. Fetch Pincodes when Division changes
  useEffect(() => {
    if (!selectedState || selectedState === 'All' || !selectedDistrict || selectedDistrict === 'All' || !selectedDivision || selectedDivision === 'All') {
      setPincodes([]);
      return;
    }

    const cacheKey = `${selectedState}_${selectedDistrict}_${selectedDivision}`;
    if (territoryCache.pincodes[cacheKey]) {
      setPincodes(territoryCache.pincodes[cacheKey]);
      return;
    }

    let isMounted = true;
    const fetchPincodes = async () => {
      setLoadingPincodes(true);
      try {
        const res = await fetch(`${apiBase}/api/territory/pincodes?state=${encodeURIComponent(selectedState)}&district=${encodeURIComponent(selectedDistrict)}&division=${encodeURIComponent(selectedDivision)}&status=Active`);
        if (res.ok) {
          const data = await res.json();
          const pinList = (Array.isArray(data) ? data : (data.pincodes || []))
            .map(p => (typeof p === 'string' ? p : (p.code || p.pincode)))
            .filter(Boolean)
            .sort((a, b) => String(a).localeCompare(String(b)));

          if (isMounted) {
            territoryCache.pincodes[cacheKey] = pinList;
            setPincodes(pinList);
          }
        }
      } catch (err) {
        console.warn('[TerritoryFilterBar] Error loading pincodes:', err.message);
      } finally {
        if (isMounted) setLoadingPincodes(false);
      }
    };

    fetchPincodes();
    return () => { isMounted = false; };
  }, [selectedState, selectedDistrict, selectedDivision, apiBase]);

  // Handle Cascading Changes
  const handleStateSelect = (val) => {
    if (typeof setTerritoryFilter === 'function') {
      setTerritoryFilter({ state: val, district: 'All', division: 'All', pincode: 'All' });
    }
    if (typeof onStateChange === 'function') onStateChange(val);
    if (typeof onDistrictChange === 'function') onDistrictChange('All');
    if (typeof onDivisionChange === 'function') onDivisionChange('All');
    if (typeof onPincodeChange === 'function') onPincodeChange('All');
  };

  const handleDistrictSelect = (val) => {
    if (typeof setTerritoryFilter === 'function') {
      setTerritoryFilter(prev => ({ ...(prev || {}), district: val, division: 'All', pincode: 'All' }));
    }
    if (typeof onDistrictChange === 'function') onDistrictChange(val);
    if (typeof onDivisionChange === 'function') onDivisionChange('All');
    if (typeof onPincodeChange === 'function') onPincodeChange('All');
  };

  const handleDivisionSelect = (val) => {
    if (typeof setTerritoryFilter === 'function') {
      setTerritoryFilter(prev => ({ ...(prev || {}), division: val, pincode: 'All' }));
    }
    if (typeof onDivisionChange === 'function') onDivisionChange(val);
    if (typeof onPincodeChange === 'function') onPincodeChange('All');
  };

  const handlePincodeSelect = (val) => {
    if (typeof setTerritoryFilter === 'function') {
      setTerritoryFilter(prev => ({ ...(prev || {}), pincode: val }));
    }
    if (typeof onPincodeChange === 'function') onPincodeChange(val);
  };

  const handleResetClick = () => {
    if (typeof setTerritoryFilter === 'function') {
      setTerritoryFilter({ state: 'All', district: 'All', division: 'All', pincode: 'All' });
    }
    if (typeof onReset === 'function') {
      onReset();
    } else {
      if (typeof onStateChange === 'function') onStateChange('All');
      if (typeof onDistrictChange === 'function') onDistrictChange('All');
      if (typeof onDivisionChange === 'function') onDivisionChange('All');
      if (typeof onPincodeChange === 'function') onPincodeChange('All');
    }
  };

  const isFiltered = (selectedState && selectedState !== 'All') ||
                     (selectedDistrict && selectedDistrict !== 'All') ||
                     (selectedDivision && selectedDivision !== 'All') ||
                     (selectedPincode && selectedPincode !== 'All');

  return (
    <div className={`flex flex-wrap items-center gap-2 text-xs ${className}`}>
      {label && (
        <span className="font-extrabold uppercase text-[10px] tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0 px-1">
          <MapPin className="w-3.5 h-3.5 text-primary-500" />
          {label}
        </span>
      )}

      {/* 1. State Dropdown */}
      <div className="relative min-w-[130px] flex-1 sm:flex-initial">
        <select
          value={selectedState || 'All'}
          onChange={(e) => handleStateSelect(e.target.value)}
          disabled={loadingStates}
          className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer shadow-xs disabled:opacity-50"
        >
          <option value="All">All States</option>
          {states.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {loadingStates ? <RefreshCw className="w-3 h-3 animate-spin text-primary-500" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {/* 2. District Dropdown (Cascaded on State) */}
      <div className="relative min-w-[130px] flex-1 sm:flex-initial">
        <select
          value={selectedDistrict || 'All'}
          onChange={(e) => handleDistrictSelect(e.target.value)}
          disabled={!selectedState || selectedState === 'All' || loadingDistricts}
          className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="All">All Districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {loadingDistricts ? <RefreshCw className="w-3 h-3 animate-spin text-primary-500" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {/* 3. Division Dropdown (Cascaded on District) */}
      <div className="relative min-w-[130px] flex-1 sm:flex-initial">
        <select
          value={selectedDivision || 'All'}
          onChange={(e) => handleDivisionSelect(e.target.value)}
          disabled={!selectedDistrict || selectedDistrict === 'All' || loadingDivisions}
          className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="All">All Divisions</option>
          {divisions.map((div) => (
            <option key={div} value={div}>{div}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {loadingDivisions ? <RefreshCw className="w-3 h-3 animate-spin text-primary-500" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {/* 4. Pincode Dropdown (Cascaded on Division) */}
      <div className="relative min-w-[120px] flex-1 sm:flex-initial">
        <select
          value={selectedPincode || 'All'}
          onChange={(e) => handlePincodeSelect(e.target.value)}
          disabled={!selectedDivision || selectedDivision === 'All' || loadingPincodes}
          className="w-full appearance-none bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-1.5 pr-7 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="All">All Pincodes</option>
          {pincodes.map((pin) => (
            <option key={pin} value={pin}>{pin}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
          {loadingPincodes ? <RefreshCw className="w-3 h-3 animate-spin text-primary-500" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      </div>

      {/* 5. Reset Action */}
      {isFiltered && (
        <button
          onClick={handleResetClick}
          type="button"
          title="Reset Territory Filter"
          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/20 rounded-xl font-bold text-xs inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      )}
    </div>
  );
};

export default TerritoryFilterBar;
