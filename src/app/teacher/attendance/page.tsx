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

  if (loading) return <div>Loading...</div>;

  return (
    <DashboardLayout role={UserRole.TEACHER}>
      <h1 style={{ marginBottom: '20px', color: '#003366' }}>Mark Attendance</h1>
      
      <div className="card" style={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
          <div className="input-group" style={{ minWidth: 160 }}>
            <label>Date</label>
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="input-group" style={{ minWidth: 220 }}>
            <label>Class</label>
            <select className="form-control" value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
              <option value="">All Classes</option>
              {courses.map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()}</option>)}
            </select>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f4f7fa', textAlign: 'left' }}>
              <th style={{ padding: '10px' }}>ID</th>
              <th style={{ padding: '10px' }}>Name</th>
              <th style={{ padding: '10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {(selectedClass ? students.filter(s => s.department === selectedClass) : students).map(student => (
              <tr key={student.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '10px' }}>{student.id}</td>
                <td style={{ padding: '10px' }}>{student.name}</td>
                <td style={{ padding: '10px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={`btn btn-sm attendance-status-btn attendance-present ${attendance[student.id] === 'PRESENT' ? 'active' : ''}`}
                      onClick={() => setStatus(student.id, 'PRESENT')}
                      aria-pressed={attendance[student.id] === 'PRESENT'}
                      aria-label={`Mark ${student.name} present`}
                      style={{ minWidth: 84, padding: '6px 10px' }}
                    >
                      Present
                    </button>
                    <button
                      className={`btn btn-sm attendance-status-btn attendance-absent ${attendance[student.id] === 'ABSENT' ? 'active' : ''}`}
                      onClick={() => setStatus(student.id, 'ABSENT')}
                      aria-pressed={attendance[student.id] === 'ABSENT'}
                      aria-label={`Mark ${student.name} absent`}
                      style={{ minWidth: 84, padding: '6px 10px' }}
                      >
                      Absent
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button onClick={handleSubmit} className="btn">Save Attendance</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
