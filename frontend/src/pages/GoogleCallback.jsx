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
        console.log('Navigating to /world...');
        navigate('/world', { replace: true });
      })
      .catch((error) => {
        console.error('Auth failed:', error);
        const errorMsg = error?.message || error?.error || String(error);
        setError(errorMsg);
        console.log('Will redirect to /login in 3 seconds');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      });
  }, [navigate]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#f4e4a8',
        padding: '20px'
      }}>
        <div style={{
          maxWidth: '420px',
          textAlign: 'center',
          backgroundColor: '#faf5e8',
          padding: '40px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(35, 4, 1, 0.1)'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#8a2d23' }}>Authentication Failed</h2>
          <p style={{ fontSize: '16px', marginBottom: '16px', color: '#3B2A28' }}>{error}</p>
          <p style={{ fontSize: '14px', color: 'rgba(35, 4, 1, 0.7)' }}>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f4e4a8',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '420px',
        textAlign: 'center',
        backgroundColor: '#faf5e8',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(35, 4, 1, 0.1)'
      }}>
        <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#3B2A28' }}>Completing sign-in...</h2>
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
