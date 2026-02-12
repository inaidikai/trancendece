import React, { useState } from 'react';
import { signInWithGoogle } from '../auth/googleOAuth';
import AuthButton from '../auth/components/AuthButton';

export function GoogleSignInButton({ onSignInStart, onSignInError }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      onSignInStart?.();
      await signInWithGoogle();
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      onSignInError?.(error);
      setIsLoading(false);
    }
  };

  return (
    <AuthButton 
      onClick={handleGoogleSignIn} 
      disabled={isLoading}
      variant="secondary" 
      block
    >
      <span className="auth-google-content">
        <svg className="auth-google-icon" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#EA4335"
            d="M24 9.5c3.2 0 5.8 1.3 7.6 3l5.2-5.2C33.6 3.6 29.1 2 24 2 14.9 2 7.1 7.2 3.6 14.7l6.6 5.1C12 13.6 17.5 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46 24c0-1.6-.1-2.8-.4-4H24v8.1h12.4c-.5 2.7-2 5-4.3 6.5l6.6 5.1C42.8 36 46 30.6 46 24z"
          />
          <path
            fill="#FBBC05"
            d="M10.2 28.5c-.5-1.4-.8-2.8-.8-4.5s.3-3.1.8-4.5l-6.6-5.1C2.2 17 1.5 20.4 1.5 24s.7 7 2.1 9.6l6.6-5.1z"
          />
          <path
            fill="#34A853"
            d="M24 46c5.1 0 9.4-1.7 12.6-4.6l-6.6-5.1c-1.8 1.2-4.1 2-6 2-6.5 0-12-4.1-13.8-9.8l-6.6 5.1C7.1 40.8 14.9 46 24 46z"
          />
        </svg>
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </span>
    </AuthButton>
  );
}
