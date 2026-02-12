import { setToken, getToken } from './authApi';

const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");

/**
 * Initialize Google OAuth - redirects user to Google login
 */
export async function signInWithGoogle() {
  try {
    const response = await fetch(`${API_BASE}/auth/google/auth-url`);
    if (!response.ok) throw new Error('Failed to get Google auth URL');
    
    const { authUrl } = await response.json();
    window.location.href = authUrl;
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Handle Google OAuth callback
 */
export async function handleGoogleCallback() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    
    if (!code) {
      throw new Error('No authorization code received from Google');
    }

    const response = await fetch(`${API_BASE}/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    });

    const data = await response.json();

    if (!response.ok) {
      throw {
        status: response.status,
        message: data.error || 'Google authentication failed'
      };
    }

    setToken(data.token, { remember: true });

    return {
      success: true,
      user: data.user,
      isNewUser: data.isNewUser,
      message: data.message
    };
  } catch (error) {
    console.error('Google Callback Error:', error);
    throw error;
  }
}

/**
 * Link Google account to existing user
 */
export async function linkGoogleAccount(googleId) {
  try {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE}/auth/link-google`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ googleId })
    });

    if (!response.ok) {
      const data = await response.json();
      throw {
        status: response.status,
        message: data.error || 'Failed to link Google account'
      };
    }

    return { success: true, message: 'Google account linked successfully' };
  } catch (error) {
    console.error('Link Google Error:', error);
    throw error;
  }
}
