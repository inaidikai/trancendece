import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleGoogleCallback } from '../auth/googleOAuth';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    handleGoogleCallback()
      .then((result) => {
        console.log('Auth successful:', result);
        navigate('/dashboard', { replace: true });
      })
      .catch((error) => {
        console.error('Auth failed:', error);
        setError(error.message);
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="auth-layout">
        <div className="auth-card-shell" style={{ maxWidth: '420px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#8a2d23' }}>Authentication Failed</h2>
          <p style={{ fontSize: '16px', marginBottom: '16px' }}>{error}</p>
          <p style={{ fontSize: '14px', color: 'rgba(35, 4, 1, 0.7)' }}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-layout">
      <div className="auth-card-shell" style={{ maxWidth: '420px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Completing sign-in...</h2>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '3px solid #f4e4a8',
          borderTop: '3px solid #3B2A28',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '20px auto'
        }}></div>
        <style>{
          `@keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }`
        }</style>
      </div>
    </div>
  );
}
