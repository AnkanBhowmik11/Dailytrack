import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Download, Printer, FileText, Calendar, Check, AlertCircle, Plus, Search, Trash2, X } from 'lucide-react';
import EmployeeLedgerModal from './EmployeeLedgerModal';
import { generatePayrollPDF } from '../utils/generatePayrollPDF';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function PayrollEngine() {
  const sites    = useLiveQuery(() => db.sites.where('active').equals(1).toArray());
  const settings = useLiveQuery(() => db.companySettings.get('main'));

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedYear,   setSelectedYear]   = useState(new Date().getFullYear());
  const [selectedMonth,  setSelectedMonth]  = useState(new Date().getMonth() + 1);
  const [activeSlip,     setActiveSlip]     = useState(null);
  const [search, setSearch]           = useState('');
  const [paymentModalRow, setPaymentModalRow] = useState(null);

  useEffect(() => {
    if (sites?.length && !selectedSiteId) setSelectedSiteId(String(sites[0].id));
  }, [sites]);

  const employees = useLiveQuery(() => {
    if (!selectedSiteId) return Promise.resolve([]);
    return db.employees.where('siteId').equals(Number(selectedSiteId)).toArray();
  }, [selectedSiteId]);

  const attendanceRecords = useLiveQuery(() => {
    if (!selectedSiteId) return Promise.resolve([]);
    const ms = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}`;
    return db.attendance.where('date').between(`${ms}-01`,`${ms}-31`,true,true)
      .filter(r => r.siteId===Number(selectedSiteId)).toArray();
  }, [selectedSiteId, selectedYear, selectedMonth]);

  const transactions = useLiveQuery(async () => {
    if (!selectedSiteId) return [];
    const ms = `${selectedYear}-${String(selectedMonth).padStart(2,'0')}`;
    const emps = await db.employees.where('siteId').equals(Number(selectedSiteId)).toArray();
    const empIds = emps.map(e => e.id);
    return db.transactions.where('date').between(`${ms}-01`,`${ms}-31`,true,true)
      .filter(t => t.siteId===Number(selectedSiteId) || empIds.includes(t.employeeId)).toArray();
  }, [selectedSiteId, selectedYear, selectedMonth]);

  const payrollList = React.useMemo(() => {
    if (!employees || !attendanceRecords) return [];
    return employees.map(emp => {
      const recs = attendanceRecords.filter(r => r.employeeId===emp.id);
      let P=0,HD=0,A=0,L=0,ot=0;
      recs.forEach(r => { if(r.status==='P')P++; else if(r.status==='HD')HD++; else if(r.status==='A')A++; else if(r.status==='L')L++; ot+=r.otHours||0; });
      const paidDays = P + HD*0.5 + L;
      const baseWages = emp.rateType==='monthly' ? emp.baseRate : paidDays*emp.baseRate;
      const otRate = emp.otRate||(settings?.defaultOtRate||100);
      const otWages = ot*otRate;
      const gross = baseWages+otWages;
      
      const empTxns = (transactions || []).filter(t => t.employeeId === emp.id);
      const totalPaid = empTxns.reduce((a, t) => a + Number(t.amount || 0), 0);
      const dueBalance = gross - totalPaid;

      return { employee:emp,P,HD,A,paidLeaves:L,paidDays,ot,baseWages,otWages,gross,totalPaid,dueBalance,otRate,txns:empTxns };
    }).filter(row => row.employee.name.toLowerCase().includes(search.toLowerCase()));
  }, [employees, attendanceRecords, transactions, settings, search]);

  const totalNet = payrollList.reduce((a,r)=>a+r.dueBalance, 0);
  const totalOT  = payrollList.reduce((a,r)=>a+r.otWages, 0);
  const siteName = sites?.find(s=>s.id===Number(selectedSiteId))?.name||'';

  const exportExcel = () => {
    import('xlsx').then(({ utils, writeFile }) => {
      const data = payrollList.map(r=>({
        'Employee': r.employee.name,
        'Type': r.employee.rateType==='monthly'?'Monthly':'Daily',
        'Rate (₹)': r.employee.baseRate,
        'Paid Days': r.paidDays,
        'Base Pay (₹)': r.baseWages,
        'OT Hrs': r.ot,
        'OT Pay (₹)': r.otWages,
        'Gross (₹)': r.gross,
        'Total Paid (₹)': r.totalPaid,
        'Due Balance (₹)': r.dueBalance,
      }));
      const ws = utils.json_to_sheet(data);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, 'Payroll');
      writeFile(wb, `Payroll_${siteName}_${MONTHS[selectedMonth-1]}_${selectedYear}.xlsx`.replace(/\s+/g,'_'));
    });
  };

  const exportPDF = async () => {
    try {
      await generatePayrollPDF(siteName, selectedMonth, selectedYear, payrollList, totalNet);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF');
    }
  };

  const initials = (n) => n?n.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase():'?';

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Payroll</h1>
          <p className="page-sub">{MONTHS[selectedMonth-1]} {selectedYear}</p>
        </div>
        {payrollList.length>0&&(
          <div className="flex gap-2">
            <button className="btn btn--sm btn--success" onClick={exportExcel}><Download size={14}/> Excel</button>
            <button className="btn btn--sm btn--secondary" onClick={exportPDF}><Printer size={14}/> Print PDF</button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="payroll-controls no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="flex gap-2">
          <select className="select" style={{ flex: 1 }} value={selectedSiteId} onChange={e=>setSelectedSiteId(e.target.value)}>
            <option value="" disabled>Choose site…</option>
            {sites?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="search-wrap" style={{ flex: 1, margin: 0 }}>
            <Search size={16} />
            <input className="input" placeholder="Search staff…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <select className="select" style={{flex:1}} value={selectedMonth} onChange={e=>setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select className="select" style={{maxWidth:'90px'}} value={selectedYear} onChange={e=>setSelectedYear(Number(e.target.value))}>
            {[2024,2025,2026,2027,2028].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {payrollList.length>0&&(
        <div className="summary-grid no-print">
          <div className="summary-card">
            <div className="summary-card__val">₹{totalNet.toLocaleString('en-IN')}</div>
            <div className="summary-card__label">Total Payroll</div>
          </div>
          <div className="summary-card">
            <div className="summary-card__val" style={{color:'var(--c-accent)'}}>₹{totalOT.toLocaleString('en-IN')}</div>
            <div className="summary-card__label">OT Paid</div>
          </div>
          <div className="summary-card">
            <div className="summary-card__val" style={{color:'var(--c-success)'}}>{payrollList.length}</div>
            <div className="summary-card__label">Workers</div>
          </div>
        </div>
      )}

      {/* Employee rows */}
      {payrollList.length>0 ? payrollList.map(row=>(
        <div key={row.employee.id} className="payroll-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
          <div className="flex gap-3" style={{ width: '100%', alignItems: 'flex-start' }}>
            <div className="emp-card__avatar" style={{width:40,height:40,fontSize:'0.9rem',borderRadius:11}}>{initials(row.employee.name)}</div>
            <div className="payroll-row__info">
              <div className="payroll-row__name">{row.employee.name}</div>
              <div className="payroll-row__role">{row.employee.designation||'Staff'} · {row.employee.rateType==='monthly'?'Monthly':'Daily'}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className="badge badge--success">{row.P}P</span>
                {row.HD>0&&<span className="badge badge--warning">{row.HD}HD</span>}
                {row.A>0&&<span className="badge badge--danger">{row.A}A</span>}
                {row.ot>0&&<span className="badge badge--primary">{row.ot}h OT</span>}
              </div>
            </div>
            <button className="btn btn--sm btn--secondary no-print" onClick={()=>setActiveSlip(row)} title="Salary slip" style={{ padding: '8px', flexShrink: 0 }}>
              <FileText size={14}/>
            </button>
          </div>

          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--t-2)', fontWeight: 600 }}>
                Base: ₹{row.baseWages.toLocaleString('en-IN')} {row.otWages > 0 && `• OT: ₹${row.otWages.toLocaleString('en-IN')}`}
              </div>
              {row.totalPaid > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--c-success)', fontWeight: 600 }}>Paid: ₹{row.totalPaid.toLocaleString('en-IN')}</div>}
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: row.dueBalance <= 0 ? 'var(--c-success)' : 'var(--c-danger)', marginTop: 2, fontFamily: 'Outfit' }}>
                Due: ₹{row.dueBalance.toLocaleString('en-IN')}
              </div>
            </div>
            <button className="btn btn--sm btn--primary no-print" onClick={() => setPaymentModalRow(row)} style={{ flexShrink: 0 }}>
              <Plus size={14} /> Add Payment
            </button>
          </div>
        </div>
      )):(
        <div className="empty-state">
          <Calendar size={48} className="empty-state__icon"/>
          <h3>No payroll data</h3>
          <p>Select a site and make sure attendance is logged for this month.</p>
        </div>
      )}

      {/* Salary Slip Modal */}
      {activeSlip&&(
        <div className="modal-overlay no-print" onClick={()=>setActiveSlip(null)}>
          <div className="modal-sheet" style={{maxWidth:'580px',background:'#f8fafc',color:'#1e293b'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header" style={{borderBottom:'1px solid #cbd5e1'}}>
              <span className="modal-title" style={{color:'#0f172a'}}>Salary Slip</span>
              <button className="modal-close" onClick={()=>setActiveSlip(null)}>✕</button>
            </div>

            <div id="salary-slip-view" className="salary-slip-print" style={{padding:'20px',background:'white',border:'1px solid #94a3b8',borderRadius:'8px',margin:'12px 16px',fontSize:'0.84rem'}}>
              {/* Company header */}
              <div style={{display:'flex',justifyContent:'space-between',borderBottom:'2px solid #334155',paddingBottom:'12px',marginBottom:'16px',alignItems:'center'}}>
                <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
                  <img src={settings?.logo||'/icon.png'} alt="" style={{width:42,height:42,borderRadius:6,objectFit:'cover',border:'1px solid #cbd5e1'}}/>
                  <div>
                    <div style={{fontWeight:800,fontSize:'1.1rem',color:'#0f172a'}}>{settings?.name||'DailyTrack'}</div>
                    <div style={{color:'#64748b',fontSize:'0.73rem',marginTop:2,whiteSpace:'pre-line'}}>{settings?.address||''}</div>
                  </div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'0.72rem',background:'#f1f5f9',padding:'3px 8px',borderRadius:4,fontWeight:700,border:'1px solid #cbd5e1',color:'#475569'}}>PAY SLIP</div>
                  <div style={{fontSize:'0.8rem',fontWeight:700,marginTop:4,color:'#0f172a'}}>{MONTHS[selectedMonth-1]} {selectedYear}</div>
                </div>
              </div>

              {/* Info grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:'0.83rem',marginBottom:18,padding:12,background:'#f8fafc',borderRadius:6,border:'1px solid #e2e8f0'}}>
                <div>
                  <p style={{margin:'3px 0'}}><strong>Name:</strong> {activeSlip.employee.name}</p>
                  <p style={{margin:'3px 0'}}><strong>Role:</strong> {activeSlip.employee.designation}</p>
                  <p style={{margin:'3px 0'}}><strong>Pay Type:</strong> {activeSlip.employee.rateType==='monthly'?'Monthly Fixed':'Daily Wages'}</p>
                </div>
                <div>
                  <p style={{margin:'3px 0'}}><strong>Site:</strong> {siteName}</p>
                  <p style={{margin:'3px 0'}}><strong>Base Rate:</strong> ₹{activeSlip.employee.baseRate}/{activeSlip.employee.rateType==='daily'?'day':'mo'}</p>
                  <p style={{margin:'3px 0'}}><strong>OT Rate:</strong> ₹{activeSlip.otRate}/hr</p>
                </div>
              </div>

              {/* Earnings */}
              <div style={{fontWeight:800,fontSize:'0.72rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'#475569',borderBottom:'1px solid #cbd5e1',paddingBottom:4,marginBottom:10}}>Earnings</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.83rem',marginBottom:20}}>
                <thead><tr style={{background:'#f1f5f9'}}>
                  {['Description','Volume','Rate','Amount'].map((h,i)=>(
                    <th key={i} style={{textAlign:i===0?'left':'right',padding:'7px 10px',borderBottom:'1px solid #cbd5e1'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  <tr>
                    <td style={{padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>Base Wages</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>{activeSlip.employee.rateType==='monthly'?'1 Month':`${activeSlip.paidDays} days`}</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>₹{activeSlip.employee.baseRate}</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0',fontWeight:600}}>₹{activeSlip.baseWages}</td>
                  </tr>
                  <tr>
                    <td style={{padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>Overtime</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>{activeSlip.ot} hrs</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>₹{activeSlip.otRate}</td>
                    <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0',fontWeight:600}}>₹{activeSlip.otWages}</td>
                  </tr>
                  <tr style={{background:'#f8fafc',fontWeight:700}}>
                    <td colSpan={3} style={{padding:'9px 10px',borderBottom:'2px solid #cbd5e1',textTransform:'uppercase',fontSize:'0.75rem'}}>Gross Salary</td>
                    <td style={{textAlign:'right',padding:'9px 10px',borderBottom:'2px solid #cbd5e1'}}>₹{activeSlip.gross}</td>
                  </tr>
                </tbody>
              </table>

              {/* Deductions */}
              <div style={{fontWeight:800,fontSize:'0.72rem',textTransform:'uppercase',letterSpacing:'0.07em',color:'#475569',borderBottom:'1px solid #cbd5e1',paddingBottom:4,marginBottom:10}}>Payments</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.83rem',marginBottom:20}}>
                <tbody>
                  {activeSlip.txns?.map(t => (
                    <tr key={t.id}>
                      <td style={{padding:'8px 10px',borderBottom:'1px solid #e2e8f0'}}>{t.type} ({t.date})</td>
                      <td style={{textAlign:'right',padding:'8px 10px',borderBottom:'1px solid #e2e8f0',color:'#ef4444',fontWeight:600}}>− ₹{t.amount}</td>
                    </tr>
                  ))}
                  {(!activeSlip.txns || activeSlip.txns.length === 0) && (
                    <tr><td colSpan={2} style={{padding:'8px 10px',borderBottom:'1px solid #e2e8f0',color:'#94a3b8'}}>No payments recorded</td></tr>
                  )}
                </tbody>
              </table>

              {/* Net */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0f172a',color:'white',padding:'14px 16px',borderRadius:8}}>
                <span style={{fontSize:'0.88rem',fontWeight:800,textTransform:'uppercase'}}>Due Balance</span>
                <span style={{fontSize:'1.4rem',fontWeight:800,fontFamily:'Outfit'}}>₹{activeSlip.dueBalance.toLocaleString('en-IN')}</span>
              </div>

              {/* Signature */}
              <div style={{display:'flex',justifyContent:'space-between',marginTop:40,fontSize:'0.78rem'}}>
                <div style={{textAlign:'center',width:140,borderTop:'1px solid #64748b',paddingTop:6}}>Employee Signature</div>
                <div style={{textAlign:'center',width:140,borderTop:'1px solid #64748b',paddingTop:6}}>Authorized Signatory</div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn--secondary" onClick={()=>setActiveSlip(null)}>Close</button>
              <button className="btn btn--primary" onClick={()=>window.print()}><Printer size={15}/> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal / Ledger */}
      {paymentModalRow && (
        <EmployeeLedgerModal
          employee={paymentModalRow.employee}
          sites={sites}
          onClose={() => setPaymentModalRow(null)}
        />
      )}
    </div>
  );
}
