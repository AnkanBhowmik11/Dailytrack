import React, { useState } from 'react';
import { signInUser } from '../auth';
import { Mail, Eye, EyeOff, Loader2, WifiOff, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AuthPortal({ onAuthSuccess }) {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');



  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(''); setSuccessMsg('');
    if (!email.trim() || password.length < 6) {
      setErrorMsg('Enter your email and password (min 6 chars).');
      return;
    }
    setIsLoading(true);
    try {
      const session = await signInUser(email.trim(), password);
      setSuccessMsg('Signed in — loading your workspace…');
      setTimeout(() => onAuthSuccess(session), 900);
    } catch (err) {
      let msg = err.message || 'Authentication failed.';
      if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror'))
        msg = 'No connection. Check your internet or use Offline Mode.';
      else if (msg.toLowerCase().includes('invalid login'))
        msg = 'Incorrect email or password.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', width: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0f0c29 0%, #1a1040 45%, #24243e 100%)',
      padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'absolute', top: '-80px', right: '-60px',
        width: 280, height: 280, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-60px', left: '-40px',
        width: 220, height: 220, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 390,
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: '36px 28px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
      }}>

        {/* Logo + brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 66, height: 66, borderRadius: 20, margin: '0 auto 14px',
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(124,58,237,0.5)',
          }}>
            <img src="/icon.png" alt="dt" style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 12 }} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
            DailyTrack
          </div>
          <div style={{ fontSize: '0.77rem', color: 'rgba(255,255,255,0.4)', marginTop: 5, fontWeight: 500 }}>
            Sign in to your workspace
          </div>
        </div>

        {/* Alert messages */}
        {errorMsg && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            color: '#fca5a5', fontSize: '0.8rem', lineHeight: 1.5,
          }}>
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{
            background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            color: '#6ee7b7', fontSize: '0.8rem', lineHeight: 1.5,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <ShieldCheck size={15} style={{ flexShrink: 0 }} /> {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Email */}
          <div>
            <label style={{
              fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7,
            }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 11, padding: '12px 14px 12px 38px',
                  color: '#fff', fontSize: '0.92rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{
              fontSize: '0.68rem', fontWeight: 700, color: 'rgba(255,255,255,0.45)',
              textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 7,
            }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 11, padding: '12px 42px 12px 14px',
                  color: '#fff', fontSize: '0.92rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', padding: 0,
                }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Sign In button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 6, padding: '13px', borderRadius: 12, border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              color: '#fff', fontWeight: 700, fontSize: '0.95rem',
              fontFamily: 'Outfit, sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 6px 24px rgba(79,70,229,0.45)',
              opacity: isLoading ? 0.75 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {isLoading
              ? <><Loader2 size={17} className="animate-spin" /> Signing in…</>
              : <>Sign In <ArrowRight size={16} /></>
            }
          </button>

        </form>

      </div>

      <div style={{ marginTop: 20, fontSize: '0.68rem', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Access managed by your administrator
      </div>
    </div>
  );
}
