'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    try {
      // only show persisted logout message here (welcome is shown on dashboard after redirect)
      const out = localStorage.getItem('justLoggedOut');
      if (out) {
        try {
          const o = JSON.parse(out);
          if (o && o.message) {
            toast.showToast?.(o.message, 'info');
          }
        } catch (e) {}
        try { localStorage.removeItem('justLoggedOut'); } catch {}
      }
    } catch (e) {
      // ignore
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Redirect based on role and persist a small flag so dashboard can show welcome toast after redirect
      try {
        localStorage.setItem('justLoggedIn', JSON.stringify({ name: data.user.name, role: data.user.role }));
      } catch (e) {}

      if (data.user.role === 'ADMIN') router.push('/admin/dashboard');
      else if (data.user.role === 'TEACHER') router.push('/teacher/dashboard');
      else if (data.user.role === 'STUDENT') router.push('/student/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-left-panel">
        <div className="auth-left-glow auth-left-glow-a" />
        <div className="auth-left-glow auth-left-glow-b" />
        <div className="auth-left-content">
          <p className="auth-kicker">Attendance Pro</p>
          <h1>Welcome!</h1>
          <p>Secure access for admins, teachers, and students.</p>
        </div>
      </section>

      <section className="auth-right-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Auth navigation">
            <a href="/login" className="auth-tab active" aria-current="page">Login</a>
            <a href="/register" className="auth-tab">Register</a>
          </div>

          <div className="login-logo auth-logo">
            <h1>Attendance Pro</h1>
            <p>Welcome back. Sign in to continue.</p>
          </div>

          {error && (
            <div className="alert alert-danger auth-alert">
              <span>!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} aria-labelledby="login-heading">
            <div className="input-group auth-input-group">
              <label htmlFor="username">Username, Email, or Student ID</label>
              <input
                id="username"
                name="username"
                type="text"
                className="form-control auth-field"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Enter username, email, or student ID"
                aria-required="true"
              />
            </div>

            <div className="input-group auth-input-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control auth-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  aria-required="true"
                />
                <button
                  type="button"
                  className="password-toggle auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-lg auth-submit" disabled={loading} style={{ width: '100%', marginTop: '10px' }}>
              {loading ? (
                <>
                  <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', marginRight: '8px' }} role="status" aria-hidden="true"></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>
      </section>
    </div>
  );
}
