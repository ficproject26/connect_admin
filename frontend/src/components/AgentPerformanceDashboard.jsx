import React, { useState, useEffect } from 'react';
import {
  Users, UserCheck, UserX, TrendingUp, DollarSign, Award, Target, Calendar,
  BarChart3, PieChart as PieChartIcon, Activity, Clock, FileText, Download,
  Printer, Filter, Search, ChevronRight, CheckCircle, AlertTriangle, X, RefreshCw,
  PhoneCall, Video, CheckSquare, Layers, MapPin, ArrowUpRight, ArrowDownRight,
  List, LayoutGrid
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export const AgentPerformanceDashboard = ({ token, API_BASE }) => {
  // Filters & State
  const [period, setPeriod] = useState('monthly'); // today, weekly, monthly, quarterly, half-yearly, yearly, custom
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [agentType, setAgentType] = useState('all');
  const [stateFilter, setStateFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [pincodeFilter, setPincodeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'

  // Loading & Data States
  const [loading, setLoading] = useState(true);
  const [cardsData, setCardsData] = useState(null);
  const [leaderboards, setLeaderboards] = useState(null);
  const [chartsData, setChartsData] = useState(null);
  const [agentsList, setAgentsList] = useState([]);
  
  // Modals & Profile Drawer
  const [selectedAgentProfile, setSelectedAgentProfile] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetAgent, setTargetAgent] = useState(null);
  const [targetForm, setTargetForm] = useState({
    registrations: 100,
    membershipSales: 50,
    vendorOnboarding: 25,
    orders: 500,
    revenue: 500000
  });

  // Fetch Performance Overview
  const fetchOverview = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        period,
        agentType,
        status: statusFilter,
        search: searchQuery,
        state: stateFilter,
        district: districtFilter,
        division: divisionFilter,
        pincode: pincodeFilter
      });
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);

      const res = await fetch(`${API_BASE}/admin/agent-performance/overview?${query.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setCardsData(data.cards);
        setLeaderboards(data.leaderboards);
        setChartsData(data.charts);
        setAgentsList(data.agents || []);
      }
    } catch (err) {
      console.error('Fetch agent performance error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [period, agentType, statusFilter, stateFilter, districtFilter, divisionFilter, pincodeFilter]);

  // Export handlers
  const exportCSV = () => {
    if (!agentsList || agentsList.length === 0) return;
    const headers = ['Agent Name', 'Email', 'Role', 'Territory', 'Status', 'Score', 'Rating', 'Registrations', 'Revenue'];
    const rows = agentsList.map(a => [
      `"${a.agent.name}"`,
      `"${a.agent.email}"`,
      `"${a.agent.level}"`,
      `"${a.agent.assignedArea || ''}"`,
      `"${a.agent.status}"`,
      a.score,
      `"${a.rating}"`,
      a.metrics.registrations,
      a.metrics.revenue
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `agent_performance_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Target submission
  const handleSaveTarget = async (e) => {
    e.preventDefault();
    if (!targetAgent) return;
    try {
      const res = await fetch(`${API_BASE}/admin/agent-performance/targets`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: targetAgent.agent._id,
          period,
          targets: targetForm
        })
      });
      if (res.ok) {
        setShowTargetModal(false);
        fetchOverview();
      }
    } catch (err) {
      console.error('Save target error:', err);
    }
  };

  // Score Badge Component
  const renderScoreBadge = (score, rating, colorClass) => {
    const bgMap = {
      green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
      yellow: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
      orange: 'bg-orange-500/10 text-orange-500 border-orange-500/30',
      red: 'bg-rose-500/10 text-rose-500 border-rose-500/30'
    };
    return (
      <span className={`px-2.5 py-1 rounded-xl text-xs font-black border whitespace-nowrap inline-flex items-center gap-1.5 ${bgMap[colorClass] || bgMap.orange}`}>
        <span className="w-2 h-2 rounded-full bg-current animate-pulse shrink-0"></span>
        {score} / 100 ({rating})
      </span>
    );
  };

  const COLORS = ['#8b5cf6', '#3b82f6', '#6366f1', '#10b981'];

  return (
    <div className="space-y-8 pb-16">

      {/* 1. PERFORMANCE PERIOD SWITCHER + ACTIONS INCLUDED */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary-500" /> Period:
          </span>
          {[
            { id: 'today', label: "Today's" },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'quarterly', label: 'Quarterly' },
            { id: 'half-yearly', label: 'Half-Yearly' },
            { id: 'yearly', label: 'Yearly' },
            { id: 'custom', label: 'Custom Range' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${period === p.id ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              {p.label}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2 p-1 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 ml-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-xs p-1 focus:outline-none" />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-xs p-1 focus:outline-none" />
            </div>
          )}
        </div>

        {/* Action buttons embedded in Period Card */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchOverview}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          
          <button
            onClick={exportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-500" /> Export CSV
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* 2. DASHBOARD KPI CARDS (13 CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Card 1: Total Agents */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-purple-500">
            <Users className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded-full">Total</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.totalAgents || 0}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Registered Agents</span>
        </div>

        {/* Card 2: Active Agents */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-emerald-500">
            <UserCheck className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.activeAgents || 0}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Onboarded & Working</span>
        </div>

        {/* Card 3: Inactive Agents */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-rose-500">
            <UserX className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full">Inactive</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.inactiveAgents || 0}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Pending / Suspended</span>
        </div>

        {/* Card 4: Today's Performance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-blue-500">
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-full">Today</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.todaysPerformance || '0%'}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Daily Target Progress</span>
        </div>

        {/* Card 5: Weekly Performance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-indigo-500">
            <Activity className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded-full">Weekly</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.weeklyPerformance || '0%'}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Weekly Target Progress</span>
        </div>

        {/* Card 6: Monthly Performance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-amber-500">
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">Monthly</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.monthlyPerformance || '0%'}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Monthly Target Progress</span>
        </div>

        {/* Card 7: Yearly Performance */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-emerald-600">
            <Award className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">Yearly</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.yearlyPerformance || '0%'}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Annual Target Progress</span>
        </div>

        {/* Card 8: Highest Performer */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-emerald-500">
            <Award className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">Top</span>
          </div>
          <span className="block text-lg font-black text-slate-800 dark:text-slate-100 truncate">{cardsData?.highestPerformer || 'N/A'}</span>
          <span className="block text-[11px] text-emerald-500 font-bold">Highest Score Agent</span>
        </div>

        {/* Card 9: Lowest Performer */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-rose-500">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full">Lowest</span>
          </div>
          <span className="block text-lg font-black text-slate-800 dark:text-slate-100 truncate">{cardsData?.lowestPerformer || 'N/A'}</span>
          <span className="block text-[11px] text-rose-500 font-bold">Needs Support</span>
        </div>

        {/* Card 10: Pending Tasks */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-amber-500">
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">Tasks</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.pendingTasks || 0}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Assigned Agent Tasks</span>
        </div>

        {/* Card 11: Total Revenue Generated */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-emerald-500">
            <DollarSign className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full">Revenue</span>
          </div>
          <span className="block text-xl font-black text-slate-800 dark:text-slate-100">₹{(cardsData?.totalRevenueGenerated || 0).toLocaleString('en-IN')}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Total Revenue Collected</span>
        </div>

        {/* Card 12: Total Leads */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-blue-500">
            <PhoneCall className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-full">Leads</span>
          </div>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">{cardsData?.totalLeads || 0}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">Calls & Meetings</span>
        </div>
      </div>

      {/* 3. MULTI-TIER LEADERBOARDS */}
      <div className="space-y-4">
        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" /> Multi-Tier Performance Leaderboards
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Top State Agent */}
          <div className="bg-gradient-to-br from-purple-900/10 to-purple-500/5 dark:from-purple-950/40 p-4 rounded-3xl border border-purple-500/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500 text-white px-2.5 py-0.5 rounded-full">Top State Agent</span>
              <Award className="w-4 h-4 text-purple-500" />
            </div>
            <div className="space-y-1">
              <span className="block font-extrabold text-base text-slate-800 dark:text-slate-100 truncate">{leaderboards?.topStateAgent?.agent?.name || 'N/A'}</span>
              <span className="block text-xs text-slate-400">{leaderboards?.topStateAgent?.agent?.assignedArea || 'State Territory'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-purple-500/10">
              <span className="text-xs font-bold text-slate-500">Score: {leaderboards?.topStateAgent?.score || 0}/100</span>
              <span className="text-xs font-extrabold text-purple-500">₹{(leaderboards?.topStateAgent?.metrics?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Top District Agent */}
          <div className="bg-gradient-to-br from-blue-900/10 to-blue-500/5 dark:from-blue-950/40 p-4 rounded-3xl border border-blue-500/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500 text-white px-2.5 py-0.5 rounded-full">Top District Agent</span>
              <Award className="w-4 h-4 text-blue-500" />
            </div>
            <div className="space-y-1">
              <span className="block font-extrabold text-base text-slate-800 dark:text-slate-100 truncate">{leaderboards?.topDistrictAgent?.agent?.name || 'N/A'}</span>
              <span className="block text-xs text-slate-400">{leaderboards?.topDistrictAgent?.agent?.assignedArea || 'District Territory'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-blue-500/10">
              <span className="text-xs font-bold text-slate-500">Score: {leaderboards?.topDistrictAgent?.score || 0}/100</span>
              <span className="text-xs font-extrabold text-blue-500">₹{(leaderboards?.topDistrictAgent?.metrics?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Top Divisional Agent */}
          <div className="bg-gradient-to-br from-indigo-900/10 to-indigo-500/5 dark:from-indigo-950/40 p-4 rounded-3xl border border-indigo-500/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500 text-white px-2.5 py-0.5 rounded-full">Top Divisional Agent</span>
              <Award className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="space-y-1">
              <span className="block font-extrabold text-base text-slate-800 dark:text-slate-100 truncate">{leaderboards?.topDivisionalAgent?.agent?.name || 'N/A'}</span>
              <span className="block text-xs text-slate-400">{leaderboards?.topDivisionalAgent?.agent?.assignedArea || 'Division Territory'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-indigo-500/10">
              <span className="text-xs font-bold text-slate-500">Score: {leaderboards?.topDivisionalAgent?.score || 0}/100</span>
              <span className="text-xs font-extrabold text-indigo-500">₹{(leaderboards?.topDivisionalAgent?.metrics?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Top Pincode Agent */}
          <div className="bg-gradient-to-br from-emerald-900/10 to-emerald-500/5 dark:from-emerald-950/40 p-4 rounded-3xl border border-emerald-500/20 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2.5 py-0.5 rounded-full">Top Pincode Agent</span>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <span className="block font-extrabold text-base text-slate-800 dark:text-slate-100 truncate">{leaderboards?.topPincodeAgent?.agent?.name || 'N/A'}</span>
              <span className="block text-xs text-slate-400">Pincode: {leaderboards?.topPincodeAgent?.agent?.assignedPincode?.code || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-emerald-500/10">
              <span className="text-xs font-bold text-slate-500">Score: {leaderboards?.topPincodeAgent?.score || 0}/100</span>
              <span className="text-xs font-extrabold text-emerald-500">₹{(leaderboards?.topPincodeAgent?.metrics?.revenue || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHARTS & GRAPH ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Line Chart: Performance Trend */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-wider uppercase flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary-500" /> Agent Performance Trend (Actual vs Target)
            </h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartsData?.lineChartData || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                <Legend />
                <Line type="monotone" dataKey="Performance" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Targets" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Revenue by Tier */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-wider uppercase flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-500" /> Revenue Generation by Agent Tier
            </h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartsData?.barChartRevenue || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="category" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Agent Tier Distribution */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-wider uppercase flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-blue-500" /> Agent Network Distribution
            </h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartsData?.pieChartCategory || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {(chartsData?.pieChartCategory || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Area Chart: Customer Registrations */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm tracking-wider uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" /> Customer Registrations Growth
            </h4>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartsData?.areaChartRegistrations || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }} />
                <Area type="monotone" dataKey="Registrations" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. INDIVIDUAL AGENT MONITORING DIRECTORY WITH INTEGRATED FILTER CARD & VIEW SWITCHER */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 space-y-6">
        
        {/* Section Header with List / Grid Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-500" /> Individual Agent Monitoring Directory
            </h3>
            <p className="text-xs text-slate-400 mt-1">Review agent performance scores, target completions & active status</p>
          </div>

          {/* List / Grid Toggle Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              title="List Table View"
            >
              <List className="w-4 h-4" /> List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-xs' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              title="Grid Card View"
            >
              <LayoutGrid className="w-4 h-4" /> Grid
            </button>
          </div>
        </div>

        {/* ADVANCED FILTERS CARD EMBEDDED INSIDE INDIVIDUAL AGENT MONITORING DIRECTORY */}
        <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-850 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-primary-500" /> Advanced Performance Filters
            </span>
            <button onClick={() => { setAgentType('all'); setStatusFilter('all'); setSearchQuery(''); setStateFilter(''); setDistrictFilter(''); setDivisionFilter(''); setPincodeFilter(''); }} className="text-xs font-bold text-slate-400 hover:text-rose-500 cursor-pointer">
              Reset Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Agent Type */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Agent Level</label>
              <select value={agentType} onChange={e => setAgentType(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs p-2.5 font-semibold focus:outline-none">
                <option value="all">All Levels</option>
                <option value="state">State Agent</option>
                <option value="district">District Agent</option>
                <option value="division">Divisional Agent</option>
                <option value="pincode">Pincode Agent</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs p-2.5 font-semibold focus:outline-none">
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            {/* State Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">State</label>
              <input type="text" placeholder="e.g. Tamil Nadu" value={stateFilter} onChange={e => setStateFilter(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs p-2.5 font-semibold focus:outline-none" />
            </div>

            {/* District Filter */}
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">District</label>
              <input type="text" placeholder="e.g. Krishnagiri" value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs p-2.5 font-semibold focus:outline-none" />
            </div>

            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Agent Name / ID</label>
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                <Search className="w-4 h-4 text-slate-400 mr-2" />
                <input type="text" placeholder="Type Agent Name, Email, or Reg ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent text-xs w-full focus:outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* LIST VIEW TABLE */}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Agent Profile</th>
                  <th className="py-3 px-4">Role / Level</th>
                  <th className="py-3 px-4">Territory</th>
                  <th className="py-3 px-4">Score (0–100)</th>
                  <th className="py-3 px-4">Registrations</th>
                  <th className="py-3 px-4">Vendors</th>
                  <th className="py-3 px-4">Revenue</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
                {agentsList.map((item) => {
                  const ag = item.agent;
                  return (
                    <tr key={ag._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={ag.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                            alt=""
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
                          />
                          <div>
                            <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{ag.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">{ag.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="capitalize font-extrabold text-xs px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap inline-flex items-center justify-center">
                          {(ag.level || 'pincode').toLowerCase()} Agent
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-600 dark:text-slate-300">
                        {ag.assignedArea || 'Tamil Nadu'}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderScoreBadge(item.score, item.rating, item.colorClass)}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                        {item.metrics.registrations}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-200">
                        {item.metrics.vendorOnboarding}
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-emerald-500 whitespace-nowrap">
                        ₹{(item.metrics.revenue || 0).toLocaleString()}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setTargetAgent(item); setShowTargetModal(true); }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                          >
                            Set Targets
                          </button>

                          <button
                            onClick={() => { setSelectedAgentProfile(item); setProfileTab('overview'); }}
                            className="px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            View Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* GRID VIEW CARDS */}
        {viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {agentsList.map((item) => {
              const ag = item.agent;
              return (
                <div key={ag._id} className="bg-slate-50 dark:bg-slate-950 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-850 hover:shadow-md transition-all space-y-4">
                  {/* Card Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <img
                        src={ag.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                        alt=""
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-primary-500/40"
                      />
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{ag.name}</h4>
                        <span className="text-[11px] text-slate-400 block font-mono">{ag.email}</span>
                      </div>
                    </div>
                    
                    <span className="capitalize font-extrabold text-[11px] px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 whitespace-nowrap inline-flex items-center justify-center shrink-0">
                      {(ag.level || 'pincode').toLowerCase()} Agent
                    </span>
                  </div>

                  {/* Territory & Status Row */}
                  <div className="flex items-center justify-between border-t border-b border-slate-200/60 dark:border-slate-800/60 py-2 text-xs">
                    <span className="text-slate-500 font-medium">Territory: <strong className="text-slate-800 dark:text-slate-200 font-bold">{ag.assignedArea || 'Tamil Nadu'}</strong></span>
                    {renderScoreBadge(item.score, item.rating, item.colorClass)}
                  </div>

                  {/* KPI Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Registrations</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{item.metrics.registrations}</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Vendors Added</span>
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{item.metrics.vendorOnboarding}</span>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 col-span-2 flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Total Revenue</span>
                      <span className="font-black text-emerald-500 text-sm">₹{(item.metrics.revenue || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      onClick={() => { setTargetAgent(item); setShowTargetModal(true); }}
                      className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all w-1/2 cursor-pointer"
                    >
                      Set Targets
                    </button>
                    <button
                      onClick={() => { setSelectedAgentProfile(item); setProfileTab('overview'); }}
                      className="px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-xs w-1/2 cursor-pointer"
                    >
                      View Profile
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* 6. TARGET MANAGEMENT MODAL */}
      {showTargetModal && targetAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Assign Agent Targets</h3>
                <p className="text-xs text-slate-400 mt-1">Set monthly performance targets for {targetAgent.agent.name}</p>
              </div>
              <button onClick={() => setShowTargetModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleSaveTarget} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Registrations Target</label>
                <input
                  type="number"
                  value={targetForm.registrations}
                  onChange={e => setTargetForm({ ...targetForm, registrations: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Membership Sales Target</label>
                <input
                  type="number"
                  value={targetForm.membershipSales}
                  onChange={e => setTargetForm({ ...targetForm, membershipSales: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendor Onboarding Target</label>
                <input
                  type="number"
                  value={targetForm.vendorOnboarding}
                  onChange={e => setTargetForm({ ...targetForm, vendorOnboarding: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Orders Target</label>
                <input
                  type="number"
                  value={targetForm.orders}
                  onChange={e => setTargetForm({ ...targetForm, orders: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Revenue Target (₹)</label>
                <input
                  type="number"
                  value={targetForm.revenue}
                  onChange={e => setTargetForm({ ...targetForm, revenue: Number(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs font-bold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowTargetModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-md cursor-pointer">Save Targets</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. AGENT PROFILE DRILLDOWN DRAWER / MODAL (11 TABS) */}
      {selectedAgentProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-4xl rounded-3xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                <img
                  src={selectedAgentProfile.agent.kyc?.selfie || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
                  alt=""
                  className="w-14 h-14 rounded-2xl object-cover border-2 border-primary-500"
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{selectedAgentProfile.agent.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="capitalize text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20 whitespace-nowrap">
                      {selectedAgentProfile.agent.level} Agent
                    </span>
                    <span className="text-xs text-slate-400">{selectedAgentProfile.agent.email} • {selectedAgentProfile.agent.phone}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedAgentProfile(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
            </div>

            {/* 11 Tabs Switcher */}
            <div className="flex overflow-x-auto gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              {[
                'overview', 'targets', 'revenue', 'customers', 'membership',
                'orders', 'bookings', 'documents', 'commission', 'attendance', 'timeline'
              ].map(tab => (
                <button
                  key={tab}
                  onClick={() => setProfileTab(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold capitalize whitespace-nowrap transition-all cursor-pointer ${profileTab === tab ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {profileTab === 'overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                    <span className="block text-slate-400 font-semibold mb-1">Performance Score</span>
                    <span className="text-lg font-black text-emerald-500">{selectedAgentProfile.score} / 100</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                    <span className="block text-slate-400 font-semibold mb-1">Territory Scope</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedAgentProfile.agent.assignedArea || 'Tamil Nadu'}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                    <span className="block text-slate-400 font-semibold mb-1">Joining Date</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{new Date(selectedAgentProfile.agent.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                    <span className="block text-slate-400 font-semibold mb-1">Status</span>
                    <span className="text-sm font-bold capitalize text-emerald-500">{selectedAgentProfile.agent.status}</span>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'targets' && (
              <div className="space-y-4 text-xs">
                <h4 className="font-extrabold uppercase text-slate-400 tracking-wider">Target vs Achieved Progress</h4>
                {[
                  { name: 'Registrations', target: selectedAgentProfile.target.registrations, achieved: selectedAgentProfile.metrics.registrations },
                  { name: 'Membership Sales', target: selectedAgentProfile.target.membershipSales, achieved: selectedAgentProfile.metrics.membershipSales },
                  { name: 'Vendor Onboarding', target: selectedAgentProfile.target.vendorOnboarding, achieved: selectedAgentProfile.metrics.vendorOnboarding },
                  { name: 'Orders Generated', target: selectedAgentProfile.target.orders, achieved: selectedAgentProfile.metrics.orders },
                  { name: 'Revenue Generated (₹)', target: selectedAgentProfile.target.revenue, achieved: selectedAgentProfile.metrics.revenue }
                ].map(t => {
                  const pct = Math.min(100, Math.round((t.achieved / (t.target || 1)) * 100));
                  return (
                    <div key={t.name} className="space-y-1.5 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                      <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                        <span>{t.name}</span>
                        <span>{t.achieved.toLocaleString()} / {t.target.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {profileTab === 'timeline' && (
              <div className="space-y-3 text-xs">
                <h4 className="font-extrabold uppercase text-slate-400 tracking-wider">Real-time Activity Timeline</h4>
                {(selectedAgentProfile.timeline || []).length > 0 ? (
                  (selectedAgentProfile.timeline || []).map((act, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                      <span className="font-mono font-bold text-primary-500 text-xs w-20">{act.time}</span>
                      <div>
                        <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{act.action}</span>
                        <span className="text-slate-400">{act.description || act.desc}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400 py-4 text-center">No activity logged for this agent yet.</p>
                )}
              </div>
            )}

            {['revenue', 'customers', 'membership', 'orders', 'bookings', 'documents', 'commission', 'attendance'].includes(profileTab) && (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-850">
                <Activity className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <h5 className="font-bold text-slate-800 dark:text-slate-200 capitalize">{profileTab} Analytics & Records</h5>
                <p className="text-xs text-slate-400 mt-1">Detailed record history for agent {selectedAgentProfile.agent.name}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
