import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, Shield, Download,
  Filter, Calendar, RefreshCw, BarChart2, PieChart as PieIcon, Layers, FileText
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

export const EnterprisePaymentDashboard = React.memo(({ token, API_BASE }) => {
  const [loading, setLoading] = useState(false);
  const [kpi, setKpi] = useState({
    totalRevenue: 0,
    todayRevenue: 0,
    monthlyRevenue: 0,
    customerPayments: 0,
    vendorRegFees: 0,
    vendorTieupFees: 0,
    membershipRevenue: 0,
    agentFees: 0,
    commissionPaid: 0,
    salaryPaid: 0,
    expenses: 0,
    balance: 0,
    pendingPayments: 0
  });

  const fetchPaymentKPIs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/enterprise/payments/kpi`, {
        headers: { 'x-auth-token': token }
      });
      if (res.ok) {
        const data = await res.json();
        setKpi(data);
      }
    } catch (err) {
      console.error('Fetch payment KPI error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentKPIs();

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchPaymentKPIs();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Trend Chart Data dynamically calculated from real KPI
  const revenueTrendData = [
    { month: 'Current', revenue: kpi.totalRevenue || 0, expenses: kpi.expenses || 0, commission: kpi.commissionPaid || 0 }
  ];

  const paymentDistributionData = [
    { name: 'Customer Payments', value: kpi.customerPayments || 0, color: '#10b981' },
    { name: 'Vendor Reg Fees', value: kpi.vendorRegFees || 0, color: '#3b82f6' },
    { name: 'Vendor Tie-up Fees', value: kpi.vendorTieupFees || 0, color: '#f59e0b' },
    { name: 'Membership Revenue', value: kpi.membershipRevenue || 0, color: '#8b5cf6' },
    { name: 'Agent Fees', value: kpi.agentFees || 0, color: '#ec4899' }
  ];

  const exportReport = (format) => {
    alert(`Exporting Enterprise Payment Report in ${format} format...`);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. HEADER & EXPORT TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Enterprise Payment Dashboard</h2>
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              Financial Suite
            </span>
          </div>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Real-time cash flow monitoring, revenue distribution, payroll disbursements, and automated financial auditing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => exportReport('CSV')} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => exportReport('Excel')} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer">
            <FileText className="w-3.5 h-3.5" /> Excel
          </button>
          <button onClick={() => exportReport('PDF')} className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200 flex items-center gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button onClick={fetchPaymentKPIs} className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. 13 KPI SUMMARY CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Revenue', val: kpi.totalRevenue, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: "Today's Revenue", val: kpi.todayRevenue, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: 'Monthly Revenue', val: kpi.monthlyRevenue, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Customer Payments', val: kpi.customerPayments, color: 'text-teal-500', bg: 'bg-teal-500/10' },
          { label: 'Vendor Reg Fees', val: kpi.vendorRegFees, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
          { label: 'Vendor Tie-up Fees', val: kpi.vendorTieupFees, color: 'text-amber-600', bg: 'bg-amber-500/10' },
          { label: 'Membership Revenue', val: kpi.membershipRevenue, color: 'text-purple-500', bg: 'bg-purple-500/10' },
          { label: 'Agent Fees', val: kpi.agentFees, color: 'text-pink-500', bg: 'bg-pink-500/10' },
          { label: 'Commission Paid', val: kpi.commissionPaid, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          { label: 'Salary Paid', val: kpi.salaryPaid, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
          { label: 'Expenses', val: kpi.expenses, color: 'text-rose-500', bg: 'bg-rose-500/10' },
          { label: 'Net Balance', val: kpi.balance, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Pending Payments', val: kpi.pendingPayments, color: 'text-amber-500', bg: 'bg-amber-500/10' }
        ].map((card, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-3.5 space-y-1 shadow-xs">
            <span className="text-[10px] font-black uppercase text-slate-400 block truncate">{card.label}</span>
            <span className={`text-base font-black ${card.color} block tracking-tight`}>₹{(card.val || 0).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* 3. CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Trend Area Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" /> Revenue & Expense Trends
            </h3>
            <span className="text-xs font-bold text-slate-400">Monthly Cash Flow</span>
          </div>

          <div className="h-64 min-h-[256px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 256 }}>
              <AreaChart data={revenueTrendData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b98120" strokeWidth={3} name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="#f43f5e10" strokeWidth={2} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Distribution Pie Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
          <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <PieIcon className="w-5 h-5 text-purple-500" /> Payment Distribution
          </h3>

          <div className="h-48 min-h-[192px] w-full min-w-0 flex justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 300, height: 192 }}>
              <PieChart>
                <Pie data={paymentDistributionData} innerRadius={45} outerRadius={70} paddingAngle={4} dataKey="value">
                  {paymentDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-850">
            {paymentDistributionData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">₹{(item.value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
});
