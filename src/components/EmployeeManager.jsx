import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { pushRecordToCloud, deleteRecordInCloud } from '../sync';
import { Plus, Edit2, Search, Check, BookOpen, AlertTriangle, Trash2, Archive } from 'lucide-react';
import EmployeeLedgerModal from './EmployeeLedgerModal';

export default function EmployeeManager() {
  const employees = useLiveQuery(() => db.employees.toArray());
  const sites     = useLiveQuery(() => db.sites.toArray());
  const settings  = useLiveQuery(() => db.companySettings.get('main'));

  const [isModal, setIsModal]     = useState(false);
  const [editId, setEditId]       = useState(null);
  const [name, setName]           = useState('');
  const [designation, setDes]     = useState('Helper');
  const [baseRate, setBaseRate]   = useState('');
  const [rateType, setRateType]   = useState('daily');
  const [otRate, setOtRate]       = useState('');
  const [siteId, setSiteId]       = useState('');
  const [active, setActive]       = useState(1);
  const [bankName, setBankName]       = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankIfsc, setBankIfsc]       = useState('');

  const [search, setSearch]           = useState('');
  const [siteFilter, setSiteFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('1');
  const [ledgerEmp, setLedgerEmp]     = useState(null);

  useEffect(() => {
    if (!editId && settings && !otRate) setOtRate(settings.defaultOtRate || 100);
  }, [isModal, settings]);

  const openAdd = () => {
    setEditId(null); setName(''); setDes('Helper'); setBaseRate(500);
    setRateType('daily'); setOtRate(settings?.defaultOtRate || 100);
    setSiteId(sites?.length ? String(sites[0].id) : ''); setActive(1);
    setBankName(''); setBankAccount(''); setBankIfsc('');
    setIsModal(true);
  };

  const openEdit = (emp) => {
    setEditId(emp.id); setName(emp.name); setDes(emp.designation || '');
    setBaseRate(emp.baseRate); setRateType(emp.rateType || 'daily');
    setOtRate(emp.otRate); setSiteId(emp.siteId ? String(emp.siteId) : '');
    setActive(emp.active ?? 1); 
    setBankName(emp.bankName || ''); setBankAccount(emp.bankAccount || ''); setBankIfsc(emp.bankIfsc || '');
    setIsModal(true);
    setConfirmDelete(false);
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleEmployeeAction = async (action) => {
    if (!editId) return;
    try {
      if (action === 'archive') {
        await db.employees.update(editId, { active: 0 });
        await pushRecordToCloud('employees', { id: editId, active: 0 });
      } else if (action === 'delete_only') {
        await db.employees.delete(editId);
        await deleteRecordInCloud('employees', editId);
      } else if (action === 'delete_all') {
        // Attendance
        const attIds = await db.attendance.where('employeeId').equals(editId).primaryKeys();
        await db.attendance.bulkDelete(attIds);
        for (const id of attIds) await deleteRecordInCloud('attendance', id);
        // Transactions
        if (db.transactions) {
          const transIds = await db.transactions.where('employeeId').equals(editId).primaryKeys();
          await db.transactions.bulkDelete(transIds);
          for (const id of transIds) await deleteRecordInCloud('transactions', id);
        }
        // Employee
        await db.employees.delete(editId);
        await deleteRecordInCloud('employees', editId);
      }
      setIsModal(false);
      setConfirmDelete(false);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !baseRate) return;
    const data = {
      name, designation, baseRate: Number(baseRate), rateType,
      otRate: Number(otRate || settings?.defaultOtRate || 100),
      siteId: siteId ? Number(siteId) : null,
      active: Number(active),
      bankName, bankAccount, bankIfsc
    };
    try {
      if (editId) {
        await db.employees.update(editId, data);
        await pushRecordToCloud('employees', { ...data, id: editId });
      } else {
        const id = await db.employees.add(data);
        await pushRecordToCloud('employees', { ...data, id });
      }
      setIsModal(false);
    } catch (err) { console.error(err); }
  };

  const toggleActive = async (emp) => {
    const v = emp.active === 0 ? 1 : 0;
    await db.employees.update(emp.id, { active: v });
    await pushRecordToCloud('employees', { ...emp, active: v });
  };

  const getSiteName = (sId) => {
    if (!sId || !sites) return 'Unassigned';
    return sites.find(s => s.id === Number(sId))?.name || 'Unknown';
  };

  const initials = (n) => n ? n.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?';

  const filtered = (employees || []).filter(emp => {
    const matchName = emp.name.toLowerCase().includes(search.toLowerCase()) ||
                      (emp.designation||'').toLowerCase().includes(search.toLowerCase());
    const matchSite = siteFilter === '' || emp.siteId === Number(siteFilter);
    const matchStatus = statusFilter === 'all' || emp.active === Number(statusFilter);
    return matchName && matchSite && matchStatus;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Staff</h1>
          <p className="page-sub">Workers, rates &amp; assignments</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={openAdd}>
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="search-wrap mb-3">
        <Search size={16} />
        <input
          className="input"
          placeholder="Search name or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div className="filter-bar">
        {['1','0','all'].map(v => (
          <button
            key={v}
            className={`filter-chip ${statusFilter === v ? 'active' : ''}`}
            onClick={() => setStatusFilter(v)}
          >
            {{ '1': 'Active', '0': 'Archived', all: 'All' }[v]}
          </button>
        ))}
        <select
          className="select"
          style={{ maxWidth: '140px', padding: '6px 10px', fontSize: '0.78rem', borderRadius: '99px' }}
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
        >
          <option value="">All Sites</option>
          {sites && sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Employee list */}
      <div className="emp-list">
        {filtered.length > 0 ? filtered.map(emp => (
          <div key={emp.id} className={`emp-card ${emp.active === 0 ? 'emp-card--inactive' : ''}`}>
            <div className="emp-card__avatar">{initials(emp.name)}</div>
            <div className="emp-card__info">
              <div className="emp-card__name">{emp.name}</div>
              <div className="emp-card__sub">
                <span className="badge badge--primary">{emp.designation || 'Staff'}</span>
                <span>{getSiteName(emp.siteId)}</span>
              </div>
              <div className="emp-card__rate mt-2">
                ₹{emp.baseRate}/{emp.rateType === 'daily' ? 'day' : 'mo'}
                <span className="text-muted text-xs" style={{ marginLeft: 6 }}>
                  OT ₹{emp.otRate}/hr
                </span>
              </div>
            </div>

            <div className="emp-card__btns">
              <button
                className="btn btn--icon btn--secondary"
                onClick={() => setLedgerEmp(emp)}
                title="Payment history"
              >
                <BookOpen size={15} />
              </button>
              <button
                className="btn btn--icon btn--secondary"
                onClick={() => openEdit(emp)}
                title="Edit"
              >
                <Edit2 size={15} />
              </button>
            </div>
          </div>
        )) : (
          <div className="empty-state">
            <Search size={48} className="empty-state__icon" />
            <h3>No staff found</h3>
            <p>{search ? 'Try a different name.' : 'Add your first employee.'}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModal && (
        <div className="modal-overlay" onClick={() => setIsModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Edit Employee' : 'Add Employee'}</span>
              <button className="modal-close" onClick={() => setIsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="form-block">
                <div className="field">
                  <label className="field-label">Full Name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" required />
                </div>

                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Role</label>
                    <select className="select" value={designation} onChange={e => setDes(e.target.value)}>
                      {[
                        'Supervisor','Foreman','Store Keeper',
                        'Fitter','IBR Welder','Welder',
                        'Rigger','Gas Cutter','Grinder',
                        'Helper','Khalasi','Electrician'
                      ].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Work Site</label>
                    <select className="select" value={siteId} onChange={e => setSiteId(e.target.value)} required>
                      <option value="" disabled>Choose…</option>
                      {sites && sites.filter(s => s.active !== 0 || String(s.id) === siteId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Rate (₹)</label>
                    <input className="input" type="number" value={baseRate} onChange={e => setBaseRate(e.target.value)} min="0" required />
                  </div>
                  <div className="field">
                    <label className="field-label">Pay Type</label>
                    <select className="select" value={rateType} onChange={e => setRateType(e.target.value)}>
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label className="field-label">OT Rate (₹/hr)</label>
                    <input className="input" type="number" value={otRate} onChange={e => setOtRate(e.target.value)} min="0" />
                    <span className="field-hint">Default: ₹{settings?.defaultOtRate || 100}/hr</span>
                  </div>
                  {editId && (
                    <div className="field">
                      <label className="field-label">Status</label>
                      <select className="select" value={active} onChange={e => setActive(e.target.value)}>
                        <option value={1}>Active</option>
                        <option value={0}>Archived</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-block" style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--t-2)', marginBottom: 8 }}>Bank Details (Optional)</div>
                  <div className="field-row">
                    <div className="field">
                      <label className="field-label">Bank Name</label>
                      <input className="input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="e.g. SBI" />
                    </div>
                    <div className="field">
                      <label className="field-label">IFSC Code</label>
                      <input className="input" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} placeholder="SBIN0000123" />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Account Number</label>
                    <input className="input" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="00000012345" />
                  </div>
                </div>

                {/* Danger zone — delete employee + all records */}
                {editId && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                    {!confirmDelete ? (
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 size={13} /> Manage Deletion / Archive
                      </button>
                    ) : (
                      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 11, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="flex gap-2 items-center mb-1">
                          <AlertTriangle size={16} style={{ color: 'var(--c-danger)', flexShrink: 0 }} />
                          <span className="text-sm" style={{ color: 'var(--c-danger)', fontWeight: 700 }}>Choose how to remove this worker:</span>
                        </div>
                        
                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--card-2)', color: 'var(--t-1)' }} onClick={() => handleEmployeeAction('archive')}>
                          <Archive size={13} className="text-primary" /> Archive Worker (Keep All Records)
                        </button>
                        
                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--card-2)', color: 'var(--t-1)' }} onClick={() => handleEmployeeAction('delete_only')}>
                          <Trash2 size={13} style={{ color: '#f59e0b' }} /> Delete Worker Only (Keep Records)
                        </button>

                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--c-danger)', color: 'white', border: 'none' }} onClick={() => handleEmployeeAction('delete_all')}>
                          <AlertTriangle size={13} /> Delete Worker &amp; All Records
                        </button>

                        <button type="button" className="btn btn--secondary btn--sm mt-1" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2 justify-end mt-2">
                  <button type="button" className="btn btn--secondary" onClick={() => setIsModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn--primary">
                    <Check size={15} /> {editId ? 'Save' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Ledger modal (unchanged component, just passing props) */}
      {ledgerEmp && (
        <EmployeeLedgerModal
          employee={ledgerEmp}
          sites={sites}
          onClose={() => setLedgerEmp(null)}
        />
      )}
    </div>
  );
}
