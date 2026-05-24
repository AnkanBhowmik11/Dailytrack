import { db } from './db';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT_ANON_KEY } from './supabaseConfig';

// Helper to get active Supabase credentials
// Returns different keys for auth vs data depending on what's configured
export async function getAuthConfig() {
  // For Auth endpoints, prefer the JWT anon key if configured
  // Otherwise fall back to the publishable key (some Supabase plans accept it)
  const authKey = SUPABASE_JWT_ANON_KEY || SUPABASE_ANON_KEY;
  return {
    url: SUPABASE_URL.replace(/\/$/, ''),
    key: authKey,
    dataKey: SUPABASE_ANON_KEY // For data REST API
  };
}

// 1. Sign Up
export async function signUpUser(email, password) {
  const config = await getAuthConfig();

  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': config.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    let errMsg = 'Signup failed.';
    try {
      const err = await response.json();
      errMsg = err.msg || err.error_description || err.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  
  // Set syncEnabled in local settings automatically
  const settings = await db.companySettings.get('main') || {};
  await db.companySettings.put({
    ...settings,
    id: 'main',
    syncEnabled: true
  });

  return data;
}

// 2. Sign In
export async function signInUser(email, password) {
  const config = await getAuthConfig();

  const response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': config.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    let errMsg = 'Invalid login credentials.';
    try {
      const err = await response.json();
      errMsg = err.error_description || err.msg || err.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await response.json();
  
  // Create session object
  const session = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + ((data.expires_in || 3600) * 1000),
    user: {
      id: data.user?.id || '',
      email: data.user?.email || email
    }
  };

  // Save session
  localStorage.setItem('dt_session', JSON.stringify(session));
  
  // Save/update in DB
  const settings = await db.companySettings.get('main') || {};
  await db.companySettings.put({
    ...settings,
    id: 'main',
    syncEnabled: true
  });

  return session;
}

// 3. Sign Out
export async function signOutUser() {
  const session = getCurrentSession();
  const config = await getAuthConfig();

  if (session && session.accessToken && config) {
    try {
      await fetch(`${config.url}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'apikey': config.key,
          'Authorization': `Bearer ${session.accessToken}`
        }
      });
    } catch (e) {
      console.warn("Failed to notify Supabase logout endpoint, clearing local session anyway.", e);
    }
  }

  // Clear session token from storage
  localStorage.removeItem('dt_session');
  localStorage.removeItem('dt_offline_mode');

  // Safely wipe ALL local Dexie IndexedDB tables to protect data privacy
  try {
    await db.transaction('rw', [db.companySettings, db.sites, db.employees, db.attendance, db.invoices], async () => {
      await db.companySettings.clear();
      await db.sites.clear();
      await db.employees.clear();
      await db.attendance.clear();
      await db.invoices.clear();
    });
  } catch (e) {
    console.warn('Failed to wipe local DB on logout:', e);
  }

  // Re-seed empty company settings
  await db.companySettings.put({
    id: 'main',
    name: '',
    logo: '',
    address: '',
    gstin: '',
    defaultOtRate: 100,
    defaultGstRate: 18,
    currency: 'INR',
    currencySymbol: '₹',
    theme: 'light',
    syncEnabled: false
  });
}

// 4. Get Current Active Session (Synchronous check for render flow)
export function getCurrentSession() {
  const sessionStr = localStorage.getItem('dt_session');
  if (!sessionStr) return null;

  try {
    const session = JSON.parse(sessionStr);
    // If token has expired, invalidate session
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem('dt_session');
      return null;
    }
    return session;
  } catch (e) {
    localStorage.removeItem('dt_session');
    return null;
  }
}

// 5. Refresh Token (called automatically when token is near-expiry)
export async function refreshSession() {
  const session = getCurrentSession();
  if (!session || !session.refreshToken) return null;

  const config = await getAuthConfig();

  try {
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'apikey': config.key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refresh_token: session.refreshToken })
    });

    if (!response.ok) return null;

    const data = await response.json();
    const newSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + ((data.expires_in || 3600) * 1000),
      user: {
        id: data.user?.id || session.user.id,
        email: data.user?.email || session.user.email
      }
    };

    localStorage.setItem('dt_session', JSON.stringify(newSession));
    return newSession;
  } catch (e) {
    console.warn('Failed to refresh session:', e);
    return null;
  }
}

// 6. Register a Team Member account (called by owner from Settings)
// Creates a Supabase Auth account so that person can log in with their own email + shared password
export async function registerTeamMember(email, password) {
  const config = await getAuthConfig();

  const response = await fetch(`${config.url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'apikey': config.key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  let data = null;
  try { data = await response.json(); } catch (_) {}

  if (!response.ok) {
    const errMsg = data?.msg || data?.error_description || data?.message || 'Failed to register account.';
    // "User already registered" is acceptable — account already exists
    if (errMsg.toLowerCase().includes('already registered') || errMsg.toLowerCase().includes('already been registered')) {
      return { alreadyExists: true, email };
    }
    throw new Error(errMsg);
  }

  return { success: true, email };
}

// 7. Change Password for current signed-in user
export async function changePassword(newPassword) {
  const session = getCurrentSession();
  if (!session || !session.accessToken) throw new Error('Not signed in.');
  const config = await getAuthConfig();

  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': config.key,
      'Authorization': `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });

  if (!response.ok) {
    let errMsg = 'Password change failed.';
    try {
      const err = await response.json();
      errMsg = err.msg || err.error_description || err.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return { success: true };
}
