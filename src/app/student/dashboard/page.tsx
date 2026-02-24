'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import Link from 'next/link';

export default function StudentDashboard() {
  const [stats, setStats] = useState({
    totalClasses: 0,
    todayTotal: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const currentWeekday = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    []
  );

  const loadDashboard = useCallback(async (silent = false) => {
    const todayKey = new Date().toISOString().split('T')[0];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    try {
      const [attendance, timetable] = await Promise.all([
        fetch('/api/attendance', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/timetable', { cache: 'no-store' }).then(r => r.json())
      ]);

      if (Array.isArray(attendance)) {
        const total = attendance.length;
        const overallPresent = attendance.filter((r: any) => r.status === 'PRESENT').length;
        const todayAttendance = attendance.filter((r: any) => r.date === todayKey);
        const present = todayAttendance.filter((r: any) => r.status === 'PRESENT').length;
        const absent = todayAttendance.filter((r: any) => r.status === 'ABSENT').length;
        setStats({
          totalClasses: total,
          todayTotal: todayAttendance.length,
          present,
          absent,
          percentage: total > 0 ? (overallPresent / total) * 100 : 0
        });
      }

      if (Array.isArray(timetable)) {
        const todaySchedule = timetable.filter((t: any) => t.day === today).sort((a: any, b: any) =>
          a.startTime.localeCompare(b.startTime)
        );
        setTodayClasses(todaySchedule);
      }
    } catch {
      if (!silent) toast.showToast?.('Failed to load dashboard data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // listen for cross-tab updates and refresh dashboard data
  useEffect(() => {
    const onUpdate = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      if (d.type === 'courses_updated' || d.type === 'attendance_saved' || d.type === 'timetable_updated') {
        loadDashboard(true);
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('attendance_channel');
      bc.onmessage = (ev) => {
        const d = ev?.data;
        if (!d) return;
        if (d.type === 'courses_updated' || d.type === 'attendance_saved' || d.type === 'timetable_updated') {
          loadDashboard(true);
        }
      };
    } catch (e) {
      bc = null;
    }

    return () => {
      window.removeEventListener('attendance:update', onUpdate as any);
      try { if (bc) bc.close(); } catch (e) {}
    };
  }, [loadDashboard]);

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return 'var(--success-color)';
    if (percentage >= 60) return 'var(--warning-color)';
    return 'var(--danger-color)';
  };

  const getAttendanceStatus = (percentage: number) => {
    if (percentage >= 75) return 'Good Standing';
    if (percentage >= 60) return 'At Risk';
    return 'Critical';
  };

  if (loading) {
    return (
      <DashboardLayout role={UserRole.STUDENT}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.STUDENT}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Student Dashboard</h1>
          <p>Track your attendance and view your schedule.</p>
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 999,
            background: '#e8f1ff',
            color: '#003366',
            fontWeight: 700,
            fontSize: '0.82rem',
            border: '1px solid #bfdbfe',
          }}
        >
          {currentWeekday}
        </div>
      </div>
      
      <div className="grid-3" style={{ marginBottom: '32px' }}>
        <div className="stat-card" style={{ borderLeftColor: getAttendanceColor(stats.percentage) }}>
          <div className="stat-icon" style={{ 
            background: `${getAttendanceColor(stats.percentage)}20`,
            color: getAttendanceColor(stats.percentage)
          }}>
            📊
          </div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Attendance Rate</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>
              {stats.percentage.toFixed(1)}%
            </p>
            <p style={{ 
              fontSize: '0.8rem', 
              color: getAttendanceColor(stats.percentage),
              fontWeight: '600'
            }}>
              {getAttendanceStatus(stats.percentage)}
            </p>
          </div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-icon success">✅</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Classes Present</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.present}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Today: {stats.todayTotal} marked</p>
          </div>
        </div>
        
        <div className="stat-card danger">
          <div className="stat-icon danger">❌</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Classes Absent</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.absent}</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>Today based count</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {/* Today's Classes */}
        <div className="card">
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📅</span>
            Today's Classes
          </h3>
          
          {todayClasses.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todayClasses.map((cls, idx) => (
                <div key={idx} style={{ 
                  padding: '16px', 
                  background: cls.isCancelled ? '#fff1f2' : '#f8fafc', 
                  borderRadius: '8px',
                  borderLeft: cls.isCancelled ? '4px solid #ef4444' : '4px solid var(--accent-color)'
                }}>
                  <div style={{ fontWeight: '600', color: 'var(--primary-color)', marginBottom: '4px', textDecoration: cls.isCancelled ? 'line-through' : 'none' }}>
                    {cls.subject}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {cls.startTime} - {cls.endTime}
                  </div>
                  {cls.isCancelled && (
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: '#fee2e2',
                          color: '#b91c1c',
                          border: '1px solid #fca5a5',
                        }}
                      >
                        Cancelled
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon">🎉</div>
              <p>No classes scheduled for today!</p>
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="card">
          <h3 style={{ color: 'var(--primary-color)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span>
            Quick Actions
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Link href="/student/attendance" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                <div style={{ fontSize: '28px' }}>📋</div>
                <div>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '2px' }}>View Attendance History</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Check your past attendance records</p>
                </div>
              </div>
            </Link>
            
            <Link href="/student/timetable" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                <div style={{ fontSize: '28px' }}>📅</div>
                <div>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '2px' }}>View Full Timetable</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>See your complete weekly schedule</p>
                </div>
              </div>
            </Link>
            
            <Link href="/student/settings" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                <div style={{ fontSize: '28px' }}>⚙️</div>
                <div>
                  <h4 style={{ color: 'var(--primary-color)', marginBottom: '2px' }}>Account Settings</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Change password and username</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
