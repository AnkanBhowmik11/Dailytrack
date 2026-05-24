import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  Save, Download, Upload, Shield, CheckCircle, AlertTriangle,
  UserPlus, Building2, CreditCard,
  Percent, ChevronRight, KeyRound, ClipboardCheck, Crown, Copy, UserCog, Sun, Moon
} from 'lucide-react';
import { registerTeamMember, getCurrentSession } from '../auth';

/* ── Constants ─────────────────────────────────────────────── */

const OWNER_EMAIL = 'ankanbhowmik11@gmail.com';

const AVATAR_COLORS = ['#4f46e5','#059669','#0284c7','#7c3aed','#d97706','#dc2626'];

/* ── Random password generator ──────────────────────────────── */
function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/* ── Section accordion ─ OUTSIDE parent to avoid unmount bug ── */
function Section({ id, title, icon: Icon, bg, expandedSection, setExpandedSection, children }) {
  const isOpen = expandedSection === id;
  return (
    <div className="settings-section">
      <div className="settings-list">
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <button
            type="button"
            className="settings-row"
            style={{ borderRadius: 0, borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
            onClick={() => setExpandedSection(isOpen ? null : id)}
          >
            <div className="settings-row__left">
              <div className="settings-row__icon" style={{ background: bg || 'rgba(79,70,229,0.1)', color: bg ? 'white' : 'var(--c-primary)' }}>
                <Icon size={16} />
              </div>
              <div className="settings-row__label">{title}</div>
            </div>
            <ChevronRight size={15} className="settings-row__right" style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {isOpen && <div style={{ padding: 16 }}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Main Settings ──────────────────────────────────────────── */
export default function Settings() {
  const settings = useLiveQuery(() => db.companySettings.get('main'));

  const [name, setName]                     = useState('');
  const [address, setAddress]               = useState('');
  const [gstin, setGstin]                   = useState('');
  const [defaultOtRate, setDefaultOtRate]   = useState(100);
  const [defaultGstRate, setDefaultGstRate] = useState(18);
  const [logo, setLogo]                     = useState('');
  const [panNo, setPanNo]                   = useState('');
  const [bankName, setBankName]             = useState('');
  const [bankBranch, setBankBranch]         = useState('');
  const [bankAccount, setBankAccount]       = useState('');
  const [bankIfsc, setBankIfsc]             = useState('');
  const [companySubtitle, setSubtitle]      = useState('');
  const [theme, setTheme]                   = useState('light');

  /* Access */
  const [teamEmail, setTeamEmail]         = useState('');
  const [newRole, setNewRole]             = useState('admin');
  const [isRegistering, setIsRegistering] = useState(false);
  const [teamMembers, setTeamMembers]     = useState([]);
  const [inviteResult, setInviteResult]   = useState(null); // { email, pwd, role }
  const [copied, setCopied]               = useState(false);

  const [isLoading, setIsLoading]           = useState(false);

  /* UI */
  const [toast, setToast]                     = useState(null);
  const [expandedSection, setExpandedSection] = useState('company');

  useEffect(() => {
    if (settings) {
      setName(settings.name || '');
      setAddress(settings.address || '');
      setGstin(settings.gstin || '');
      setDefaultOtRate(settings.defaultOtRate || 100);
      setDefaultGstRate(settings.defaultGstRate || 18);
      setLogo(settings.logo || '');
      setPanNo(settings.panNo || '');
      setBankName(settings.bankName || '');
      setBankBranch(settings.bankBranch || '');
      setBankAccount(settings.bankAccount || '');
      setBankIfsc(settings.bankIfsc || '');
      setSubtitle(settings.companySubtitle || '');
      setTheme(settings.theme || 'light');
      setTeamMembers(settings.teamMembers || []);
    }
  }, [settings]);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const initials = (email) => (email ? email.slice(0, 2).toUpperCase() : '??');

  /* ── Save settings ── */
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const currentSettings = await db.companySettings.get('main') || {};
      await db.companySettings.put({
        ...currentSettings,
        id: 'main', name, address, gstin,
        defaultOtRate: Number(defaultOtRate),
        defaultGstRate: Number(defaultGstRate),
        logo, panNo, bankName, bankBranch, bankAccount, bankIfsc,
        companySubtitle, teamMembers, theme,
        currency: 'INR', currencySymbol: '₹',
      });
      document.body.classList.toggle('dark-theme', theme === 'dark');
      showToast('success', 'Settings saved!');
    } catch (err) {
      showToast('danger', 'Save failed');
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setLogo(reader.result);
    reader.readAsDataURL(file);
  };

  /* ── Invite team member ── */
  const handleRegisterTeam = async () => {
    if (!teamEmail.trim()) { showToast('danger', 'Enter an email'); return; }
    const email = teamEmail.trim().toLowerCase();
    if (email === OWNER_EMAIL) { showToast('danger', 'That is the owner account'); return; }
    if (teamMembers.find(m => m.email === email)) { showToast('danger', 'Already added'); return; }

    setIsRegistering(true);
    setInviteResult(null);
    const pwd = generatePassword();
    try {
      await registerTeamMember(email, pwd);
      const updated = [...teamMembers, { email, accessLevel: newRole }];
      setTeamMembers(updated);
      await db.companySettings.update('main', { teamMembers: updated });
      setTeamEmail('');
      setInviteResult({ email, pwd, role: newRole });
    } catch (err) {
      showToast('danger', err.message);
    }
    setIsRegistering(false);
  };

  const handleRemoveMember = async (email) => {
    if (!window.confirm(`Remove ${email} from team?`)) return;
    const updated = teamMembers.filter(m => m.email !== email);
    setTeamMembers(updated);
    await db.companySettings.update('main', { teamMembers: updated });
    showToast('success', 'Member removed');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  /* ── Render ── */
  return (
    <div>
      <div className="page-header">
        <div className="page-header__left">
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Company info, access &amp; backup</p>
        </div>
      </div>

      {/* ── Company form ── */}
      <form onSubmit={handleSave}>
        <div className="settings-sections">

          <Section id="company" title="Company Info" icon={Building2} bg="linear-gradient(135deg,#4f46e5,#7c3aed)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
            <div className="form-block">
              <div className="field">
                <label className="field-label">Company Name</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="ABC Constructions Ltd." required />
              </div>
              <div className="field">
                <label className="field-label">Subtitle / Tagline</label>
                <input className="input" value={companySubtitle} onChange={e => setSubtitle(e.target.value)} placeholder="e.g. Manpower Services Provider" />
              </div>
              <div className="field">
                <label className="field-label">Office Address</label>
                <textarea className="input textarea" rows={3} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full mailing address…" required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">GSTIN</label>
                  <input className="input" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="19AAAAA1111A1Z1" />
                </div>
                <div className="field">
                  <label className="field-label">PAN No.</label>
                  <input className="input" value={panNo} onChange={e => setPanNo(e.target.value)} placeholder="ABCDE1234F" />
                </div>
              </div>
              <div className="field">
                <label className="field-label">Company Logo</label>
                <input type="file" className="input" accept="image/*" onChange={handleLogoUpload} style={{ padding: '6px' }} />
                {logo && <img src={logo} alt="logo" style={{ maxHeight: 44, maxWidth: 150, objectFit: 'contain', marginTop: 8, borderRadius: 7, border: '1px solid var(--border)' }} />}
              </div>
            </div>
          </Section>

          <Section id="defaults" title="Payroll &amp; GST Defaults" icon={Percent} bg="linear-gradient(135deg,#059669,#0284c7)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
            <div className="form-block">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Default OT Rate (₹/hr)</label>
                  <input className="input" type="number" min="0" value={defaultOtRate} onChange={e => setDefaultOtRate(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field-label">Default GST Rate (%)</label>
                  <input className="input" type="number" min="0" max="100" value={defaultGstRate} onChange={e => setDefaultGstRate(e.target.value)} />
                </div>
              </div>
            </div>
          </Section>

          <Section id="bank" title="Bank Details" icon={CreditCard} bg="linear-gradient(135deg,#0ea5e9,#0284c7)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
            <div className="form-block">
              <div className="field-row">
                <div className="field">
                  <label className="field-label">Bank Name</label>
                  <input className="input" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="State Bank of India" />
                </div>
                <div className="field">
                  <label className="field-label">Branch</label>
                  <input className="input" value={bankBranch} onChange={e => setBankBranch(e.target.value)} placeholder="Airport Branch" />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label">A/C Number</label>
                  <input className="input" value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="32373044435" />
                </div>
                <div className="field">
                  <label className="field-label">IFSC Code</label>
                  <input className="input" value={bankIfsc} onChange={e => setBankIfsc(e.target.value)} placeholder="SBIN0003029" />
                </div>
              </div>
            </div>
          </Section>

          <Section id="appearance" title="Appearance" icon={Sun} bg="linear-gradient(135deg,#f59e0b,#ea580c)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
            <div className="form-block">
              <div className="gst-type-toggle">
                {[
                  { val: 'light', label: 'Light', Icon: Sun  },
                  { val: 'dark',  label: 'Dark',  Icon: Moon },
                ].map(({ val, label, Icon: MIcon }) => (
                  <button key={val} type="button" className={`gst-type-btn ${theme === val ? 'active' : ''}`} onClick={() => setTheme(val)}>
                    <MIcon size={14} style={{ margin: '0 auto 3px', display: 'block' }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          <button type="submit" className="btn btn--primary btn--full"><Save size={15} /> Save Settings</button>

        </div>
      </form>

      {/* ── Access & Backup ── */}
      <div style={{ marginTop: 16 }} className="settings-sections">

        {/* Team Access */}
        <Section id="access" title="Team Access" icon={KeyRound} bg="linear-gradient(135deg,#4f46e5,#7c3aed)" expandedSection={expandedSection} setExpandedSection={setExpandedSection}>
          <div className="form-block">

            {/* Member list */}
            <div>
              {/* Owner */}
              <div className="team-member-row" style={{ borderColor: 'rgba(79,70,229,0.25)', background: 'rgba(79,70,229,0.04)', marginBottom: 6 }}>
                <div className="team-member-row__avatar" style={{ background: '#4f46e5' }}>AN</div>
                <div className="team-member-row__info">
                  <div className="team-member-row__email">{OWNER_EMAIL}</div>
                  <div className="team-member-row__role" style={{ color: '#4f46e5' }}>
                    <Crown size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                    Owner · Admin
                  </div>
                </div>
                <span style={{ fontSize: '0.67rem', fontWeight: 700, color: '#4f46e5', background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)', padding: '3px 9px', borderRadius: 99, flexShrink: 0 }}>Admin</span>
              </div>

              {teamMembers.length === 0 && (
                <div style={{ padding: '11px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--t-3)', background: 'var(--card-2)', borderRadius: 9, border: '1px dashed var(--border)', marginBottom: 4 }}>
                  No members added yet
                </div>
              )}
              {teamMembers.map((m, idx) => {
                const isAdmin = m.accessLevel === 'admin';
                return (
                  <div key={m.email} className="team-member-row" style={{ marginBottom: 6 }}>
                    <div className="team-member-row__avatar" style={{ background: AVATAR_COLORS[(idx + 1) % AVATAR_COLORS.length] }}>
                      {initials(m.email)}
                    </div>
                    <div className="team-member-row__info">
                      <div className="team-member-row__email">{m.email}</div>
                      <div className="team-member-row__role" style={{ color: isAdmin ? '#4f46e5' : '#059669' }}>
                        {isAdmin
                          ? <><UserCog size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />Admin</>
                          : <><ClipboardCheck size={10} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />Attendance Only</>
                        }
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.67rem', fontWeight: 700,
                      color: isAdmin ? '#4f46e5' : '#059669',
                      background: isAdmin ? 'rgba(79,70,229,0.08)' : 'rgba(5,150,105,0.08)',
                      border: `1px solid ${isAdmin ? 'rgba(79,70,229,0.2)' : 'rgba(5,150,105,0.2)'}`,
                      padding: '3px 9px', borderRadius: 99, flexShrink: 0,
                    }}>{isAdmin ? 'Admin' : 'Attendance'}</span>
                    <button type="button" className="btn btn--icon btn--danger" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} onClick={() => handleRemoveMember(m.email)} title="Remove">✕</button>
                  </div>
                );
              })}
            </div>

            {/* ── Add member ── */}
            <div style={{ background: 'var(--card-2)', border: '1px solid var(--border)', borderRadius: 11, padding: 14 }}>

              {/* Role toggle */}
              <div className="gst-type-toggle" style={{ marginBottom: 12 }}>
                {[
                  { val: 'admin',      label: 'Admin',      Icon: UserCog,      color: '#4f46e5', sub: 'Full access' },
                  { val: 'attendance', label: 'Attendance',  Icon: ClipboardCheck, color: '#059669', sub: 'Attendance only' },
                ].map(({ val, label, Icon: RIcon, color, sub }) => (
                  <button
                    key={val}
                    type="button"
                    className={`gst-type-btn ${newRole === val ? 'active' : ''}`}
                    style={newRole === val ? { borderColor: color, background: `${color}12`, color } : {}}
                    onClick={() => setNewRole(val)}
                  >
                    <RIcon size={14} style={{ margin: '0 auto 4px', display: 'block' }} />
                    {label}<small>{sub}</small>
                  </button>
                ))}
              </div>

              <div className="field" style={{ marginBottom: 10 }}>
                <label className="field-label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={teamEmail}
                  onChange={e => setTeamEmail(e.target.value)}
                  placeholder="member@example.com"
                  autoComplete="off"
                />
              </div>

              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={handleRegisterTeam}
                disabled={isRegistering || !teamEmail.trim()}
              >
                {isRegistering ? 'Sending…' : <><UserPlus size={14} /> Send Invite</>}
              </button>

              {/* ── Generated password card ── */}
              {inviteResult && (
                <div style={{
                  marginTop: 12, padding: '12px 14px',
                  background: 'rgba(5,150,105,0.06)',
                  border: '1px solid rgba(5,150,105,0.25)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    Account Created for {inviteResult.email}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--t-2)', marginBottom: 8, lineHeight: 1.5 }}>
                    The account is ready. Send their login password securely using your email app:
                  </div>
                  
                  <a
                    className="btn btn--primary btn--sm"
                    href={`mailto:${inviteResult.email}?subject=Your DailyTrack Login Details&body=Hello,%0D%0A%0D%0AYou have been invited to DailyTrack.%0D%0A%0D%0ALogin Email: ${inviteResult.email}%0D%0APassword: ${inviteResult.pwd}%0D%0ARole: ${inviteResult.role === 'admin' ? 'Admin' : 'Attendance Only'}%0D%0A%0D%0APlease log in to access the dashboard.`}
                    style={{ textDecoration: 'none', display: 'flex', justifyContent: 'center' }}
                  >
                    Send via Email App
                  </a>
                  
                  <div style={{ fontSize: '0.69rem', color: 'var(--t-3)', marginTop: 10, textAlign: 'center' }}>
                    Role: <strong style={{ color: inviteResult.role === 'admin' ? '#4f46e5' : '#059669' }}>{inviteResult.role === 'admin' ? 'Admin' : 'Attendance Only'}</strong>
                  </div>
                </div>
              )}
            </div>

          </div>
        </Section>



      </div>

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}
