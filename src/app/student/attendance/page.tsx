'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useToast } from '@/components/ToastProvider';
import { UserRole } from '@/lib/types';

export default function StudentAttendanceHistory() {
  const [history, setHistory] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'today' | 'all' | 'subject'>('all');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadHistory = useCallback(() => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setHistory(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
        setLoading(false);
      }).catch(() => {
        toast.showToast?.('Failed to load attendance data', 'error');
        setLoading(false);
      });
  }, [toast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg) return;
      if (msg.type === 'attendance_saved' || msg.type === 'teachers_updated') {
        loadHistory();
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);

    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('attendance_channel');
      bc.onmessage = (event) => {
        const msg = event?.data;
        if (!msg) return;
        if (msg.type === 'attendance_saved' || msg.type === 'teachers_updated') {
          loadHistory();
        }
      };
    } catch (e) {
      bc = null;
    }

    return () => {
      window.removeEventListener('attendance:update', onUpdate as any);
      try { if (bc) bc.close(); } catch (e) {}
    };
  }, [loadHistory]);

  const todayKey = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredHistory = useMemo(() => {
    if (viewMode === 'today') return history.filter((r: any) => r.date === todayKey);
    return history;
  }, [history, todayKey, viewMode]);

  const subjectBreakdown = useMemo(() => {
    const map = new Map<string, { subject: string; teacherName: string; total: number; present: number; absent: number }>();
    for (const r of history) {
      const subject = (typeof r?.subject === 'string' && r.subject.trim()) ? r.subject.trim() : 'General';
      const teacherName = (typeof r?.teacherName === 'string' && r.teacherName.trim())
        ? r.teacherName.trim()
        : (r?.teacherId || 'N/A');
      const key = `${subject}__${teacherName}`;
      const prev = map.get(key) || { subject, teacherName, total: 0, present: 0, absent: 0 };
      prev.total += 1;
      if (r.status === 'PRESENT') prev.present += 1;
      if (r.status === 'ABSENT') prev.absent += 1;
      map.set(key, prev);
    }

    return Array.from(map.entries())
      .map(([, stats]) => ({
        ...stats,
        percentage: stats.total ? Math.round((stats.present / stats.total) * 100) : 0,
      }))
      .sort((a, b) => `${a.subject} ${a.teacherName}`.localeCompare(`${b.subject} ${b.teacherName}`));
  }, [history]);

  const teacherWiseSubjectBreakdown = useMemo(() => {
    const grouped = new Map<string, typeof subjectBreakdown>();
    for (const item of subjectBreakdown) {
      const key = item.teacherName || 'N/A';
      const list = grouped.get(key) || [];
      list.push(item);
      grouped.set(key, list);
    }
    return Array.from(grouped.entries())
      .map(([teacherName, items]) => ({
        teacherName,
        items: items.sort((a, b) => a.subject.localeCompare(b.subject)),
      }))
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  }, [subjectBreakdown]);

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return '#16a34a';
    if (percentage >= 60) return '#d97706';
    return '#dc2626';
  };

  if (loading) {
    return (
      <DashboardLayout role={UserRole.STUDENT}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance history...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.STUDENT}>
      <div className="page-header">
        <h1>My Attendance History</h1>
        <p>View your attendance records and subject-wise breakdown.</p>
      </div>

      <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'today' ? '' : 'btn-outline'}`}
            onClick={() => setViewMode('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'all' ? '' : 'btn-outline'}`}
            onClick={() => setViewMode('all')}
          >
            All Days
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'subject' ? '' : 'btn-outline'}`}
            onClick={() => setViewMode('subject')}
          >
            Subject-wise
          </button>
        </div>
      </div>

      {viewMode === 'subject' && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Subject-wise Attendance</h3>
          {teacherWiseSubjectBreakdown.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <p>No subject-wise data available yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {teacherWiseSubjectBreakdown.map((teacherGroup) => (
                <div key={teacherGroup.teacherName} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px' }}>
                  <div style={{ marginBottom: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Teacher: {teacherGroup.teacherName}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {teacherGroup.items.map((item) => (
                      <div key={`${item.subject}-${item.teacherName}`} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>{item.subject}</strong>
                          <span style={{ color: getAttendanceColor(item.percentage), fontWeight: '700' }}>
                            {item.percentage}% Present
                          </span>
                        </div>
                        <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '8px' }}>
                          <div
                            style={{
                              width: `${item.percentage}%`,
                              height: '100%',
                              background: getAttendanceColor(item.percentage),
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Present: {item.present}/{item.total} | Absent: {item.absent}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {viewMode !== 'subject' && filteredHistory.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Teacher Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((record: any, index: number) => (
                  <tr key={`${record.date}-${record.studentId || 'self'}-${index}`}>
                    <td>{record.date}</td>
                    <td>{record.subject || 'General'}</td>
                    <td>
                      <span className={`badge ${record.status === 'PRESENT' ? 'badge-success' : 'badge-danger'}`}>
                        {record.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{record.teacherName || record.teacherId || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode !== 'subject' ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <p>{viewMode === 'today' ? 'No attendance record found for today.' : 'No attendance records found.'}</p>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
