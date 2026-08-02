'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

export default function TeacherAttendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [date, setDate] = useState('');
  const [attendance, setAttendance] = useState<Record<string, string>>({}); // studentId -> status
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [teacherMeta, setTeacherMeta] = useState<{ name: string; subject: string }>({ name: '', subject: '' });
  const toast = useToast();

  const refreshCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const data = await res.json();
      const next = Array.isArray(data) ? data : [];
      setCourses(next);
      if (selectedClass && !next.some((c: any) => c.name.trim() === selectedClass)) {
        setSelectedClass('');
      }
    } catch (e) {}
  }, [selectedClass]);

  useEffect(() => {
    Promise.all([
      fetch('/api/students', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/courses', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/user/settings', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    ]).then(([studs, courses, user]) => {
      setStudents(studs || []);
      setCourses(Array.isArray(courses) ? courses : []);
      setTeacherMeta({
        name: typeof user?.name === 'string' ? user.name : '',
        subject: typeof user?.subject === 'string' ? user.subject : '',
      });
      const initialStatus: Record<string, string> = {};
      (studs || []).forEach((s: any) => initialStatus[s.id] = '');
      setAttendance(initialStatus);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg || msg.type !== 'courses_updated') return;
      refreshCourses();
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => window.removeEventListener('attendance:update', onUpdate as any);
  }, [refreshCourses]);

  // initialize date on client to avoid SSR hydration mismatch
  useEffect(() => {
    if (!date) setDate(new Date().toISOString().split('T')[0]);
  }, [date]);

  // Load attendance for selected date
  useEffect(() => {
    if (!date) return;
    fetch('/api/attendance', { cache: 'no-store' })
      .then(r => r.json())
        .then((records: any[]) => {
          const map: Record<string, string> = {};
          records.filter(r => r.date === date).forEach(r => { map[r.studentId] = r.status; });
          // Default empty (not selected) if not set
          const initialStatus: Record<string, string> = {};
          students.forEach((s: any) => initialStatus[s.id] = map[s.id] || '');
          setAttendance(initialStatus);
        }).catch(() => {});
  }, [date, students]);

  const handleSubmit = async () => {
    const records = Object.entries(attendance).map(([studentId, status]) => ({
      studentId,
      status: status === 'PRESENT' ? 'PRESENT' : 'ABSENT',
      subject: teacherMeta.subject || 'General',
      teacherName: teacherMeta.name || undefined,
    }));
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records })
    });

    if (res.ok) {
      toast.showToast?.(`Attendance for ${date} locked!`, 'success');
      // broadcast and refresh records to reflect latest saved state
      try { new BroadcastChannel('attendance_channel').postMessage({ type: 'attendance_saved', date }); } catch (e) {}
      try {
        const recRes = await fetch('/api/attendance', { cache: 'no-store' });
        const all = await recRes.json();
        const map: Record<string, string> = {};
        all.filter((r: any) => r.date === date).forEach((r: any) => { map[r.studentId] = r.status; });
        const initialStatus: Record<string, string> = {};
        students.forEach((s: any) => initialStatus[s.id] = map[s.id] || '');
        setAttendance(initialStatus);
      } catch (e) {
        // ignore
      }
    } else {
      try {
        const data = await res.json();
        const msg = data?.error || 'Failed to save attendance';
        if (msg.toLowerCase().includes('already')) {
          toast.showToast?.('Attendance already recorded for this student.', 'error');
        } else {
          toast.showToast?.(msg, 'error');
        }
      } catch (e) {
        toast.showToast?.('Failed to save attendance', 'error');
      }
    }
  };

  const setStatus = (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  if (loading) {
    return (
      <DashboardLayout role={UserRole.TEACHER}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading attendance...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.TEACHER}>
      <div className="page-header">
        <h1>Mark Attendance</h1>
        <p>Record student attendance for {date || 'selected date'}</p>
      </div>
      
      <div className="card" style={{ maxWidth: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="input-group">
            <label>Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Class</label>
            <select className="form-control" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {courses.map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()}</option>)}
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(selectedClass ? students.filter(s => s.department === selectedClass) : students).map(student => (
                <tr key={student.id}>
                  <td style={{ fontWeight: '500' }}>{student.id}</td>
                  <td>{student.name}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        className={`btn btn-sm attendance-status-btn attendance-present ${attendance[student.id] === 'PRESENT' ? 'active' : ''}`}
                        onClick={() => setStatus(student.id, 'PRESENT')}
                        aria-pressed={attendance[student.id] === 'PRESENT'}
                        aria-label={`Mark ${student.name} present`}
                      >
                        Present
                      </button>
                      <button
                        className={`btn btn-sm attendance-status-btn attendance-absent ${attendance[student.id] === 'ABSENT' ? 'active' : ''}`}
                        onClick={() => setStatus(student.id, 'ABSENT')}
                        aria-pressed={attendance[student.id] === 'ABSENT'}
                        aria-label={`Mark ${student.name} absent`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSubmit} className="btn">Save Attendance</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
