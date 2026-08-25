import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, ShieldCheck, Lock, Unlock, Users, Globe,
  Activity, AlertTriangle, RefreshCw, Key, Laptop, Smartphone,
  Terminal, Search, Eye, Filter, CheckCircle, XCircle
} from 'lucide-react';

export const SecurityDashboard = React.memo(({ token, API_BASE }) => {
  const [stats, setStats] = useState({
    activeSessionsCount: 0,
    failedLogins24h: 0,
    lockedAccountsCount: 0,
    tempLockedCount: 0,
    rateLimitEvents24h: 0,
    recentCriticalLogs: []
  });
  const [activeTab, setActiveTab] = useState('audit-logs');
  const [logs, setLogs] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [lockedUsers, setLockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState({ eventType: 'all', threatLevel: 'all', search: '' });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toastMessage, setToastMessage] = useState('');

  const headers = {
    'Content-Type': 'application/json',
    'x-auth-token': token,
    'Authorization': `Bearer ${token}`
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const fetchSecurityStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/security/dashboard-stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error('Failed to fetch security stats:', e);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page,
        limit: 15,
        eventType: logFilter.eventType,
        threatLevel: logFilter.threatLevel,
        search: logFilter.search
      }).toString();

      const res = await fetch(`${API_BASE}/security/audit-logs?${query}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotalPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Failed to fetch security logs:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/security/active-sessions`, { headers });
      if (res.ok) {
        const data = await res.json();
        setSessions(data || []);
      }
    } catch (e) {
      console.error('Failed to fetch active sessions:', e);
    }
  };

  const fetchLockedAccounts = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users?status=all`, { headers });
      if (res.ok) {
        const data = await res.json();
        const lockedList = (Array.isArray(data) ? data : data.users || []).filter(
          u => u.isLocked || (u.lockUntil && new Date(u.lockUntil) > new Date())
        );
        setLockedUsers(lockedList);
      }
    } catch (e) {
      console.error('Failed to fetch locked users:', e);
    }
  };

  useEffect(() => {
    fetchSecurityStats();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSecurityStats();
        if (activeTab === 'audit-logs') fetchLogs();
        if (activeTab === 'sessions') fetchActiveSessions();
        if (activeTab === 'locked-accounts') fetchLockedAccounts();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit-logs') fetchLogs();
    if (activeTab === 'sessions') fetchActiveSessions();
    if (activeTab === 'locked-accounts') fetchLockedAccounts();
  }, [activeTab, page, logFilter]);

  const handleRevokeSession = async (sessionId) => {
    try {
      const res = await fetch(`${API_BASE}/security/revoke-session`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) {
        showToast('Device session revoked successfully');
        fetchActiveSessions();
        fetchSecurityStats();
      }
    } catch (e) {
      console.error('Revoke session failed:', e);
    }
  };

  const handleUnlockAccount = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/security/unlock-account`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.msg || 'Account unlocked successfully');
        fetchLockedAccounts();
        fetchSecurityStats();
      }
    } catch (e) {
      console.error('Unlock account failed:', e);
    }
  };

  const getThreatBadge = (level) => {
    switch (level) {
      case 'critical':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-500 border border-rose-500/30 uppercase">CRITICAL</span>;
      case 'danger':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-500 border border-red-500/30 uppercase">DANGER</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500 border border-amber-500/30 uppercase">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 uppercase">INFO</span>;
    }
  };

  return (
    <div className="space-y-6 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* Header Toast */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cyber Security Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h2 className="text-xl font-extrabold tracking-tight">Cyber Security Control & Threat Monitoring Center</h2>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl font-medium">
            Banking-grade enterprise authentication, OWASP Top 10 threat detection, automated session management, and brute-force protection for Forge India Connect.
          </p>
        </div>

        <button
          onClick={() => { fetchSecurityStats(); fetchLogs(); }}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Security Feed
        </button>
      </div>

      {/* Security Threat Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Active Device Sessions</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Laptop className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.activeSessionsCount}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Online across all portals</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Failed Logins (24h)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-500">
            {stats.failedLogins24h}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Logins rejected by auth policy</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Locked Accounts</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-500">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-500 flex items-baseline gap-2">
            <span>{stats.lockedAccountsCount}</span>
            <span className="text-xs font-bold text-slate-400">({stats.tempLockedCount} temp)</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">10+ failed attempts locked</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Rate Limit Blocks (24h)</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-500">
            {stats.rateLimitEvents24h}
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Blocked by 5 req/min policy</p>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
        
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 overflow-x-auto">
          {[
            { id: 'audit-logs', label: 'Security Audit Logs', icon: <Terminal className="w-4 h-4" /> },
            { id: 'sessions', label: 'Active Sessions & Devices', icon: <Laptop className="w-4 h-4" /> },
            { id: 'locked-accounts', label: 'Locked Accounts', icon: <Lock className="w-4 h-4" /> },
            { id: 'security-controls', label: 'OWASP Security Controls', icon: <ShieldCheck className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: SECURITY AUDIT LOGS */}
        {activeTab === 'audit-logs' && (
          <div className="space-y-4">
            
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Filter by Email, IP, or Keywords..."
                value={logFilter.search}
                onChange={(e) => setLogFilter(prev => ({ ...prev, search: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 font-medium"
              />

              <select
                value={logFilter.threatLevel}
                onChange={(e) => setLogFilter(prev => ({ ...prev, threatLevel: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 font-medium"
              >
                <option value="all">All Threat Levels</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="danger">Danger</option>
                <option value="critical">Critical</option>
              </select>

              <select
                value={logFilter.eventType}
                onChange={(e) => setLogFilter(prev => ({ ...prev, eventType: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-primary-500 font-medium"
              >
                <option value="all">All Event Types</option>
                <option value="SUCCESSFUL_LOGIN">SUCCESSFUL_LOGIN</option>
                <option value="FAILED_LOGIN">FAILED_LOGIN</option>
                <option value="ACCOUNT_TEMP_LOCKED">ACCOUNT_TEMP_LOCKED</option>
                <option value="ACCOUNT_PERM_LOCKED">ACCOUNT_PERM_LOCKED</option>
                <option value="RATE_LIMIT_EXCEEDED">RATE_LIMIT_EXCEEDED</option>
              </select>
            </div>

            {/* Audit Logs Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <th className="p-3.5">Timestamp</th>
                    <th className="p-3.5">Event</th>
                    <th className="p-3.5">Threat Level</th>
                    <th className="p-3.5">User / Email</th>
                    <th className="p-3.5">IP Address</th>
                    <th className="p-3.5">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {logs.map((log) => (
                    <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-100">
                        {log.eventType}
                      </td>
                      <td className="p-3.5">
                        {getThreatBadge(log.threatLevel)}
                      </td>
                      <td className="p-3.5 font-semibold text-slate-700 dark:text-slate-300">
                        {log.email || 'N/A'}
                      </td>
                      <td className="p-3.5 font-mono text-xs text-primary-500">
                        {log.ipAddress}
                      </td>
                      <td className="p-3.5 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                        {log.details || 'No additional log payload'}
                      </td>
                    </tr>
                  ))}

                  {logs.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400 font-semibold">
                        No security audit logs found matching selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 2: ACTIVE SESSIONS */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((sess) => (
                <div key={sess._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                        <Laptop className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{sess.deviceName || 'Web Browser'}</h4>
                        <p className="text-xs text-slate-400">{sess.email} ({sess.userId?.role || 'user'})</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeSession(sess._id)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-[11px] font-bold rounded-xl transition cursor-pointer"
                    >
                      Revoke Session
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/50 dark:border-slate-800">
                    <div>
                      <span className="text-slate-400 block text-[10px]">IP ADDRESS</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{sess.ipAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">LAST ACTIVE</span>
                      <span className="text-slate-700 dark:text-slate-300 font-semibold">{new Date(sess.lastActive).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="col-span-2 p-8 text-center text-slate-400 font-semibold">
                  No active device sessions found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: LOCKED ACCOUNTS */}
        {activeTab === 'locked-accounts' && (
          <div className="space-y-4">
            <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              {lockedUsers.map((user) => (
                <div key={user._id} className="p-4 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{user.name} ({user.email})</h4>
                      <p className="text-xs text-rose-500 font-semibold">
                        {user.isLocked ? 'Permanently Locked (10+ Failed Attempts)' : `Temporarily Locked until ${new Date(user.lockUntil).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUnlockAccount(user._id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5" /> Unlock Account
                  </button>
                </div>
              ))}

              {lockedUsers.length === 0 && (
                <div className="p-8 text-center text-slate-400 font-semibold">
                  No accounts currently locked out.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: OWASP SECURITY CONTROLS */}
        {activeTab === 'security-controls' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { title: 'HTTP Security Headers (Helmet)', desc: 'X-Frame-Options: DENY, X-XSS-Protection, Strict-Transport-Security (HSTS), CSP enabled.', status: 'ACTIVE' },
              { title: 'Anti NoSQL Injection Sanitizer', desc: 'Strips $, $gt, $ne MongoDB query operators and <script> tags on all request payloads.', status: 'ACTIVE' },
              { title: 'Auth Rate Limiter', desc: 'Restricts /auth/login, /auth/register, /auth/send-otp to 5 requests per minute per IP.', status: 'ACTIVE' },
              { title: 'Bcrypt 12 Salt Rounds Hashing', desc: 'Enforces banking-grade password encryption with minimum 12 salt rounds.', status: 'ACTIVE' },
              { title: 'Progressive Account Lockout Policy', desc: '1st failed = Warning, 3rd = CAPTCHA, 5th = 15m Lock, 10th = Full Lock.', status: 'ACTIVE' },
              { title: 'Dual Token Architecture', desc: 'Short-lived JWT Access Token + HTTP-Only SameSite Refresh Cookie rotation.', status: 'ACTIVE' }
            ].map((ctrl, i) => (
              <div key={i} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 shrink-0">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{ctrl.title}</h4>
                    <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-md">{ctrl.status}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{ctrl.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
});

export default SecurityDashboard;
