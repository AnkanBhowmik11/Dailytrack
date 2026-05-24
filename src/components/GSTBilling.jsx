import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  FileText, Plus, Trash2, Printer, Save, Check, AlertCircle,
  Download, Receipt, Building2, IndianRupee, Zap, Eye, X
} from 'lucide-react';
import { pushRecordToCloud, deleteRecordInCloud } from '../sync';
import GenerateInvoiceModal from './GenerateInvoiceModal';

export default function GSTBilling() {
  const sites    = useLiveQuery(() => db.sites.where('active').equals(1).toArray());
  const settings = useLiveQuery(() => db.companySettings.get('main'));
  const invoices = useLiveQuery(() => db.invoices.orderBy('date').reverse().toArray());

  const [activeTab, setActiveTab] = useState('create');

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [invoiceNumber, setInvoiceNumber]   = useState('');
  const [date, setDate]                     = useState(new Date().toISOString().slice(0, 10));
  const [clientName, setClientName]         = useState('');
  const [clientAddress, setClientAddress]   = useState('');
  const [clientGstin, setClientGstin]       = useState('');
  const [items, setItems]                   = useState([
    { description: 'Manpower Supply Services', hsn: '998513', quantity: 1, unit: 'LumpSum', rate: 15000 }
  ]);
  const [gstType, setGstType]   = useState('cgst-sgst');
  const [gstRate, setGstRate]   = useState(18);
  const [printingInvoice, setPrintingInvoice] = useState(null);
  const [toast, setToast]               = useState(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isWordModal, setIsWordModal]   = useState(false);
  const [wordPayroll, setWordPayroll]   = useState([]);

  useEffect(() => {
    if (!invoiceNumber) {
      const year  = new Date().getFullYear();
      const count = invoices ? invoices.length + 1 : 1;
      setInvoiceNumber(`DT/${year}/${String(count).padStart(4,'0')}`);
    }
  }, [invoices]);

  useEffect(() => {
    if (settings) setGstRate(settings.defaultGstRate || 18);
  }, [settings]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSiteChange = (sId) => {
    setSelectedSiteId(sId);
    const site = sites?.find(s => s.id === Number(sId));
    if (site) {
      setClientName(site.name);
      setClientAddress(site.location + `\nSupervisor: ${site.supervisor || ''}`);
      setClientGstin('');
    }
  };

  const handleAutofill = async () => {
    if (!selectedSiteId) { showToast('danger', 'Select a site first'); return; }
    setIsLoading(true);
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    try {
      const siteEmps = await db.employees.where('siteId').equals(Number(selectedSiteId)).toArray();
      if (!siteEmps.length) { showToast('danger', 'No workers at this site'); setIsLoading(false); return; }
      const att = await db.attendance.where('date').between(`${monthStr}-01`,`${monthStr}-31`,true,true)
        .filter(r => r.siteId === Number(selectedSiteId)).toArray();
      if (!att.length) { showToast('danger', 'No attendance this month'); setIsLoading(false); return; }
      let totalCost = 0, totalDays = 0;
      siteEmps.forEach(emp => {
        const recs = att.filter(r => r.employeeId === emp.id);
        let P=0,HD=0,L=0,ot=0;
        recs.forEach(r => { if(r.status==='P') P++; else if(r.status==='HD') HD++; else if(r.status==='L') L++; ot+=r.otHours||0; });
        const days = P + HD*0.5 + L;
        totalDays += days;
        const base = emp.rateType==='monthly' ? emp.baseRate : days*emp.baseRate;
        totalCost += base + ot*(emp.otRate||settings?.defaultOtRate||100);
      });
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      setItems([{ description:`Manpower Supply Services at ${clientName} for ${months[now.getMonth()]} ${now.getFullYear()} (${totalDays.toFixed(1)} Man-days)`, hsn:'998513', quantity:1, unit:'Month', rate:Math.round(totalCost) }]);
      showToast('success', 'Labour cost auto-filled!');
    } catch(err) { console.error(err); showToast('danger', 'Failed to fetch data'); }
    setIsLoading(false);
  };

  const buildPayroll = async (sId, dt) => {
    const month = new Date(dt).getMonth()+1;
    const year  = new Date(dt).getFullYear();
    const ms = `${year}-${String(month).padStart(2,'0')}`;
    const emps = await db.employees.where('siteId').equals(Number(sId)).toArray();
    const att  = await db.attendance.where('date').between(`${ms}-01`,`${ms}-31`,true,true)
      .filter(r => r.siteId===Number(sId)).toArray();
    const out = [];
    emps.forEach(emp => {
      const recs = att.filter(r=>r.employeeId===emp.id);
      let P=0,HD=0,L=0,ot=0;
      recs.forEach(r=>{ if(r.status==='P')P++; else if(r.status==='HD')HD++; else if(r.status==='L')L++; ot+=r.otHours||0; });
      const days=P+HD*0.5+L;
      const base=emp.rateType==='monthly'?emp.baseRate:days*emp.baseRate;
      const net=base+ot*(emp.otRate||settings?.defaultOtRate||100);
      if(net>0) out.push({ employee:emp, netSalary:Math.round(net) });
    });
    return out;
  };

  const handleGenerateWord = async () => {
    if(!selectedSiteId){ showToast('danger','Select a site first'); return; }
    try {
      const payroll = await buildPayroll(selectedSiteId, date);
      setWordPayroll(payroll);
      setIsWordModal(true);
    } catch(err){ console.error(err); showToast('danger','Failed'); }
  };

  const handleWordForSaved = async (inv) => {
    if(!inv.siteId){ showToast('danger','No site linked'); return; }
    try {
      const payroll = await buildPayroll(inv.siteId, inv.date);
      setWordPayroll(payroll);
      setPrintingInvoice(inv);
      setIsWordModal(true);
    } catch(err){ console.error(err); showToast('danger','Failed'); }
  };

  const handleItemChange = (i, f, v) => {
    const u=[...items]; u[i][f]=v; setItems(u);
  };

  const subtotal   = items.reduce((a,it)=>a+(Number(it.quantity)*Number(it.rate)||0),0);
  const gstAmount  = (subtotal*gstRate)/100;
  const grandTotal = Math.round(subtotal+gstAmount);
  const roundOff   = (grandTotal-(subtotal+gstAmount)).toFixed(2);

  const toWords = (n) => {
    const w={0:'Zero',1:'One',2:'Two',3:'Three',4:'Four',5:'Five',6:'Six',7:'Seven',8:'Eight',9:'Nine',10:'Ten',11:'Eleven',12:'Twelve',13:'Thirteen',14:'Fourteen',15:'Fifteen',16:'Sixteen',17:'Seventeen',18:'Eighteen',19:'Nineteen',20:'Twenty',30:'Thirty',40:'Forty',50:'Fifty',60:'Sixty',70:'Seventy',80:'Eighty',90:'Ninety'};
    const gw=(x)=>x<20?w[x]:w[Math.floor(x/10)*10]+(x%10?` ${w[x%10]}`:'');
    const cv=(x)=>{if(!x)return'';let o='';if(x>=10000000){o+=cv(Math.floor(x/10000000))+' Crore ';x%=10000000;}if(x>=100000){o+=gw(Math.floor(x/100000))+' Lakh ';x%=100000;}if(x>=1000){o+=gw(Math.floor(x/1000))+' Thousand ';x%=1000;}if(x>=100){o+=gw(Math.floor(x/100))+' Hundred ';x%=100;}if(x>0){if(o)o+='and ';o+=gw(x);}return o.trim();};
    return (cv(Math.round(n))||'Zero')+' Rupees Only';
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if(!selectedSiteId||!clientName){ showToast('danger','Fill client info'); return; }
    try {
      const inv={ invoiceNumber,date,siteId:Number(selectedSiteId),clientName,clientAddress,clientGstin,items,subtotal,gstType,gstRate,gstAmount,roundOff:Number(roundOff),total:grandTotal,status:'Unpaid' };
      const id = await db.invoices.add(inv);
      await pushRecordToCloud('invoices',{...inv,id});
      showToast('success','Bill saved!');
      setInvoiceNumber(''); setItems([{description:'Manpower Supply Services',hsn:'998513',quantity:1,unit:'LumpSum',rate:15000}]);
      setSelectedSiteId(''); setClientName(''); setClientAddress(''); setClientGstin('');
      setActiveTab('history');
    } catch(err){ console.error(err); showToast('danger','Save failed'); }
  };

  const deleteBill = async (id) => {
    if(!window.confirm('Delete this bill?')) return;
    await db.invoices.delete(id);
    await deleteRecordInCloud('invoices',id);
    showToast('success','Deleted');
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">GST Billing</h1>
          <p className="page-sub">Create &amp; manage invoices</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bill-tabs no-print">
        <button className={`bill-tab ${activeTab==='create'?'active':''}`} onClick={()=>setActiveTab('create')}>
          <Plus size={15} /> New Bill
        </button>
        <button className={`bill-tab ${activeTab==='history'?'active':''}`} onClick={()=>setActiveTab('history')}>
          <FileText size={15} /> History
          {invoices?.length>0 && <span className="bill-tab-count">{invoices.length}</span>}
        </button>
      </div>

      {/* ── CREATE TAB ── */}
      {activeTab==='create' && (
        <form onSubmit={handleSave} className="no-print">

          {/* Bill Details */}
          <div className="bill-section">
            <div className="bill-section__title"><Building2 size={13}/> Bill Details</div>
            <div className="card card--flat">
              <div className="form-block">
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Work Site</label>
                    <select className="select" value={selectedSiteId} onChange={e=>handleSiteChange(e.target.value)} required>
                      <option value="" disabled>Choose site…</option>
                      {sites?.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Bill Number</label>
                    <input className="input" value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} required />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Date</label>
                    <input type="date" className="input" value={date} onChange={e=>setDate(e.target.value)} required />
                  </div>
                  {selectedSiteId && (
                    <div className="field" style={{justifyContent:'flex-end'}}>
                      <button type="button" className="autofill-btn" onClick={handleAutofill} disabled={isLoading}>
                        <Zap size={15}/>{isLoading?'Loading…':'Auto-fill Labour'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="bill-section">
            <div className="bill-section__title"><FileText size={13}/> Billed To</div>
            <div className="card card--flat">
              <div className="form-block">
                <div className="field">
                  <label className="field-label">Company / Client Name</label>
                  <input className="input" value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="e.g. Metro Rail Corporation" required />
                </div>
                <div className="field">
                  <label className="field-label">Address</label>
                  <textarea className="input textarea" rows={2} value={clientAddress} onChange={e=>setClientAddress(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">GSTIN <span className="text-muted text-xs">(optional)</span></label>
                  <input className="input" value={clientGstin} onChange={e=>setClientGstin(e.target.value)} placeholder="e.g. 19BBBBB2222B1Z2" />
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bill-section">
            <div className="bill-section__title">
              <IndianRupee size={13}/> Items &amp; Services
              <button type="button" className="btn btn--xs btn--secondary" style={{marginLeft:'auto'}}
                onClick={()=>setItems([...items,{description:'',hsn:'',quantity:1,unit:'Nos',rate:0}])}>
                <Plus size={12}/> Add Row
              </button>
            </div>
            {items.map((item,idx)=>(
              <div key={idx} className="item-row">
                {items.length>1 && (
                  <button type="button" className="item-row__remove" onClick={()=>setItems(items.filter((_,i)=>i!==idx))}>
                    <X size={12}/>
                  </button>
                )}
                <div className="field" style={{marginBottom:8}}>
                  <label className="field-label" style={{fontSize:'0.67rem'}}>Description</label>
                  <input className="input" value={item.description} onChange={e=>handleItemChange(idx,'description',e.target.value)} placeholder="Service or goods supplied" required />
                </div>
                <div className="item-row__meta">
                  {[
                    {key:'hsn',label:'HSN/SAC',ph:'998513',w:'90px'},
                    {key:'unit',label:'Unit',ph:'Month',w:'80px'},
                    {key:'quantity',label:'Qty',type:'number',w:'70px'},
                    {key:'rate',label:'Rate ₹',type:'number',w:'90px'},
                  ].map(({key,label,ph,type,w})=>(
                    <div key={key} className="field" style={{flex:'0 0 auto',width:w}}>
                      <label className="field-label" style={{fontSize:'0.67rem'}}>{label}</label>
                      <input className="input" type={type||'text'} value={item[key]}
                        onChange={e=>handleItemChange(idx,key,type==='number'?Number(e.target.value):e.target.value)}
                        placeholder={ph} style={{padding:'8px 10px'}} />
                    </div>
                  ))}
                  <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'2px'}}>
                    <span className="item-row__total">
                      ₹{(Number(item.quantity)*Number(item.rate)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tax */}
          <div className="bill-section">
            <div className="bill-section__title">Tax</div>
            <div className="card card--flat">
              <div className="form-block">
                <div className="field">
                  <label className="field-label">GST Type</label>
                  <div className="gst-type-toggle">
                    {[
                      {val:'cgst-sgst',label:'CGST + SGST',sub:'Same state'},
                      {val:'igst',label:'IGST',sub:'Other state'},
                    ].map(({val,label,sub})=>(
                      <button key={val} type="button" className={`gst-type-btn ${gstType===val?'active':''}`} onClick={()=>setGstType(val)}>
                        {label}<small>{sub}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field">
                  <label className="field-label">Rate</label>
                  <div className="rate-chips">
                    {[5,12,18,28,0].map(r=>(
                      <button key={r} type="button" className={`rate-chip ${gstRate===r?'active':''}`} onClick={()=>setGstRate(r)}>
                        {r===0?'Exempt':r+'%'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="tax-summary">
                <div className="tax-summary__row">
                  <span>Before tax</span><span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {gstType==='cgst-sgst'?(
                  <>
                    <div className="tax-summary__row"><span>CGST {gstRate/2}%</span><span>₹{(gstAmount/2).toLocaleString('en-IN')}</span></div>
                    <div className="tax-summary__row"><span>SGST {gstRate/2}%</span><span>₹{(gstAmount/2).toLocaleString('en-IN')}</span></div>
                  </>
                ):(
                  <div className="tax-summary__row"><span>IGST {gstRate}%</span><span>₹{gstAmount.toLocaleString('en-IN')}</span></div>
                )}
                {Number(roundOff)!==0&&(
                  <div className="tax-summary__row"><span>Round-off</span><span style={{color:Number(roundOff)<0?'var(--c-danger)':'var(--c-success)'}}>{Number(roundOff)>0?'+':''}₹{roundOff}</span></div>
                )}
                <div className="tax-summary__total">
                  <span>Total</span>
                  <span className="tax-summary__total-val">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="words-box mt-3">
                <div className="words-box__label">Amount in words</div>
                <div className="words-box__text">{toWords(grandTotal)}</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-2">
            <button type="submit" className="btn btn--primary" style={{flex:1}}>
              <Save size={15}/> Save Bill
            </button>
            <button type="button" className="btn btn--secondary" style={{flex:1,background:'#2563eb',color:'white',border:'none'}} onClick={handleGenerateWord}>
              <Download size={15}/> Word Doc
            </button>
          </div>
        </form>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab==='history' && (
        <div className="no-print">
          {invoices?.length>0 ? invoices.map(inv=>(
            <div key={inv.id} className="bill-card">
              <div className="bill-card__head">
                <div className="bill-card__num"><Receipt size={13}/>{inv.invoiceNumber}</div>
                <div className="bill-card__date">{new Date(inv.date).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</div>
              </div>
              <div className="bill-card__body">
                <div className="bill-card__client">
                  <div className="bill-card__client-name">{inv.clientName}</div>
                  {inv.clientGstin&&<div className="bill-card__client-gstin">GSTIN: {inv.clientGstin}</div>}
                </div>
                <div className="bill-card__amounts">
                  <div className="bill-card__amt-row"><span>Before tax</span><span>₹{inv.subtotal.toLocaleString('en-IN')}</span></div>
                  <div className="bill-card__amt-row"><span>GST</span><span>₹{inv.gstAmount.toLocaleString('en-IN')}</span></div>
                  <div className="bill-card__total">₹{inv.total.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="bill-card__foot">
                <button className="btn btn--sm btn--secondary" onClick={()=>{setPrintingInvoice(inv);}}>
                  <Eye size={13}/> View
                </button>
                <button className="btn btn--sm" style={{background:'#2563eb',color:'white',border:'none'}} onClick={()=>handleWordForSaved(inv)}>
                  <Download size={13}/> Word
                </button>
                <button className="btn btn--sm btn--danger" style={{marginLeft:'auto'}} onClick={()=>deleteBill(inv.id)}>
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          )):(
            <div className="empty-state">
              <Receipt size={48} className="empty-state__icon"/>
              <h3>No bills yet</h3>
              <p>Create a bill in the New Bill tab.</p>
              <button className="btn btn--primary mt-3" onClick={()=>setActiveTab('create')}><Plus size={15}/> Create Bill</button>
            </div>
          )}
        </div>
      )}

      {/* ── INVOICE PREVIEW MODAL ── */}
      {printingInvoice && !isWordModal && (
        <div className="modal-overlay no-print" onClick={()=>setPrintingInvoice(null)}>
          <div className="invoice-preview-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Invoice Preview</span>
              <button className="modal-close" onClick={()=>setPrintingInvoice(null)}>✕</button>
            </div>

            <div id="invoice-print-area" style={{background:'white',color:'#1e293b',border:'1px solid #cbd5e1',borderRadius:'8px',padding:'28px',fontSize:'0.84rem',margin:'12px 0',fontFamily:'Times New Roman, serif'}}>
              <p style={{textAlign:'center',fontWeight:'bold',textDecoration:'underline',fontSize:'1.1rem',marginBottom:'14px'}}>TAX-INVOICE</p>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'8px',fontSize:'0.82rem'}}><tbody>
                <tr>
                  <td style={{width:'50%',padding:'2px 0'}}><strong>Tax Invoice No. : </strong>{printingInvoice.invoiceNumber}</td>
                  <td style={{textAlign:'right',padding:'2px 0'}}><strong>Date – </strong>{printingInvoice.date}</td>
                </tr>
              </tbody></table>
              <p style={{marginBottom:'3px',fontSize:'0.82rem'}}><strong>M/s : </strong><strong>{printingInvoice.clientName}</strong></p>
              <p style={{marginBottom:'3px',fontSize:'0.82rem'}}><strong>Address : </strong><span style={{whiteSpace:'pre-line'}}>{printingInvoice.clientAddress}</span></p>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'0.82rem'}}><tbody>
                <tr>
                  <td style={{width:'50%',padding:'2px 0'}}><strong>State : </strong><strong>WEST BENGAL</strong></td>
                  <td style={{textAlign:'right',padding:'2px 0'}}>{printingInvoice.clientGstin&&<><strong>GSTIN : </strong><strong>{printingInvoice.clientGstin}</strong></>}</td>
                </tr>
              </tbody></table>
              <p style={{textAlign:'center',fontWeight:'bold',color:'#166534',fontSize:'1.3rem',marginBottom:'4px'}}>{settings?.name||'COMPANY NAME'}</p>
              {settings?.companySubtitle&&<p style={{textAlign:'center',fontWeight:'bold',color:'#1d4ed8',fontSize:'0.78rem',textDecoration:'underline',marginBottom:'4px'}}>{settings.companySubtitle}</p>}
              <p style={{textAlign:'center',fontSize:'0.78rem',marginBottom:'10px',color:'#374151'}}>{settings?.address||''}</p>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'0.82rem'}}><tbody>
                <tr>
                  <td style={{width:'50%',padding:'2px 0'}}>{settings?.panNo&&<><strong>Pan No. : </strong><span>{settings.panNo}</span></>}</td>
                  <td style={{textAlign:'right',padding:'2px 0'}}>{settings?.gstin&&<><strong>GSTIN : </strong><strong>{settings.gstin}</strong></>}</td>
                </tr>
              </tbody></table>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'0.82rem'}}>
                <thead><tr>
                  {['SL\nNO.','QUANTITY','PARTICULARS','SAC CODE','AMOUNT'].map((h,i)=>(
                    <th key={i} style={{border:'1px solid #334155',padding:'7px 6px',textAlign:'center',background:'#f1f5f9',width:i===2?'49%':i===0?'6%':'auto'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {printingInvoice.items.map((item,idx)=>(
                    <tr key={idx}>
                      <td style={{border:'1px solid #334155',padding:'8px 6px',textAlign:'center'}}>{idx+1}</td>
                      <td style={{border:'1px solid #334155',padding:'8px 6px',textAlign:'center'}}>{item.quantity} {item.unit}</td>
                      <td style={{border:'1px solid #334155',padding:'8px 6px',fontWeight:'600'}}>{item.description}</td>
                      <td style={{border:'1px solid #334155',padding:'8px 6px',textAlign:'center'}}>{item.hsn||'998513'}</td>
                      <td style={{border:'1px solid #334155',padding:'8px 6px',textAlign:'right',fontWeight:'600'}}>Rs. {(Number(item.quantity)*Number(item.rate)).toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{border:'1px solid #334155',padding:'6px'}}/>
                    <td colSpan={2} style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'center',fontWeight:'bold'}}>AMOUNT</td>
                    <td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right',fontWeight:'600'}}>Rs. {printingInvoice.subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                  </tr>
                  {printingInvoice.gstType==='cgst-sgst'?(
                    <>
                      <tr><td colSpan={2} style={{border:'1px solid #334155',padding:'6px'}}/><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Add : SGST</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'center'}}>{printingInvoice.gstRate/2}%</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Rs. {(printingInvoice.gstAmount/2).toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
                      <tr><td colSpan={2} style={{border:'1px solid #334155',padding:'6px'}}/><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Add : CGST</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'center'}}>{printingInvoice.gstRate/2}%</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Rs. {(printingInvoice.gstAmount/2).toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
                    </>
                  ):(
                    <tr><td colSpan={2} style={{border:'1px solid #334155',padding:'6px'}}/><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Add : IGST</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'center'}}>{printingInvoice.gstRate}%</td><td style={{border:'1px solid #334155',padding:'6px 8px',textAlign:'right'}}>Rs. {printingInvoice.gstAmount.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
                  )}
                  <tr><td colSpan={2} style={{border:'1px solid #334155',padding:'6px'}}/><td colSpan={2} style={{border:'1px solid #334155',padding:'8px',textAlign:'center',fontWeight:'bold'}}>Total</td><td style={{border:'1px solid #334155',padding:'8px',textAlign:'right',fontWeight:'bold'}}>Rs. {printingInvoice.total.toLocaleString('en-IN',{minimumFractionDigits:2})}</td></tr>
                  <tr><td style={{border:'1px solid #334155',padding:'8px',textAlign:'center',fontWeight:'bold'}}>Rupees</td><td colSpan={4} style={{border:'1px solid #334155',padding:'8px',fontStyle:'italic'}}>{toWords(printingInvoice.total)}</td></tr>
                </tbody>
              </table>
              <table style={{width:'100%',borderCollapse:'collapse',marginBottom:'14px',fontSize:'0.82rem'}}><tbody>
                <tr><td style={{border:'1px solid #334155',padding:'10px 12px'}}>
                  <p style={{fontWeight:'bold',marginBottom:'6px'}}>OUR BANKER DETAILS :- (PLEASE PAY A/C. PAYEE CHEQUE ONLY)</p>
                  {settings?.bankName&&<p style={{marginBottom:'2px'}}>{settings.bankName}</p>}
                  {settings?.bankBranch&&<p style={{marginBottom:'2px'}}>{settings.bankBranch}</p>}
                  {settings?.bankAccount&&<p style={{fontWeight:'bold',marginBottom:'2px'}}>A/C. No. : {settings.bankAccount}</p>}
                  {settings?.bankIfsc&&<p style={{fontWeight:'bold'}}>IFSC Code : {settings.bankIfsc}</p>}
                  {!settings?.bankName&&!settings?.bankAccount&&<p style={{color:'#94a3b8',fontStyle:'italic'}}>Bank details not set in Settings.</p>}
                </td></tr>
                <tr><td style={{border:'1px solid #334155',padding:'8px 12px',fontSize:'0.78rem'}}><strong>Invoice Term : </strong>Interest will be charged at 21% p.a. if bill not paid on presentation.</td></tr>
              </tbody></table>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.82rem'}}><tbody>
                <tr>
                  <td style={{width:'50%',padding:'4px 0'}}>Subject to Kolkata Jurisdiction</td>
                  <td style={{textAlign:'right',padding:'4px 0'}}>
                    <p>For, {settings?.name||'Company Name'}</p>
                    <p style={{height:'48px'}}></p>
                    <p style={{fontWeight:'bold'}}>Authorized signatory</p>
                  </td>
                </tr>
              </tbody></table>
            </div>

            <div className="flex gap-3 justify-end mt-3">
              <button className="btn btn--secondary" onClick={()=>setPrintingInvoice(null)}>Close</button>
              <button className="btn btn--primary" onClick={()=>window.print()}><Printer size={15}/> Print</button>
            </div>
          </div>
        </div>
      )}

      {/* Word modal */}
      {isWordModal&&(
        <GenerateInvoiceModal
          onClose={()=>{setIsWordModal(false);setPrintingInvoice(null);}}
          site={sites?.find(s=>s.id===Number(printingInvoice?printingInvoice.siteId:selectedSiteId))}
          month={new Date(printingInvoice?printingInvoice.date:date).getMonth()+1}
          year={new Date(printingInvoice?printingInvoice.date:date).getFullYear()}
          payrollList={wordPayroll}
          settings={settings}
        />
      )}

      {/* Toast */}
      {toast&&(
        <div className={`toast toast--${toast.type}`}>
          {toast.type==='success'?<Check size={14}/>:<AlertCircle size={14}/>}
          {toast.text}
        </div>
      )}
    </div>
  );
}
