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
      if (msg.type === 'attendance_saved') {
        loadHistory();
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => window.removeEventListener('attendance:update', onUpdate as any);
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

  if (loading) return <div>Loading...</div>;

  return (
    <DashboardLayout role={UserRole.STUDENT}>
      <h1 style={{ marginBottom: '20px', color: '#003366' }}>My Attendance History</h1>

      <div className="card" style={{ marginBottom: '14px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
          <h3 style={{ marginBottom: '12px', color: '#003366' }}>Subject-wise Attendance</h3>
          {teacherWiseSubjectBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No subject-wise data available yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {teacherWiseSubjectBreakdown.map((teacherGroup) => (
                <div key={teacherGroup.teacherName} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
                  <div style={{ marginBottom: 10, fontWeight: 700, color: '#003366' }}>
                    Teacher: {teacherGroup.teacherName}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {teacherGroup.items.map((item) => (
                      <div key={`${item.subject}-${item.teacherName}`} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ color: '#0f172a' }}>{item.subject}</strong>
                          <span style={{ color: getAttendanceColor(item.percentage), fontWeight: 700 }}>
                            {item.percentage}% Present
                          </span>
                        </div>
                        <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
                          <div
                            style={{
                              width: `${item.percentage}%`,
                              height: '100%',
                              background: getAttendanceColor(item.percentage),
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f4f7fa', textAlign: 'left' }}>
              <th style={{ padding: '15px' }}>Date</th>
              <th style={{ padding: '15px' }}>Subject</th>
              <th style={{ padding: '15px' }}>Status</th>
              <th style={{ padding: '15px' }}>Teacher Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.map((record: any, index: number) => (
              <tr key={`${record.date}-${record.studentId || 'self'}-${index}`} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '15px' }}>{record.date}</td>
                <td style={{ padding: '15px' }}>{record.subject || 'General'}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{ 
                    padding: '5px 10px', 
                    borderRadius: '20px', 
                    background: record.status === 'PRESENT' ? '#d4edda' : '#f8d7da',
                    color: record.status === 'PRESENT' ? '#155724' : '#721c24',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                  }}>
                    {record.status}
                  </span>
                </td>
                <td style={{ padding: '15px', color: '#666' }}>{record.teacherName || record.teacherId || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : viewMode !== 'subject' ? (
        <div className="card">
          {viewMode === 'today'
            ? 'No attendance record found for today.'
            : 'No attendance records found.'}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
