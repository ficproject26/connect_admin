import React, { useState, useEffect } from 'react';
import {
  Users, UserCheck, Shield, Plus, Headphones, ChevronRight, RefreshCw,
  Mail, Phone, Calendar, DollarSign, Award, Layers, X
} from 'lucide-react';

export const CustomerSupportTeamManagement = ({ token, API_BASE }) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [hierarchy, setHierarchy] = useState({
    'Customer Support': { manager: null, teamLeaders: [], staff: [] },
    'KYC Team': { manager: null, teamLeaders: [], staff: [] },
    'Payment Team': { manager: null, teamLeaders: [], staff: [] }
  });

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState('Staff');
  const [selectedDept, setSelectedDept] = useState('Customer Support');

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/support-team/hierarchy`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
        if (data.hierarchy) setHierarchy(data.hierarchy);
      }
    } catch (err) {
      console.error('Fetch support team error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/support-team/onboard`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowOnboardModal(false);
        fetchTeamData();
      }
    } catch (err) {
      console.error('Onboard employee error:', err);
    }
  };

  const availableTLs = (hierarchy[selectedDept]?.teamLeaders || []);

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Customer Support & Team Hierarchy</h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
              Operations
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Organize Customer Support, KYC, and Payment Teams into clear Manager ➔ Team Leader ➔ Staff hierarchies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowOnboardModal(true)}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Onboard Employee
          </button>
          <button onClick={fetchTeamData} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-200 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. TEAM HIERARCHY DASHBOARD */}
      {['Customer Support', 'KYC Team', 'Payment Team'].map(dept => {
        const deptData = hierarchy[dept] || { manager: null, teamLeaders: [], staff: [] };

        return (
          <div key={dept} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">{dept} Department</h3>
                  <span className="text-xs text-slate-400 font-medium">
                    {(deptData.teamLeaders.length + deptData.staff.length + (deptData.manager ? 1 : 0))} Team Members
                  </span>
                </div>
              </div>
            </div>

            {/* LEVEL 1: MANAGER */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">Department Manager</span>
              {deptData.manager ? (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-between max-w-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black flex items-center justify-center text-base">
                      {deptData.manager.name[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">{deptData.manager.name}</h4>
                      <p className="text-xs text-slate-500">{deptData.manager.email} • {deptData.manager.phone}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-600 text-white">Manager</span>
                </div>
              ) : (
                <div className="p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 font-semibold max-w-xl">
                  No Manager assigned yet for {dept}
                </div>
              )}
            </div>

            {/* LEVEL 2: TEAM LEADERS */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Team Leaders ({deptData.teamLeaders.length})</span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {deptData.teamLeaders.map(tl => (
                  <div key={tl._id} className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{tl.name}</span>
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-600 text-white">TL</span>
                    </div>
                    <p className="text-xs text-slate-500">{tl.email} • {tl.phone}</p>
                    <span className="text-[10px] text-slate-400 block font-mono">ID: {tl.employeeId}</span>
                  </div>
                ))}
                {deptData.teamLeaders.length === 0 && (
                  <div className="p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 col-span-full">
                    No Team Leaders in this department.
                  </div>
                )}
              </div>
            </div>

            {/* LEVEL 3: STAFF MEMBERS */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Staff Members ({deptData.staff.length})</span>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {deptData.staff.map(s => (
                  <div key={s._id} className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-850 rounded-2xl space-y-1">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-200 block">{s.name}</span>
                    <span className="text-[11px] text-slate-400 block truncate">{s.email}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">ID: {s.employeeId}</span>
                  </div>
                ))}
                {deptData.staff.length === 0 && (
                  <div className="p-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-xs text-slate-400 col-span-full">
                    No Staff members assigned.
                  </div>
                )}
              </div>
            </div>

          </div>
        );
      })}

      {/* 3. ONBOARD EMPLOYEE MODAL DIALOG WITH CONDITIONAL FIELD RENDERING */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Onboard Support Employee</h3>
                <p className="text-xs text-slate-400">Add Team Leaders or Staff to Customer Support Operations</p>
              </div>
              <button onClick={() => setShowOnboardModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOnboardSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Full Name</label>
                <input name="name" required type="text" placeholder="e.g. Priya Sharma" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Email Address</label>
                  <input name="email" required type="email" placeholder="priya@connect.in" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Phone Number</label>
                  <input name="phone" required type="text" placeholder="9876543210" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
              </div>

              {/* DESIGNATION SELECTOR */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Designation Role</label>
                  <select
                    name="designation"
                    value={selectedDesignation}
                    onChange={e => setSelectedDesignation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-bold text-primary-600"
                  >
                    <option value="Staff">Staff</option>
                    <option value="Team Leader">Team Leader</option>
                    <option value="Manager">Manager</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Assign Team / Department</label>
                  <select
                    name="department"
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-bold"
                  >
                    <option value="Customer Support">Customer Support</option>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Payment Team">Payment Team</option>
                  </select>
                </div>
              </div>

              {/* CONDITIONAL RENDERING IF STAFF SELECTED */}
              {selectedDesignation === 'Staff' && (
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Assign Reporting Team Leader</label>
                  <select name="reportingTL" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium">
                    <option value="">Select Team Leader</option>
                    {availableTLs.map(tl => (
                      <option key={tl._id} value={tl._id}>{tl.name} ({tl.employeeId})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Monthly Salary (₹)</label>
                  <input name="salary" type="number" defaultValue="28000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Joining Date</label>
                  <input name="joiningDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowOnboardModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-primary-600 text-white font-extrabold rounded-xl shadow-md cursor-pointer">
                  Onboard Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
