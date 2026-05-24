import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { pushRecordToCloud, deleteRecordInCloud } from '../sync';
import { MapPin, User, Plus, Edit2, Archive, CheckCircle, Search, Users, Trash2, AlertTriangle } from 'lucide-react';

export default function SitesManager() {
  const sites     = useLiveQuery(() => db.sites.toArray());
  const employees = useLiveQuery(() => db.employees.toArray());
  const invoices  = useLiveQuery(() => db.invoices.toArray());

  const [isModal, setIsModal]     = useState(false);
  const [editId, setEditId]       = useState(null);
  const [name, setName]           = useState('');
  const [location, setLocation]   = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [active, setActive]       = useState(1);
  const [search, setSearch]       = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);

  const openAdd = () => {
    setEditId(null); setName(''); setLocation(''); setSupervisor(''); setActive(1);
    setIsModal(true); setConfirmDelete(false);
  };

  const openEdit = (s) => {
    setEditId(s.id); setName(s.name); setLocation(s.location);
    setSupervisor(s.supervisor); setActive(s.active ?? 1);
    setIsModal(true); setConfirmDelete(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !location) return;
    const data = { name, location, supervisor, active: Number(active) };
    try {
      if (editId) {
        await db.sites.update(editId, data);
        await pushRecordToCloud('sites', { ...data, id: editId });
      } else {
        const id = await db.sites.add(data);
        await pushRecordToCloud('sites', { ...data, id });
      }
      setIsModal(false);
    } catch (err) { console.error(err); }
  };

  const handleSiteAction = async (action) => {
    if (!editId) return;
    try {
      if (action === 'archive') {
        await db.sites.update(editId, { active: 0 });
        await pushRecordToCloud('sites', { id: editId, active: 0 });
      } else if (action === 'delete_only') {
        await db.sites.delete(editId);
        await deleteRecordInCloud('sites', editId);
      } else if (action === 'delete_all') {
        // Attendance
        const attIds = await db.attendance.where('siteId').equals(editId).primaryKeys();
        await db.attendance.bulkDelete(attIds);
        for (const id of attIds) await deleteRecordInCloud('attendance', id);
        // Invoices
        const invIds = await db.invoices.where('siteId').equals(editId).primaryKeys();
        await db.invoices.bulkDelete(invIds);
        for (const id of invIds) await deleteRecordInCloud('invoices', id);
        // Employees (optional depending on use case, but usually we don't delete workers if site closes, but user asked for it)
        const empIds = await db.employees.where('siteId').equals(editId).primaryKeys();
        await db.employees.bulkDelete(empIds);
        for (const id of empIds) await deleteRecordInCloud('employees', id);
        // Site
        await db.sites.delete(editId);
        await deleteRecordInCloud('sites', editId);
      }
      setIsModal(false);
      setConfirmDelete(false);
    } catch (err) { console.error(err); }
  };

  const toggleActive = async (site) => {
    const v = site.active === 0 ? 1 : 0;
    await db.sites.update(site.id, { active: v });
    await pushRecordToCloud('sites', { ...site, active: v });
  };

  const getSiteStats = (siteId) => ({
    workers:  employees ? employees.filter(e => e.siteId === siteId && e.active !== 0).length : 0,
    invoices: invoices  ? invoices.filter(i => i.siteId === siteId).length : 0,
  });

  const filtered = sites
    ? sites.filter(s =>
        [s.name, s.location, s.supervisor].some(v =>
          (v || '').toLowerCase().includes(search.toLowerCase())
        )
      )
    : [];

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Work Sites</h1>
          <p className="page-sub">Manage project sites &amp; assignments</p>
        </div>
        <button className="btn btn--primary btn--sm" onClick={openAdd}>
          <Plus size={15} /> Add Site
        </button>
      </div>

      {/* Search */}
      <div className="search-wrap mb-3">
        <Search size={16} />
        <input
          type="text"
          className="input"
          placeholder="Search sites…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="sites-grid">
        {filtered.length > 0 ? filtered.map(site => {
          const stats = getSiteStats(site.id);
          return (
            <div key={site.id} className="site-card">
              <div className={`site-card__bar ${site.active === 0 ? 'site-card__bar--inactive' : ''}`} />
              <div className="site-card__body">
                <div className="site-card__top">
                  <div>
                    <div className="site-card__name">{site.name}</div>
                    <div className="site-card__meta mt-2">
                      <div className="site-card__meta-row">
                        <MapPin size={13} className="text-primary" />
                        <span>{site.location}</span>
                      </div>
                      {site.supervisor && (
                        <div className="site-card__meta-row">
                          <User size={13} className="text-muted" />
                          <span>{site.supervisor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`badge ${site.active === 0 ? 'badge--danger' : 'badge--success'}`}>
                    {site.active === 0 ? 'Archived' : 'Active'}
                  </span>
                </div>

                <div className="site-card__stats">
                  <div className="site-stat">
                    <div className="site-stat__num">{stats.workers}</div>
                    <div className="site-stat__label">Workers</div>
                  </div>
                  <div className="site-stat">
                    <div className="site-stat__num site-stat__num--green">{stats.invoices}</div>
                    <div className="site-stat__label">Bills</div>
                  </div>
                </div>
              </div>

              <div className="site-card__actions">
                <button className="btn btn--secondary btn--sm flex gap-2 items-center" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(site)}>
                  <Edit2 size={13} /> Edit &amp; Manage
                </button>
              </div>
            </div>
          );
        }) : (
          <div className="empty-state">
            <Users size={48} className="empty-state__icon" />
            <h3>No sites found</h3>
            <p>{search ? 'Try a different search.' : 'Add your first work site.'}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModal && (
        <div className="modal-overlay" onClick={() => setIsModal(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Edit Site' : 'New Site'}</span>
              <button className="modal-close" onClick={() => setIsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit} className="form-block">
                <div className="field">
                  <label className="field-label">Site Name</label>
                  <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Metro Depot Phase-2" required />
                </div>
                <div className="field">
                  <label className="field-label">Location</label>
                  <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Salt Lake, Kolkata" required />
                </div>
                <div className="field">
                  <label className="field-label">Supervisor <span className="text-muted">(optional)</span></label>
                  <input className="input" value={supervisor} onChange={e => setSupervisor(e.target.value)} placeholder="Supervisor name" />
                </div>
                {editId && (
                  <div className="field">
                    <label className="field-label">Status</label>
                    <select className="select" value={active} onChange={e => setActive(e.target.value)}>
                      <option value={1}>Active</option>
                      <option value={0}>Archived / Completed</option>
                    </select>
                  </div>
                )}

                {editId && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                    {!confirmDelete ? (
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmDelete(true)}>
                        <Trash2 size={13} /> Manage Deletion / Closure
                      </button>
                    ) : (
                      <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 11, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="flex gap-2 items-center mb-1">
                          <AlertTriangle size={16} style={{ color: 'var(--c-danger)', flexShrink: 0 }} />
                          <span className="text-sm" style={{ color: 'var(--c-danger)', fontWeight: 700 }}>Choose how to remove this site:</span>
                        </div>
                        
                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--card-2)', color: 'var(--t-1)' }} onClick={() => handleSiteAction('archive')}>
                          <Archive size={13} className="text-primary" /> Close Site (Keep All Records)
                        </button>
                        
                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--card-2)', color: 'var(--t-1)' }} onClick={() => handleSiteAction('delete_only')}>
                          <Trash2 size={13} style={{ color: '#f59e0b' }} /> Delete Site Only (Keep Records)
                        </button>

                        <button type="button" className="btn btn--sm" style={{ justifyContent: 'flex-start', background: 'var(--c-danger)', color: 'white', border: 'none' }} onClick={() => handleSiteAction('delete_all')}>
                          <AlertTriangle size={13} /> Delete Site &amp; All Records
                        </button>

                        <button type="button" className="btn btn--secondary btn--sm mt-1" onClick={() => setConfirmDelete(false)}>Cancel</button>
                      </div>
                    )}
                  </div>
                )}
                <div className="modal-footer" style={{ padding: 0, border: 'none', marginTop: '4px' }}>
                  <button type="button" className="btn btn--secondary" onClick={() => setIsModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn--primary">
                    <CheckCircle size={15} /> {editId ? 'Save' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
