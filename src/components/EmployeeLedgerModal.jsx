import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { pushRecordToCloud, deleteRecordInCloud } from '../sync';
import {
  X, Plus, Trash2, Wallet, Calendar, Check,
  IndianRupee, TrendingUp, TrendingDown, Gift, RefreshCcw
} from 'lucide-react';

const TX_TYPES = {
  Salary:    { label: 'Salary',    Icon: IndianRupee, color: 'var(--c-success)', bg: '#059669' },
  Advance:   { label: 'Advance',   Icon: TrendingDown, color: 'var(--c-warning)', bg: '#d97706' },
  Repayment: { label: 'Repayment', Icon: RefreshCcw,  color: 'var(--c-info)',    bg: '#0284c7' },
  Bonus:     { label: 'Bonus',     Icon: Gift,         color: 'var(--c-accent)',  bg: '#7c3aed' },
  Others:    { label: 'Others',    Icon: IndianRupee,  color: 'var(--c-primary)', bg: '#4f46e5' },
};

function initials(name) {
  return name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';
}

export default function EmployeeLedgerModal({ employee, sites, onClose }) {
  const transactions = useLiveQuery(
    () => db.transactions.where('employeeId').equals(employee.id).sortBy('date'),
    [employee.id]
  );

  const [showForm, setShowForm] = useState(false);
  const [txType, setTxType]     = useState('Salary');
  const [txDate, setTxDate]     = useState(new Date().toISOString().slice(0, 10));
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote]     = useState('');
  const [saving, setSaving]     = useState(false);

  const getSiteName = (sId) => {
    if (!sId || !sites) return '—';
    return sites.find(s => s.id === Number(sId))?.name || '—';
  };

  const totalPaid     = (transactions||[]).filter(t=>t.type==='Salary'||t.type==='Bonus'||t.type==='Others'||t.type==='salary'||t.type==='bonus').reduce((s,t)=>s+t.amount,0);
  const totalAdvances = (transactions||[]).filter(t=>t.type==='Advance'||t.type==='advance').reduce((s,t)=>s+t.amount,0);
  const totalRepay    = (transactions||[]).filter(t=>t.type==='Repayment'||t.type==='repayment').reduce((s,t)=>s+t.amount,0);
  const outstanding   = totalAdvances - totalRepay;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) return;
    setSaving(true);
    try {
      const rec = {
        employeeId: employee.id,
        siteId: employee.siteId || null,
        date: txDate, type: txType,
        amount: Number(txAmount),
        note: txNote.trim(),
        createdAt: new Date().toISOString(),
      };
      const id = await db.transactions.add(rec);
      await pushRecordToCloud('transactions', { ...rec, id });
      setTxAmount(''); setTxNote(''); setShowForm(false);
    } catch (err) { console.error(err); }
    setSaving(false);
  };

  const handleDelete = async (tx) => {
    if (!window.confirm(`Delete this ${TX_TYPES[tx.type]?.label} of ₹${tx.amount}?`)) return;
    try {
      await db.transactions.delete(tx.id);
      await deleteRecordInCloud('transactions', tx.id);
    } catch (err) { console.error(err); }
  };

  const rows = [...(transactions||[])].reverse();

  return (
    <div className="modal-overlay" style={{ zIndex: 600 }}>
      <div className="modal-sheet" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div className="flex gap-3 items-center">
            <div className="emp-card__avatar" style={{ width: 40, height: 40, borderRadius: 10, fontSize: '0.9rem', flexShrink: 0 }}>
              {initials(employee.name)}
            </div>
            <div>
              <div className="modal-title">{employee.name}</div>
              <div className="text-xs text-muted" style={{ marginTop: 1 }}>
                {employee.designation || 'Staff'} · {getSiteName(employee.siteId)} · ₹{employee.baseRate}/{employee.rateType==='monthly'?'mo':'day'}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Total Paid', val: totalPaid,    sub: 'Salary + Bonus',   color: 'var(--c-success)', Icon: TrendingUp  },
              { label: 'Advances',  val: totalAdvances, sub: `Repaid ₹${totalRepay.toLocaleString('en-IN')}`, color: 'var(--c-warning)', Icon: TrendingDown },
              {
                label: 'Outstanding', val: outstanding,
                sub: outstanding > 0 ? 'Due' : outstanding < 0 ? 'Overpaid' : 'Cleared',
                color: outstanding > 0 ? 'var(--c-warning)' : 'var(--c-success)',
                Icon: RefreshCcw,
                border: outstanding > 0
              },
            ].map(({ label, val, sub, color, Icon: CardIcon, border }) => (
              <div
                key={label}
                style={{
                  background: 'var(--card-2)',
                  border: `1px solid ${border ? 'rgba(217,119,6,0.3)' : 'var(--border)'}`,
                  borderRadius: 11, padding: '10px 8px', textAlign: 'center'
                }}
              >
                <CardIcon size={14} style={{ color, margin: '0 auto 5px' }} />
                <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--t-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color, fontFamily: 'Outfit', lineHeight: 1 }}>₹{Math.abs(val).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: '0.67rem', color: 'var(--t-3)', marginTop: 3 }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* ── Add transaction button / form ── */}
          {!showForm ? (
            <button className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowForm(true)}>
              <Plus size={14} /> Add Transaction
            </button>
          ) : (
            <form onSubmit={handleAdd} style={{ background: 'var(--card)', border: '1.5px solid var(--c-primary)', borderRadius: 13, padding: 14 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--t-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>New Transaction</div>

              {/* Transaction type tabs */}
              <div className="txn-type-tabs" style={{ marginBottom: 12 }}>
                {Object.entries(TX_TYPES).map(([key, cfg]) => {
                  const TIcon = cfg.Icon;
                  const activeClass = `active ${key}`;
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`txn-type-btn ${txType === key ? activeClass : ''}`}
                      onClick={() => setTxType(key)}
                    >
                      <div
                        className="txn-type-btn__icon"
                        style={{ background: txType === key ? cfg.bg : 'var(--t-3)' }}
                      >
                        <TIcon size={14} />
                      </div>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label">Date</label>
                  <input type="date" className="input" value={txDate} onChange={e=>setTxDate(e.target.value)} required />
                </div>
                <div className="field">
                  <label className="field-label">Amount (₹)</label>
                  <input type="number" className="input" value={txAmount} onChange={e=>setTxAmount(e.target.value)} placeholder="e.g. 5000" min="1" required />
                </div>
              </div>

              <div className="field" style={{ marginTop: 10 }}>
                <label className="field-label">Note <span className="text-muted">(optional)</span></label>
                <input type="text" className="input" value={txNote} onChange={e=>setTxNote(e.target.value)} placeholder="e.g. May salary, advance for travel…" />
              </div>

              <div className="flex gap-2 justify-end mt-3">
                <button type="button" className="btn btn--secondary btn--sm" onClick={()=>setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
                  <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* ── Transaction history ── */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--t-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Transaction History
            </div>

            {rows.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <Wallet size={34} className="empty-state__icon" />
                <h3>No transactions yet</h3>
                <p>Add a salary payment or advance above.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map(tx => {
                  const normalizedType = tx.type.charAt(0).toUpperCase() + tx.type.slice(1);
                  const cfg = TX_TYPES[normalizedType] || TX_TYPES.Salary;
                  const TIcon = cfg.Icon;
                  const isOut = normalizedType === 'Advance';
                  return (
                    <div key={tx.id} className="txn-item">
                      <div className="txn-item__icon" style={{ background: cfg.bg }}>
                        <TIcon size={14} />
                      </div>
                      <div className="txn-item__info">
                        <div className="txn-item__label" style={{ color: cfg.color }}>{cfg.label}</div>
                        <div className="flex items-center gap-1" style={{ marginTop: 2 }}>
                          <Calendar size={10} style={{ color: 'var(--t-3)', flexShrink: 0 }} />
                          <span className="text-xs text-muted">{tx.date}</span>
                          {tx.note && <span className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {tx.note}</span>}
                        </div>
                      </div>
                      <div className="txn-item__amount" style={{ color: isOut ? 'var(--c-warning)' : 'var(--c-success)' }}>
                        {isOut ? '−' : '+'}₹{tx.amount.toLocaleString('en-IN')}
                      </div>
                      <button
                        className="btn btn--icon btn--danger"
                        style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }}
                        onClick={() => handleDelete(tx)}
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
