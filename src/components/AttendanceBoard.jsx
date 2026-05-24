import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { pushRecordToCloud, deleteRecordInCloud } from '../sync';
import { CheckSquare, XCircle, Check, AlertCircle, Download, X } from 'lucide-react';
import { generateAttendancePDF } from '../utils/generateAttendancePDF';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function AttendanceBoard() {
  const sites = useLiveQuery(() => db.sites.where('active').equals(1).toArray());

  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedDate, setSelectedDate]     = useState(new Date().toISOString().slice(0, 10));
  const [toast, setToast]                   = useState(null);
  const [showPdfModal, setShowPdfModal]     = useState(false);
  const [pdfMonth, setPdfMonth]             = useState(new Date().getMonth() + 1);
  const [pdfYear, setPdfYear]               = useState(new Date().getFullYear());

  /* Auto-select first site */
  useEffect(() => {
    if (sites && sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(String(sites[0].id));
    }
  }, [sites]);

  const employees = useLiveQuery(() => {
    if (!selectedSiteId) return Promise.resolve([]);
    return db.employees
      .where('siteId').equals(Number(selectedSiteId))
      .filter(e => e.active === 1)
      .toArray();
  }, [selectedSiteId]);

  const attendanceRecords = useLiveQuery(() => {
    if (!selectedSiteId || !selectedDate) return Promise.resolve([]);
    return db.attendance
      .where('date').equals(selectedDate)
      .filter(r => r.siteId === Number(selectedSiteId))
      .toArray();
  }, [selectedSiteId, selectedDate]);

  const attendanceMap = React.useMemo(() => {
    const map = {};
    if (attendanceRecords) attendanceRecords.forEach(r => { map[r.employeeId] = r; });
    return map;
  }, [attendanceRecords]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2500);
  };

  const updateAttendance = async (employeeId, status, otHours = null) => {
    if (!selectedSiteId || !selectedDate) return;
    try {
      const existing = attendanceMap[employeeId];
      const finalOt = otHours !== null ? Number(otHours) : (existing ? existing.otHours : 0);
      const payload = {
        date: selectedDate,
        employeeId: Number(employeeId),
        siteId: Number(selectedSiteId),
        status,
        otHours: finalOt
      };
      if (existing) payload.id = existing.id;
      const key = await db.attendance.put(payload);
      await pushRecordToCloud('attendance', { ...payload, id: key });
      showToast('success', 'Saved');
    } catch (err) {
      console.error(err);
      showToast('danger', 'Save failed');
    }
  };

  const markAllPresent = async () => {
    if (!employees?.length) return;
    try {
      for (const emp of employees) {
        const existing = attendanceMap[emp.id];
        const payload = {
          date: selectedDate, employeeId: emp.id,
          siteId: Number(selectedSiteId), status: 'P',
          otHours: existing ? existing.otHours : 0
        };
        if (existing) payload.id = existing.id;
        const key = await db.attendance.put(payload);
        await pushRecordToCloud('attendance', { ...payload, id: key });
      }
      showToast('success', `All ${employees.length} marked Present`);
    } catch (err) {
      console.error(err);
      showToast('danger', 'Error');
    }
  };

  const clearAll = async () => {
    if (!employees?.length) return;
    const ids = Object.values(attendanceMap).map(r => r.id).filter(Boolean);
    if (!ids.length) return;
    try {
      await db.attendance.bulkDelete(ids);
      for (const id of ids) await deleteRecordInCloud('attendance', id);
      showToast('success', 'Cleared');
    } catch (err) {
      console.error(err);
    }
  };

  const downloadMonthlyPDF = async () => {
    if (!selectedSiteId || !employees?.length) return;
    try {
      const ms = `${pdfYear}-${String(pdfMonth).padStart(2,'0')}`;
      const recs = await db.attendance.where('date').between(`${ms}-01`,`${ms}-31`,true,true)
        .filter(r => r.siteId === Number(selectedSiteId))
        .toArray();
      const siteName = sites.find(s => s.id === Number(selectedSiteId))?.name || 'Site';
      await generateAttendancePDF(siteName, pdfMonth, pdfYear, employees, recs);
      setShowPdfModal(false);
    } catch (e) {
      console.error(e);
      showToast('danger', 'Failed to generate PDF');
    }
  };

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div>
      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">Mark daily attendance &amp; overtime</p>
        </div>
        {selectedSiteId && employees?.length > 0 && (
          <button className="btn btn--sm btn--primary" onClick={() => setShowPdfModal(true)}>
            <Download size={14} /> Download PDF
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="att-controls">
        <div className="att-controls__row">
          <select
            className="select"
            value={selectedSiteId}
            onChange={e => setSelectedSiteId(e.target.value)}
          >
            <option value="" disabled>Choose site…</option>
            {sites && sites.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <input
            type="date"
            className="input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
        </div>

        {/* Bulk actions */}
        {employees && employees.length > 0 && (
          <div className="bulk-bar">
            <span className="bulk-bar__label">{employees.length} workers</span>
            <button className="btn btn--sm btn--success" onClick={markAllPresent}>
              <CheckSquare size={14} /> All Present
            </button>
            <button className="btn btn--sm btn--danger" onClick={clearAll}>
              <XCircle size={14} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* ── Employee rows ── */}
      {employees && employees.length > 0 ? (
        <div>
          {employees.map(emp => {
            const rec    = attendanceMap[emp.id];
            const status = rec?.status || '';
            const ot     = rec?.otHours ?? 0;
            return (
              <div key={emp.id} className="emp-row">
                <div className="emp-row__avatar">{initials(emp.name)}</div>

                <div className="emp-row__info">
                  <div className="emp-row__name">{emp.name}</div>
                  <div className="emp-row__role">{emp.designation || 'Laborer'}</div>
                </div>

                <div className="emp-row__actions">
                  {/* Attendance chips */}
                  <div className="att-chips">
                    {[
                      { key: 'P',  label: 'P',  cls: 'p' },
                      { key: 'HD', label: 'HD', cls: 'hd' },
                      { key: 'A',  label: 'A',  cls: 'a' },
                      { key: 'L',  label: 'L',  cls: 'l' },
                    ].map(({ key, label, cls }) => (
                      <button
                        key={key}
                        className={`att-chip ${status === key ? `${cls}--active` : ''}`}
                        onClick={() => updateAttendance(emp.id, key)}
                        title={{ P: 'Present', HD: 'Half Day', A: 'Absent', L: 'Leave' }[key]}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* OT counter */}
                  <div className="ot-counter">
                    <button
                      className="ot-btn"
                      onClick={() => updateAttendance(emp.id, status || 'P', Math.max(0, ot - 1))}
                      disabled={ot <= 0}
                    >−</button>
                    <span className="ot-val">{ot}h OT</span>
                    <button
                      className="ot-btn"
                      onClick={() => updateAttendance(emp.id, status || 'P', ot + 1)}
                    >+</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <CheckSquare size={48} className="empty-state__icon" />
          {selectedSiteId
            ? <><h3>No workers on this site</h3><p>Add staff to this site first.</p></>
            : <><h3>Choose a site</h3><p>Select a work site above to begin.</p></>
          }
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
          {toast.text}
        </div>
      )}
      {/* ── PDF Download Modal ── */}
      {showPdfModal && (
        <div className="modal-overlay" onClick={() => setShowPdfModal(false)}>
          <div className="modal-sheet" style={{ maxWidth: '320px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Download Attendance</span>
              <button className="modal-close" onClick={() => setShowPdfModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select className="select" value={pdfMonth} onChange={e => setPdfMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select className="select" value={pdfYear} onChange={e => setPdfYear(Number(e.target.value))}>
                {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button className="btn btn--primary btn--full mt-2" onClick={downloadMonthlyPDF}>
                <Download size={15} /> Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
