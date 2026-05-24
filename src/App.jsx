import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { synchronizeDatabase } from './sync';

import SitesManager    from './components/SitesManager';
import EmployeeManager from './components/EmployeeManager';
import AttendanceBoard from './components/AttendanceBoard';
import PayrollEngine   from './components/PayrollEngine';
import GSTBilling      from './components/GSTBilling';
import Settings        from './components/Settings';
import ErrorBoundary   from './components/ErrorBoundary';
import AuthPortal      from './components/AuthPortal';
import { getCurrentSession, signOutUser, changePassword } from './auth';

import {
  CalendarCheck, Building, Users, Wallet, Receipt,
  Settings as SettingsIcon, RefreshCw, CircleUser,
  Sun, Moon, Lock, LogOut, CheckCircle, AlertTriangle, X, Camera, Edit2, Save
} from 'lucide-react';

/* ── AccountModal — defined OUTSIDE App to prevent re-mount bug ─ */
function AccountModal({ session, settings, onClose, onLogout }) {
  const [newPwd, setNewPwd]       = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [toast, setToast]         = useState(null);

  const email    = session?.user?.email || 'ankanbhowmik11@gmail.com';
  const userName = settings?.userName || settings?.name || 'Company Admin';
  const userAvatar = settings?.userAvatar || null;
  const initials = userName.slice(0, 2).toUpperCase();
  const isOffline = !session;

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editAvatar, setEditAvatar] = useState(userAvatar);
  const [showPwd, setShowPwd] = useState(false);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        // Compress and resize using canvas
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Output compressed JPEG at 0.7 quality to keep IndexedDB footprint small
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setEditAvatar(compressedDataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    await db.companySettings.update('main', { userName: editName, userAvatar: editAvatar });
    setIsEditingProfile(false);
    showToast('success', 'Profile updated');
  };

  const handleChangePwd = async () => {
    if (newPwd.length < 6) { showToast('danger', 'Min 6 characters'); return; }
    if (newPwd !== confirmPwd) { showToast('danger', 'Passwords don\'t match'); return; }
    setPwdLoading(true);
    try {
      await changePassword(newPwd);
      showToast('success', 'Password updated');
      setNewPwd(''); setConfirmPwd('');
    } catch (e) { showToast('danger', e.message); }
    setPwdLoading(false);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 900 }} onClick={onClose}>
      <div
        className="modal-sheet"
        style={{ maxWidth: 360, marginTop: 'auto', marginBottom: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">Account</span>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Avatar + identity */}
          <div style={{ textAlign: 'center', position: 'relative' }}>
            {!isEditingProfile ? (
              <button className="btn btn--icon btn--secondary" style={{ position: 'absolute', top: 0, right: 0 }} onClick={() => setIsEditingProfile(true)}>
                <Edit2 size={13} />
              </button>
            ) : null}

            {isEditingProfile ? (
              <div className="form-block">
                <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 10px' }}>
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar" style={{ width: 64, height: 64, borderRadius: 20, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', fontWeight: 800 }}>{editName.slice(0, 2).toUpperCase()}</div>
                  )}
                  <label htmlFor="avatar-upload-input" style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--card-1)', border: '1px solid var(--border)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                    <Camera size={13} className="text-primary" />
                    <input id="avatar-upload-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                  </label>
                </div>
                <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Your Name" style={{ textAlign: 'center', fontWeight: 700 }} />
                <div className="flex gap-2 mt-2" style={{ justifyContent: 'center' }}>
                  <button className="btn btn--secondary btn--sm" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                  <button className="btn btn--primary btn--sm" onClick={handleSaveProfile}><Save size={13} /> Save</button>
                </div>
              </div>
            ) : (
              <>
                {userAvatar ? (
                  <img src={userAvatar} alt="Avatar" style={{ width: 60, height: 60, borderRadius: 18, objectFit: 'cover', margin: '0 auto 10px', display: 'block' }} />
                ) : (
                  <div style={{
                    width: 60, height: 60, borderRadius: 18,
                    background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 10px',
                    color: 'white', fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Outfit',
                  }}>{initials}</div>
                )}
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--t-1)' }}>{userName}</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--t-2)', marginTop: 2 }}>{email}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--c-primary)', background: 'var(--bg-secondary)', display: 'inline-block', padding: '4px 10px', borderRadius: 99, marginTop: 8 }}>
                  {isOffline ? 'Offline Mode' : 'Owner · Full Admin'}
                </div>
              </>
            )}
          </div>

          {/* Change password */}
          {session && (
            <div>
              {!showPwd ? (
                <button className="btn btn--secondary btn--full" onClick={() => setShowPwd(true)}>
                  <Lock size={14} /> Change Password
                </button>
              ) : (
                <div className="form-block" style={{ background: 'var(--bg-secondary)', padding: 14, borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--t-3)', marginBottom: 8 }}>Change Password</div>
                  <input className="input" type="password" placeholder="New password (min 6 chars)" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                  <input className="input" type="password" placeholder="Confirm password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} style={{ marginTop: 8 }} />
                  <div className="flex gap-2 mt-2">
                    <button className="btn btn--secondary btn--sm" style={{ flex: 1 }} onClick={() => { setShowPwd(false); setNewPwd(''); setConfirmPwd(''); }}>Cancel</button>
                    <button
                      className="btn btn--primary btn--sm"
                      style={{ flex: 1 }}
                      onClick={handleChangePwd}
                      disabled={pwdLoading || newPwd.length < 6 || newPwd !== confirmPwd}
                    >
                      {pwdLoading ? 'Saving…' : 'Update'}
                    </button>
                  </div>
                  {newPwd && confirmPwd && newPwd !== confirmPwd && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--c-danger)', marginTop: 4, textAlign: 'center' }}>Passwords do not match</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Logout */}
          {session && (
            <button className="btn btn--danger btn--full" onClick={onLogout}>
              <LogOut size={14} /> Log Out
            </button>
          )}
        </div>

        {toast && (
          <div className={`toast toast--${toast.type}`} style={{ position: 'static', margin: '8px 16px 16px', borderRadius: 10 }}>
            {toast.type === 'success' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Nav items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'attendance', label: 'Attend',  icon: CalendarCheck },
  { id: 'sites',      label: 'Sites',   icon: Building },
  { id: 'employees',  label: 'Staff',   icon: Users },
  { id: 'payroll',    label: 'Payroll', icon: Wallet },
  { id: 'billing',    label: 'Bills',   icon: Receipt },
  { id: 'settings',   label: 'More',    icon: SettingsIcon },
];

/* ── App ────────────────────────────────────────────────────── */
export default function App() {
  const settings = useLiveQuery(() => db.companySettings.get('main'));
  const [session, setSession]         = useState(getCurrentSession());
  const [activeTab, setActiveTab]     = useState('attendance');
  const [syncing, setSyncing]         = useState(false);
  const [syncStatus, setSyncStatus]   = useState('Synced');
  const [showAccount, setShowAccount] = useState(false);

  /* ── Apply theme ── */
  useEffect(() => {
    // Default light — only go dark if explicitly set
    document.body.classList.remove('dark-theme');
    if (settings?.theme === 'dark') {
      document.body.classList.add('dark-theme');
    }
  }, [settings]);

  /* ── Background sync ── */
  useEffect(() => {
    if (!session) return;
    const run = async () => {
      setSyncing(true); setSyncStatus('Syncing…');
      try {
        const res = await synchronizeDatabase();
        setSyncStatus(res?.success ? 'Synced' : 'Offline');
      } catch { setSyncStatus('Offline'); }
      finally { setSyncing(false); }
    };
    run();
    const id = setInterval(run, 30000);
    return () => clearInterval(id);
  }, [session]);

  /* ── Logout ── */
  const handleLogout = async () => {
    if (!window.confirm('Log out? Local data will be wiped for security.')) return;
    await signOutUser();
    localStorage.removeItem('dt_offline_mode');
    setSession(null);
    setActiveTab('attendance');
    setShowAccount(false);
  };

  /* ── Auth gate ── */
  if (!session) {
    return (
      <AuthPortal
        onAuthSuccess={(sess) => {
          setSession(sess);
        }}
      />
    );
  }

  /* ── View router ── */
  const renderView = () => {
    switch (activeTab) {
      case 'attendance': return <AttendanceBoard />;
      case 'sites':      return <SitesManager />;
      case 'employees':  return <EmployeeManager />;
      case 'payroll':    return <PayrollEngine />;
      case 'billing':    return <GSTBilling />;
      case 'settings':   return <Settings />;
      default:           return <AttendanceBoard />;
    }
  };

  return (
    <div className="app-wrap">

      {/* ── Header ── */}
      <header className="app-header no-print">
        <div className="app-header__brand">
          <img src="/icon.png" alt="logo" className="app-header__logo" />
          <span className="app-header__name">{settings?.name || 'DailyTrack'}</span>
        </div>

        <div className="app-header__right">
          {/* Sync indicator */}
          {session && (
            <button
              className={`icon-btn ${syncStatus === 'Offline' ? 'icon-btn--danger' : ''}`}
              title={syncStatus}
              style={{ cursor: 'default', color: syncStatus === 'Offline' ? 'var(--c-danger)' : 'var(--c-success)' }}
            >
              <RefreshCw size={15} className={syncing ? 'spin' : ''} />
            </button>
          )}

          {/* Account icon */}
          <button
            className="icon-btn"
            onClick={() => setShowAccount(true)}
            title="Account"
            id="account-btn"
            style={{ 
              padding: 0, 
              width: 32, 
              height: 32, 
              borderRadius: '50%', 
              overflow: 'hidden', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              border: settings?.userAvatar ? '2px solid var(--c-primary)' : '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              cursor: 'pointer'
            }}
          >
            {settings?.userAvatar ? (
              <img src={settings.userAvatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <CircleUser size={20} />
            )}
          </button>
        </div>
      </header>

      {/* ── Account modal ── */}
      {showAccount && (
        <AccountModal
          session={session}
          settings={settings}
          onClose={() => setShowAccount(false)}
          onLogout={handleLogout}
        />
      )}

      {/* ── Content ── */}
      <main className="page-content">
        <ErrorBoundary key={activeTab} onReset={() => setActiveTab('attendance')}>
          {renderView()}
        </ErrorBoundary>
      </main>

      {/* ── Bottom nav ── */}
      <nav className="bottom-nav no-print">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
