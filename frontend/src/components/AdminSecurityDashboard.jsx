import React, { useState, useEffect } from 'react';
import {
  Shield, ShieldAlert, Lock, Unlock, Key, UserCheck, AlertTriangle, Activity,
  Smartphone, Monitor, Globe, RefreshCw, Trash2, CheckCircle, Search, Filter,
  Clock, Eye, Server, Cpu
} from 'lucide-react';

export const AdminSecurityDashboard = React.memo(({ token, API_BASE }) => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // overview, sessions, locked, logs

  // Filters for Audit Logs
  const [logActionFilter, setLogActionFilter] = useState('all');
  const [logStatusFilter, setLogStatusFilter] = useState('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Overview
      const resOverview = await fetch(`${API_BASE}/admin/security/overview`, {
        headers: { 'x-auth-token': token }
      });
      if (resOverview.ok) {
        const data = await resOverview.json();
        setOverview(data);
      }

      // 2. Fetch Sessions
      const resSessions = await fetch(`${API_BASE}/admin/security/sessions`, {
        headers: { 'x-auth-token': token }
      });
      if (resSessions.ok) {
        const data = await resSessions.json();
        setSessions(data);
      }

      // 3. Fetch Audit Logs
      const query = new URLSearchParams({
        action: logActionFilter,
        status: logStatusFilter,
        search: logSearchQuery,
        limit: 50
      });
      const resLogs = await fetch(`${API_BASE}/admin/security/logs?${query.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data);
      }

    } catch (err) {
      console.error('Fetch security data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData();
  }, [logActionFilter, logStatusFilter, logSearchQuery]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSecurityData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Unlock Account Handler
  const handleUnlockAccount = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/security/unlock-account`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        fetchSecurityData();
      }
    } catch (err) {
      console.error('Unlock account error:', err);
    }
  };

  // Terminate Session Handler
  const handleTerminateSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/security/terminate-session`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        fetchSecurityData();
      }
    } catch (err) {
      console.error('Terminate session error:', err);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. TOP SECURITY HEADER */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 shadow-xs">
            <Shield className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black tracking-tight">DevSecOps Security Dashboard</h2>
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                OWASP Hardened
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-1">
              Enterprise Threat Detection, Brute-Force Shield, Session Hijack Prevention & Audit Logging
            </p>
          </div>
        </div>

        <button
          onClick={fetchSecurityData}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl border border-slate-700 transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh Security Audit
        </button>
      </div>

      {/* 2. SECURITY KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Active Online Sessions */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-blue-500">
            <UserCheck className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-full">Live</span>
          </div>
          <span className="block text-3xl font-black text-slate-800 dark:text-slate-100">{overview?.activeSessions || 0}</span>
          <span className="block text-xs text-slate-400 font-semibold">Active Device Sessions</span>
        </div>

        {/* Card 2: Failed Logins Today */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-amber-500">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">Today</span>
          </div>
          <span className="block text-3xl font-black text-slate-800 dark:text-slate-100">{overview?.failedLoginsToday || 0}</span>
          <span className="block text-xs text-slate-400 font-semibold">Failed Login Attempts</span>
        </div>

        {/* Card 3: Locked Accounts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-rose-500">
            <Lock className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-full">Locked</span>
          </div>
          <span className="block text-3xl font-black text-slate-800 dark:text-slate-100">{overview?.lockedAccountsCount || 0}</span>
          <span className="block text-xs text-slate-400 font-semibold">Accounts Locked (Brute-force)</span>
        </div>

        {/* Card 4: Suspicious Activity / Threats */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex justify-between items-center text-purple-500">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-wider bg-purple-500/10 px-2 py-0.5 rounded-full">Blocked</span>
          </div>
          <span className="block text-3xl font-black text-slate-800 dark:text-slate-100">{overview?.suspiciousActivityCount || 0}</span>
          <span className="block text-xs text-slate-400 font-semibold">Threats & Rate Limit Blocks</span>
        </div>
      </div>

      {/* 3. TABS SWITCHER */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4">
        {[
          { id: 'overview', label: 'Active Sessions', count: sessions.length },
          { id: 'locked', label: 'Locked Accounts', count: overview?.lockedUsers?.length || 0 },
          { id: 'logs', label: 'Security Audit Stream', count: logs.length }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`pb-3 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === t.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black">
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: ACTIVE DEVICE SESSIONS */}
      {activeTab === 'overview' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-500" /> Active Multi-Device Sessions
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {sessions.map(s => (
              <div key={s._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-850/40 px-3 rounded-2xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl">
                    {s.deviceInfo?.deviceType === 'Mobile' ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{s.userId?.name || 'User'}</span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                        {s.userId?.role || 'user'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {s.userId?.email} • {s.deviceInfo?.os} ({s.deviceInfo?.browser})
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mt-1">
                      <span>IP: {s.ipAddress}</span>
                      <span>•</span>
                      <span>Last Active: {new Date(s.lastActive).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleTerminateSession(s._id)}
                  className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-extrabold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Terminate Session
                </button>
              </div>
            ))}

            {sessions.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">No active sessions logged right now.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: LOCKED ACCOUNTS */}
      {activeTab === 'locked' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-5 h-5 text-rose-500" /> Locked User Accounts (Brute-force Shield)
            </h3>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-850">
            {(overview?.lockedUsers || []).map(u => (
              <div key={u._id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 px-3 rounded-2xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">{u.name}</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                      {u.isLocked ? 'Hard Locked (10+ Attempts)' : 'Temp Locked (15m)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{u.email} • Failed Attempts: <strong className="text-rose-500">{u.failedLoginAttempts || 5}</strong></p>
                </div>

                <button
                  onClick={() => handleUnlockAccount(u._id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Unlock className="w-3.5 h-3.5" /> Unlock Account
                </button>
              </div>
            ))}

            {(overview?.lockedUsers || []).length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-bold">No accounts are currently locked.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOGS STREAM */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" /> Security Audit Log Stream
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logActionFilter}
                onChange={e => setLogActionFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs p-2 font-semibold focus:outline-none"
              >
                <option value="all">All Actions</option>
                <option value="login_success">Login Success</option>
                <option value="login_failed">Login Failed</option>
                <option value="account_locked">Account Locked</option>
                <option value="otp_sent">OTP Sent</option>
                <option value="otp_verify">OTP Verify</option>
                <option value="suspicious_activity">Suspicious Activity</option>
              </select>

              <div className="flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="Search Email, IP, details..."
                  value={logSearchQuery}
                  onChange={e => setLogSearchQuery(e.target.value)}
                  className="bg-transparent text-xs w-36 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">User / Email</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs font-mono">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {log?.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-sans font-bold">
                      {log.userEmail || log.userId?.email || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {log.ipAddress}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        log.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                        log.status === 'blocked' ? 'bg-rose-500/10 text-rose-500' :
                        'bg-amber-500/10 text-amber-500'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500 text-xs">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
});
