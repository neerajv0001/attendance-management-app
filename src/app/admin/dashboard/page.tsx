'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import Link from 'next/link';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalCourses: 0,
    pendingTeachers: [],
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(() => {
    fetch('/api/admin/stats', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        // Merge with defaults to avoid missing fields causing runtime errors
        setStats((prev) => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg) return;
      if (msg.type === 'courses_updated' || msg.type === 'students_updated' || msg.type === 'teachers_updated') {
        loadStats();
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('attendance_channel');
      bc.onmessage = (ev) => {
        const msg = ev?.data;
        if (!msg) return;
        if (msg.type === 'courses_updated' || msg.type === 'students_updated' || msg.type === 'teachers_updated') {
          loadStats();
        }
      };
    } catch (e) {
      bc = null;
    }
    return () => {
      window.removeEventListener('attendance:update', onUpdate as any);
      try { if (bc) bc.close(); } catch (e) {}
    };
  }, [loadStats]);

  if (loading) {
    return (
      <DashboardLayout role={UserRole.ADMIN}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.ADMIN}>
      <div className="page-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back! Here's what's happening in your institution.</p>
      </div>
      
      <div className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="stat-card info">
          <div className="stat-icon info">👨‍🏫</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Teachers</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.totalTeachers}</p>
          </div>
        </div>
        <div className="stat-card success">
          <div className="stat-icon success">👨‍🎓</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Students</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.totalStudents}</p>
          </div>
        </div>
        <div className="stat-card warning">
          <div className="stat-icon warning">📚</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Total Courses</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.totalCourses}</p>
          </div>
        </div>
        <div className="stat-card danger">
          <div className="stat-icon danger">⏳</div>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '4px' }}>Pending Approvals</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>{stats.pendingTeachers?.length ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--primary-color)' }}>Recent Teacher Registrations</h3>
          <Link href="/admin/approve-teachers" className="btn btn-sm">
            View All
          </Link>
        </div>
        
        {Array.isArray(stats.pendingTeachers) && stats.pendingTeachers.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {(stats.pendingTeachers || []).map((teacher: any) => (
                  <tr key={teacher.id}>
                    <td style={{ fontWeight: '500' }}>{teacher.name}</td>
                    <td>{teacher.email}</td>
                    <td>{teacher.subject}</td>
                    <td>
                      <span className="badge badge-warning">⏳ Pending</span>
                    </td>
                    <td>
                      <Link href="/admin/approve-teachers" className="btn btn-sm btn-outline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>No pending teacher approvals at the moment.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
