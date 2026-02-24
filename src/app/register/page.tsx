'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    qualification: '',
    experience: '',
    courseId: '',
    subject: '',
    password: ''
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const router = useRouter();
  const toast = useToast();

  const canGoNext = Boolean(
    formData.name.trim() &&
    emailPattern.test(formData.email.trim()) &&
    /^\d{10}$/.test(formData.phone)
  );

  const goNext = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      return;
    }
    if (!emailPattern.test(formData.email.trim())) {
      toast.showToast?.('Please enter a valid email (example@domain.com)', 'error');
      return;
    }
    if (!canGoNext) {
      toast.showToast?.('Phone Number must be exactly 10 digits', 'error');
      return;
    }
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      toast.showToast?.('Registration successful! Please wait for admin approval.', 'success');
      setFormData({ name: '', email: '', phone: '', qualification: '', experience: '', courseId: '', subject: '', password: '' });
      setStep(1);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      toast.showToast?.(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/courses')
      .then(res => res.json())
      .then(data => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, []);

  useEffect(() => {
    // Listen for cross-tab updates via BroadcastChannel
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('attendance_channel');
      bc.onmessage = (ev) => {
        if (ev?.data?.type === 'courses_updated') {
          fetch('/api/courses')
            .then(res => res.json())
            .then(data => setCourses(Array.isArray(data) ? data : []))
            .catch(() => {});
        }
      };
    } catch (e) {
      bc = null;
    }

    // Fallback polling to keep courses in sync
    const id = setInterval(() => {
      fetch('/api/courses')
        .then(res => res.json())
        .then(data => setCourses(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, 8000);

    return () => {
      try { if (bc) bc.close(); } catch (e) {}
      clearInterval(id);
    };
  }, []);

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
        <div className="auth-card auth-card-wide">
          <div className="auth-tabs" role="tablist" aria-label="Auth navigation">
            <a href="/login" className="auth-tab">Login</a>
            <a href="/register" className="auth-tab active" aria-current="page">Register</a>
          </div>

          <div className="login-logo auth-logo">
            <h1>Teacher Registration</h1>
            <p>Welcome back. Sign in to continue.</p>
          </div>

          <div className="auth-stepper" aria-label="Registration steps">
            <span className={`auth-step-pill ${step === 1 ? 'active' : ''}`}>Step 1: Personal</span>
            <span className={`auth-step-pill ${step === 2 ? 'active' : ''}`}>Step 2: Professional</span>
          </div>

          <form onSubmit={handleRegister} className="auth-register-form">
            {step === 1 ? (
              <>
                <div className="input-group auth-input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="form-control auth-field"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Riya Sharma"
                  />
                </div>

                <div className="input-group auth-input-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    className="form-control auth-field"
                    required
                    pattern="^[^\s@]+@[^\s@]+\.[^\s@]+$"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="example@domain.com"
                  />
                </div>

                <div className="input-group auth-input-group">
                  <label>Phone Number</label>
                  <input
                    type="text"
                    className="form-control auth-field"
                    required
                    inputMode="tel"
                    pattern="[0-9]*"
                    maxLength={10}
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                      })
                    }
                    placeholder="10-digit mobile number"
                  />
                </div>

                <button type="button" className="btn btn-lg auth-submit" style={{ width: '100%' }} onClick={goNext}>
                  Next
                </button>
              </>
            ) : (
              <>
                <div className="auth-grid-2">
                  <div className="input-group auth-input-group">
                    <label>Qualification</label>
                    <input
                      type="text"
                      className="form-control auth-field"
                      required
                      value={formData.qualification}
                      onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                      placeholder="e.g. M.Tech (CSE)"
                    />
                  </div>
                  <div className="input-group auth-input-group">
                    <label>Experience (Years)</label>
                    <input
                      type="number"
                      className="form-control auth-field"
                      required
                      min="0"
                      value={formData.experience}
                      onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                      placeholder="e.g. 5"
                    />
                  </div>
                </div>

                <div className="auth-grid-2">
                  <div className="input-group auth-input-group">
                    <label>Course Name</label>
                    <select
                      className="form-control auth-field"
                      required
                      value={formData.courseId}
                      onChange={(e) => setFormData({ ...formData, courseId: e.target.value, subject: '' })}
                    >
                      <option value="">-- Choose Course --</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group auth-input-group">
                    <label>Subject</label>
                    <select
                      className="form-control auth-field"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    >
                      <option value="">-- Choose Subject --</option>
                      {(courses.find(c => c.id === formData.courseId)?.subjects || []).map((s: string) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="input-group auth-input-group">
                  <label>Password</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="form-control auth-field"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                      style={{ paddingRight: '60px' }}
                    />
                    <button
                      type="button"
                      className="password-toggle auth-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className="auth-step-actions">
                  <button type="button" className="auth-back-link" onClick={goBack}>
                    Back
                  </button>
                  <button type="submit" className="btn btn-lg auth-submit" disabled={loading}>
                    {loading ? (
                      <>
                        <span className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px', marginRight: '8px' }}></span>
                        Submitting...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="auth-footnote">
            <p>
              Already have an account?{' '}
              <a href="/login" className="auth-link">
                Sign In
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
