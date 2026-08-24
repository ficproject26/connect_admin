import React, { useState, useEffect } from 'react';
import {
  DollarSign, Users, Award, Download, Plus, Filter, Search, RefreshCw,
  CheckCircle, Clock, FileText, Calculator, ChevronRight, X
} from 'lucide-react';

export const PayrollManagement = React.memo(({ token, API_BASE }) => {
  const [loading, setLoading] = useState(false);
  const [payrolls, setPayrolls] = useState([]);
  const [kpi, setKpi] = useState({
    totalSalary: 0,
    commissionPaid: 0,
    bonusPaid: 0,
    pendingSalary: 0,
    currentMonthPayroll: 0
  });

  const [showGenerateModal, setShowGenerateModal] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [employeeType, setEmployeeType] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchPayrollData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        search,
        department,
        role: roleFilter,
        employeeType,
        status
      });

      const res = await fetch(`${API_BASE}/admin/enterprise/payroll?${query.toString()}`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data.payrolls || []);
        if (data.kpi) setKpi(data.kpi);
      }
    } catch (err) {
      console.error('Fetch payroll error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollData();
  }, [search, department, roleFilter, employeeType, status]);

  const handleGenerateSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payroll/generate`, {
        method: 'POST',
        headers: {
          'x-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setShowGenerateModal(false);
        fetchPayrollData();
      }
    } catch (err) {
      console.error('Generate payroll error:', err);
    }
  };

  return (
    <div className="space-y-6 pb-16">

      {/* 1. HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Payroll Management</h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
              HR & Payroll
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Automated salary calculations, bonus disbursements, commissions, PF/ESI tax deductions, and payroll reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" /> Process Payroll
          </button>
          <button onClick={fetchPayrollData} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl hover:bg-slate-200 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. PAYROLL KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Salary Outflow</span>
          <span className="block text-2xl font-black text-slate-800 dark:text-slate-100">₹{(kpi.totalSalary || 0).toLocaleString()}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">Commission Paid</span>
          <span className="block text-2xl font-black text-amber-600 dark:text-amber-400">₹{(kpi.commissionPaid || 0).toLocaleString()}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-500">Current Month Payroll</span>
          <span className="block text-2xl font-black text-purple-600 dark:text-purple-400">₹{(kpi.currentMonthPayroll || 0).toLocaleString()}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Pending Salary</span>
          <span className="block text-2xl font-black text-rose-600 dark:text-rose-400">₹{(kpi.pendingSalary || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* 3. FILTERS TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-850 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              placeholder="Search Employee Name or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent focus:outline-none w-full text-slate-800 dark:text-slate-200 font-medium"
            />
          </div>

          <select
            value={employeeType}
            onChange={e => {
              setEmployeeType(e.target.value);
              if (e.target.value === 'Agent') {
                setDepartment('all');
              }
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="Employee">Employees</option>
            <option value="Agent">Agents</option>
            <option value="Commission Based">Commission Based</option>
          </select>

          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs px-3 py-2 font-semibold focus:outline-none"
          >
            <option value="all">All Departments</option>
            {employeeType === 'Agent' ? (
              <option value="Agent Operations">Agent Operations</option>
            ) : (
              <>
                <option value="Customer Support">Customer Support</option>
                <option value="KYC Team">KYC Team</option>
                <option value="Payment Team">Payment Team</option>
                <option value="Agent Operations">Agent Operations</option>
              </>
            )}
          </select>
        </div>

        <span className="text-xs font-bold text-slate-400">Total Records: <strong>{payrolls.length}</strong></span>
      </div>

      {/* 4. PAYROLL TABLE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase text-slate-400 tracking-wider">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-4">Type & Dept</th>
              <th className="py-3 px-4">Base Salary</th>
              <th className="py-3 px-4">Commission</th>
              <th className="py-3 px-4">PF / Tax / Deductions</th>
              <th className="py-3 px-4">Net Salary</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-xs">
            {payrolls.map(p => (
              <tr key={p._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40">
                <td className="py-3 px-4">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 block">{p.employeeName}</span>
                  <span className="text-[11px] text-slate-400 font-mono">{p.employeeCode}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">{p.role}</span>
                  <span className="text-[11px] text-slate-400">{p.department} ({p.employeeType})</span>
                </td>
                <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                  ₹{(p.salary || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-emerald-600 font-bold">
                  +₹{(p.commission || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-rose-500 font-bold">
                  -₹{((p.pf || 0) + (p.esi || 0) + (p.professionalTax || 0) + (p.deduction || 0)).toLocaleString()}
                </td>
                <td className="py-3 px-4 font-black text-sm text-slate-900 dark:text-slate-100">
                  ₹{(p.netSalary || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    p.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' :
                    'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                  }`}>
                    {p.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}

            {payrolls.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  <Calculator className="w-10 h-10 text-cyan-500 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold">No payroll records found.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. PROCESS PAYROLL MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Process & Generate Payroll</h3>
              <button onClick={() => setShowGenerateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 uppercase mb-1">Employee Name</label>
                <input name="employeeName" required type="text" placeholder="e.g. Rahul Sharma" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Employee Type</label>
                  <select name="employeeType" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-semibold">
                    <option value="Employee">Employee</option>
                    <option value="Agent">Agent</option>
                    <option value="Commission Based">Commission Based</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Department</label>
                  <select name="department" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-semibold">
                    <option value="Customer Support">Customer Support</option>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Payment Team">Payment Team</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Base Salary (₹)</label>
                  <input name="salary" type="number" defaultValue="35000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Bonus (₹)</label>
                  <input name="bonus" type="number" defaultValue="5000" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Commission (₹)</label>
                  <input name="commission" type="number" defaultValue="2500" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">PF (₹)</label>
                  <input name="pf" type="number" defaultValue="1800" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">ESI (₹)</label>
                  <input name="esi" type="number" defaultValue="500" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
                <div>
                  <label className="block font-bold text-slate-400 uppercase mb-1">Deduction (₹)</label>
                  <input name="deduction" type="number" defaultValue="0" className="w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-2.5 text-xs font-medium" />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button type="button" onClick={() => setShowGenerateModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 bg-primary-600 text-white font-extrabold rounded-xl shadow-md cursor-pointer">
                  Generate Payroll
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
});
