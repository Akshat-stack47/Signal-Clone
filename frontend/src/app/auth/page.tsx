'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';

type Step = 'phone' | 'otp' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneSubmit = async () => {
    if (!username.trim()) { setError('Please enter your username'); return; }
    setLoading(true); setError('');
    try {
      await authApi.login(username.trim());
      setStep('otp');
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes('not found')) {
        setStep('register');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (otp.length < 4) { setError('Please enter the OTP'); return; }
    setLoading(true); setError('');
    try {
      const { token, user } = await authApi.verifyOtp(username.trim(), otp.trim());
      login(token, user);
      router.replace('/');
    } catch (e: unknown) {
      setError((e as Error).message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    setLoading(true); setError('');
    try {
      await authApi.register({ username: username.trim(), display_name: displayName.trim(), phone });
      const { token, user } = await authApi.verifyOtp(username.trim(), '123456');
      login(token, user);
      router.replace('/');
    } catch (e: unknown) {
      setError((e as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #1B1B1B 0%, #0D0D0D 100%)',
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        animation: 'fadeIn 0.3s ease',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, #3A76F0, #2CA5E0)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 32px rgba(58,118,240,0.4)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <h1 style={{ color: 'white', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
            Signal
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginTop: 6 }}>
            Private messaging, simplified.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#1C1C1E',
          borderRadius: 20,
          padding: 32,
          border: '1px solid #2C2C2E',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {step === 'phone' && (
            <>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem', marginBottom: 8 }}>
                Sign in
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: 24 }}>
                Enter your username to continue
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: 6 }}>
                  Username
                </label>
                <input
                  className="signal-input"
                  placeholder="e.g. alice"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                  autoFocus
                  style={{ background: '#2C2C2E', color: 'white', border: '1.5px solid #38383A' }}
                />
              </div>
              {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 12 }}>{error}</p>}
              <button
                className="btn-primary"
                onClick={handlePhoneSubmit}
                disabled={loading || !username.trim()}
                style={{ width: '100%' }}
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>

              {/* Demo accounts */}
              <div style={{
                marginTop: 24, padding: 16,
                background: 'rgba(58,118,240,0.08)',
                borderRadius: 10, border: '1px solid rgba(58,118,240,0.2)',
              }}>
                <p style={{ color: '#6EA3F5', fontSize: '0.8125rem', fontWeight: 600, marginBottom: 8 }}>
                  Demo Accounts
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['alice', 'bob', 'charlie', 'david', 'emma'].map((u) => (
                    <button
                      key={u}
                      onClick={() => setUsername(u)}
                      style={{
                        background: 'rgba(58,118,240,0.15)',
                        border: '1px solid rgba(58,118,240,0.3)',
                        borderRadius: 6, padding: '4px 10px',
                        color: '#6EA3F5', fontSize: '0.8125rem',
                        cursor: 'pointer', fontWeight: 500,
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <p style={{ color: '#636366', fontSize: '0.75rem', marginTop: 8 }}>
                  OTP: <strong style={{ color: '#9CA3AF' }}>123456</strong> (mocked)
                </p>
              </div>
            </>
          )}

          {step === 'otp' && (
            <>
              <button
                className="btn-ghost"
                onClick={() => { setStep('phone'); setError(''); setOtp(''); }}
                style={{ color: '#6EA3F5', marginBottom: 16, padding: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem', marginBottom: 8 }}>
                Enter OTP
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: 24 }}>
                We sent a code to <strong style={{ color: 'white' }}>@{username}</strong>
                <br />
                <span style={{ color: '#6EA3F5', fontSize: '0.8125rem' }}>
                  (Demo: use 123456)
                </span>
              </p>
              <input
                className="signal-input"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleOtpSubmit()}
                autoFocus
                maxLength={6}
                style={{
                  background: '#2C2C2E', color: 'white', border: '1.5px solid #38383A',
                  fontSize: '1.25rem', letterSpacing: '0.25em', textAlign: 'center',
                  marginBottom: 16,
                }}
              />
              {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 12 }}>{error}</p>}
              <button
                className="btn-primary"
                onClick={handleOtpSubmit}
                disabled={loading || otp.length < 6}
                style={{ width: '100%' }}
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </>
          )}

          {step === 'register' && (
            <>
              <button
                className="btn-ghost"
                onClick={() => { setStep('phone'); setError(''); }}
                style={{ color: '#6EA3F5', marginBottom: 16, padding: 0 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 4 }}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <h2 style={{ color: 'white', fontWeight: 700, fontSize: '1.25rem', marginBottom: 8 }}>
                Create Account
              </h2>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem', marginBottom: 24 }}>
                New user <strong style={{ color: 'white' }}>@{username}</strong> — set up your profile
              </p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: 6 }}>
                  Display Name *
                </label>
                <input
                  className="signal-input"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoFocus
                  style={{ background: '#2C2C2E', color: 'white', border: '1.5px solid #38383A' }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', color: '#9CA3AF', fontSize: '0.8125rem', marginBottom: 6 }}>
                  Phone (optional)
                </label>
                <input
                  className="signal-input"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ background: '#2C2C2E', color: 'white', border: '1.5px solid #38383A' }}
                />
              </div>
              {error && <p style={{ color: '#EF4444', fontSize: '0.8125rem', marginBottom: 12 }}>{error}</p>}
              <button
                className="btn-primary"
                onClick={handleRegister}
                disabled={loading || !displayName.trim()}
                style={{ width: '100%' }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
              <p style={{ color: '#636366', fontSize: '0.75rem', textAlign: 'center', marginTop: 12 }}>
                OTP is auto-applied (mocked authentication)
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
