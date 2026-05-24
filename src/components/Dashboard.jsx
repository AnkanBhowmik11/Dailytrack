import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Building, Users, Calendar, Award, Receipt, Clock, Activity, ArrowUpRight } from 'lucide-react';

export default function Dashboard({ setActiveTab }) {
  const sites = useLiveQuery(() => db.sites.where('active').equals(1).toArray());
  const employees = useLiveQuery(() => db.employees.where('active').equals(1).toArray());
  const invoices = useLiveQuery(() => db.invoices.toArray());
  
  // Date definitions
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const monthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

  // Query today's attendance records
  const todayAttendance = useLiveQuery(() => db.attendance.where('date').equals(todayStr).toArray());

  // Query current month's attendance records to calculate accrued labor costs
  const monthAttendance = useLiveQuery(() => {
    return db.attendance
      .where('date')
      .between(`${monthStr}-01`, `${monthStr}-31`, true, true)
      .toArray();
  }, [monthStr]);

  // Calculations for real-time widgets
  const stats = React.useMemo(() => {
    const sitesCount = sites ? sites.length : 0;
    const workersCount = employees ? employees.length : 0;
    
    // Attendance rate
    let todayPresentRate = 0;
    let presentCount = 0;
    let halfDayCount = 0;
    
    if (todayAttendance && workersCount > 0) {
      todayAttendance.forEach(r => {
        if (r.status === 'P' || r.status === 'L') presentCount++;
        else if (r.status === 'HD') halfDayCount++;
      });
      const activeUnitsPresent = presentCount + (halfDayCount * 0.5);
      todayPresentRate = Math.round((activeUnitsPresent / workersCount) * 100);
    }

    // Month-to-date Accrued Wages
    let accruedLaborCost = 0;
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const elapsedDays = new Date().getDate();

    if (employees && monthAttendance) {
      employees.forEach(emp => {
        const empRecs = monthAttendance.filter(r => r.employeeId === emp.id);
        
        let present = 0;
        let half = 0;
        let leave = 0;
        let otHours = 0;

        empRecs.forEach(r => {
          if (r.status === 'P') present++;
          else if (r.status === 'HD') half++;
          else if (r.status === 'L') leave++;
          otHours += r.otHours || 0;
        });

        // OT Earnings
        const otPay = otHours * (emp.otRate || 100);

        // Base wage earnings accrued
        let basePay = 0;
        if (emp.rateType === 'monthly') {
          // Pro-rate monthly fixed salary up to today
          basePay = (emp.baseRate / daysInMonth) * elapsedDays;
        } else {
          // Daily wages summed from actual logs
          const paidDays = present + (half * 0.5) + leave;
          basePay = paidDays * emp.baseRate;
        }

        accruedLaborCost += (basePay + otPay);
      });
    }

    return {
      sitesCount,
      workersCount,
      todayPresentRate,
      presentCount,
      halfDayCount,
      absentCount: todayAttendance ? todayAttendance.filter(r => r.status === 'A').length : 0,
      accruedLaborCost: Math.round(accruedLaborCost)
    };
  }, [sites, employees, todayAttendance, monthAttendance, currentYear, currentMonth]);

  // Density metrics for progress bars: counts per site
  const siteDensityList = React.useMemo(() => {
    if (!sites || !employees) return [];
    
    return sites.map(s => {
      const staffCount = employees.filter(e => e.siteId === s.id).length;
      return { site: s, count: staffCount };
    }).sort((a, b) => b.count - a.count);
  }, [sites, employees]);

  const recentInvoices = invoices ? invoices.slice(-3).reverse() : [];

  return (
    <div className="dashboard-home">
      <div className="header-bar">
        <div className="header-title-group">
          <h1>Analytics Dashboard</h1>
          <p>Real-time metrics, cumulative operations summary, and active work site monitoring.</p>
        </div>
      </div>

      {/* Grid widgets KPI */}
      <div className="stats-grid">
        {/* Metric 1 */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #4f46e5, #6366f1)', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.3)' }}>
            <Building size={24} />
          </div>
          <div className="stat-details">
            <h3>Active Sites</h3>
            <div className="stat-value">{stats.sitesCount}</div>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', boxShadow: '0 4px 15px rgba(14, 165, 233, 0.3)' }}>
            <Users size={24} />
          </div>
          <div className="stat-details">
            <h3>Total Manpower</h3>
            <div className="stat-value">{stats.workersCount}</div>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-details">
            <h3>Today's Attendance</h3>
            <div className="stat-value">{stats.todayPresentRate}%</div>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)' }}>
            <Award size={24} />
          </div>
          <div className="stat-details">
            <h3>Month-to-Date Cost</h3>
            <div className="stat-value">₹{stats.accruedLaborCost.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        
        {/* Site Labor Distribution Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} className="text-primary" /> Active Work Site Density
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Proportion of workforce distribution across your client's active construction/project sites.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '10px' }}>
            {siteDensityList.length > 0 ? (
              siteDensityList.map((item, idx) => {
                const totalWorkers = stats.workersCount || 1;
                const percentage = Math.round((item.count / totalWorkers) * 100);
                
                return (
                  <div key={item.site.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: '500' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{idx + 1}. {item.site.name}</span>
                      <span style={{ color: 'var(--color-primary)' }}>{item.count} Workers ({percentage}%)</span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${percentage}%`, 
                        background: 'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                        boxShadow: '0 0 10px var(--color-primary)',
                        borderRadius: '4px'
                      }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No active work sites registered.
              </div>
            )}
          </div>
        </div>

        {/* Daily Attendance Analytics Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={20} className="text-secondary" /> Today's Attendance Summary
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Visual breakdown of logs logged for employees today.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            {/* Visual SVG Donut/Track bar */}
            <div style={{ display: 'flex', gap: '8px', height: '24px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
              {stats.presentCount > 0 && <div style={{ flexGrow: stats.presentCount, background: 'var(--color-success)', title: 'Present' }} />}
              {stats.halfDayCount > 0 && <div style={{ flexGrow: stats.halfDayCount * 0.5, background: 'var(--color-warning)', title: 'Half Day' }} />}
              {stats.absentCount > 0 && <div style={{ flexGrow: stats.absentCount, background: 'var(--color-danger)', title: 'Absent' }} />}
              {!todayAttendance || todayAttendance.length === 0 ? (
                <div style={{ flexGrow: 1, background: 'rgba(255,255,255,0.03)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '22px' }}>
                  No Daily Logs Logged Yet
                </div>
              ) : null}
            </div>

            {/* Legend indicators */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="status-dot" style={{ background: 'var(--color-success)', boxShadow: 'none' }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Present (Full Duty)</div>
                  <strong style={{ fontSize: '1rem' }}>{stats.presentCount} Workers</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="status-dot" style={{ background: 'var(--color-warning)', boxShadow: 'none' }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Half Duty (0.5 wages)</div>
                  <strong style={{ fontSize: '1rem' }}>{stats.halfDayCount} Workers</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="status-dot" style={{ background: 'var(--color-danger)', boxShadow: 'none' }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Absent / No Duty</div>
                  <strong style={{ fontSize: '1rem' }}>{stats.absentCount} Workers</strong>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="status-dot" style={{ background: 'var(--color-info)', boxShadow: 'none' }} />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unlogged Workforce</div>
                  <strong style={{ fontSize: '1rem' }}>
                    {Math.max(0, stats.workersCount - (todayAttendance ? todayAttendance.length : 0))} Workers
                  </strong>
                </div>
              </div>
            </div>
            
            <button className="btn btn-secondary" onClick={() => setActiveTab('attendance')} style={{ width: '100%', display: 'inline-flex', gap: '8px' }}>
              Go to Daily Attendance Board <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent Invoices Widget */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Receipt size={20} className="text-success" /> Recent GST Bills Created
        </h2>
        
        {recentInvoices.length > 0 ? (
          <div className="table-container" style={{ border: 'none', background: 'transparent', margin: '0' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Billed Client</th>
                  <th>Issue Date</th>
                  <th style={{ textAlign: 'right' }}>Grand Total (₹)</th>
                  <th style={{ textAlign: 'center' }}>Tax Type</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: '700', color: 'var(--color-primary)' }}>{inv.invoiceNumber}</td>
                    <td style={{ fontWeight: '600' }}>{inv.clientName}</td>
                    <td>{inv.date}</td>
                    <td style={{ textAlign: 'right', fontWeight: '800', fontFamily: 'Outfit', color: 'var(--color-success)' }}>
                      ₹{inv.total.toLocaleString('en-IN')}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-info">{inv.gstType === 'igst' ? 'IGST 18%' : 'CGST/SGST'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            No GST bills generated yet. Go to GST Invoicing to create your first client bill.
          </div>
        )}
      </div>
    </div>
  );
}
