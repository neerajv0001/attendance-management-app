"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

export default function AddStudentPage() {
  const [formData, setFormData] = useState({ name: '', email: '', department: '' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [courses, setCourses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '' });
  const [deleting, setDeleting] = useState<any | null>(null);
  const toast = useToast();

  useEffect(() => {
    // Fetch courses and students in parallel and update state once to reduce re-renders
    let mounted = true;
    Promise.all([
      fetch('/api/courses', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
      fetch('/api/students', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
    ]).then(([coursesData, studentsData]) => {
      if (!mounted) return;
      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    });
    // listen for updates from other tabs
    const onUpdate = (e: any) => {
      const d = e?.detail;
      // if courses or students updated, refetch courses/students
      if (!d || d.type === 'courses_updated' || d.type === 'students_updated' || d.type === 'attendance_saved') {
        Promise.all([
          fetch('/api/courses', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
          fetch('/api/students', { cache: 'no-store' }).then(r => r.json()).catch(() => []),
        ]).then(([coursesData, studentsData]) => {
          if (!mounted) return;
          setCourses(Array.isArray(coursesData) ? coursesData : []);
          setStudents(Array.isArray(studentsData) ? studentsData : []);
        });
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => { mounted = false; window.removeEventListener('attendance:update', onUpdate as any); };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');
    // no loading toast; we'll show final toast when operation completes
    try {
      const payload = { name: formData.name, email: formData.email, department: formData.department };
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add student');
      setResult(data.student);
      setStudents(prev => [data.student, ...prev]);
      setFormData({ name: '', email: '', department: '' });
      toast.showToast?.(`Successfully Added ${data.student.name}`, 'success');
      // keep the more detailed credential toast as secondary
      toast.showToast?.(`Credentials: ID ${data.student.id}`, 'info');
      try { new BroadcastChannel('attendance_channel').postMessage({ type: 'students_updated', name: data.student.name }); } catch (e) {}
    } catch (err: any) {
      setError(err.message);
      toast.showToast?.(err.message || 'Failed to add student', 'error');
    } finally {
      setLoading(false);
    }
  }, [formData, toast]);

  // Apply class filter and debounced search. Memoize to avoid recomputation on unrelated state changes.
  const filteredStudents = useMemo(() => {
    const base = selectedClass ? students.filter(s => s.department === selectedClass) : students;
    return base;
  }, [students, selectedClass]);


  const handleStartEdit = useCallback((s: any) => {
    setEditing(s);
    setEditForm({ name: s.name, email: s.email || '', department: s.department || '' });
  }, []);

  const handleDeleteConfirm = useCallback(async (id: string) => {
    try {
      const res = await fetch('/api/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      setStudents(prev => prev.filter(s => s.id !== id));
      toast.showToast?.('Student deleted successfully!', 'success');
    } catch (err: any) {
      toast.showToast?.(err.message || 'Failed to delete student', 'error');
    }
  }, [toast]);

  return (
    <DashboardLayout role={UserRole.TEACHER}>
      <h1 style={{ marginBottom: '20px', color: '#003366' }}>Manage Students</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
        <div>
              {!result && (
                <form onSubmit={handleSubmit} className="card">
                  <h3>Add New Student</h3>
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" className="form-control" required
                      value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                  </div>

                  <div className="input-group">
                    <label>Email (Optional)</label>
                    <input type="email" className="form-control"
                      value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>

                  <div className="input-group">
                    <label>Class</label>
                    <select className="form-control" required value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}>
                      <option value="">-- Select Class --</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.name.trim()}>{c.name.trim()}</option>
                      ))}
                    </select>
                  </div>

                  <button type="submit" className="btn" disabled={loading}>{loading ? 'Creating Student...' : 'Create Student'}</button>
                </form>
              )}

              {result && (
                <div className="card" style={{ marginTop: 12 }}>
                  <h4>Student Successfully Added!</h4>
                  <p>Share these credentials with the student:</p>
                  <ul>
                    <li><strong>Student ID (Username):</strong> {result.id}</li>
                    <li><strong>Password:</strong> {result.password}</li>
                  </ul>
                  <button onClick={() => setResult(null)} className="btn btn-outline" style={{ marginTop: '10px' }}>Add Another</button>
                </div>
              )}

              {error && <div className="card" style={{ background: '#f8d7da', color: '#721c24' }}>{error}</div>}

            </div>

            <div>
              <div className="card">
                <h4>Classes</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  <button className={`btn ${selectedClass === '' ? 'btn-outline' : ''}`} onClick={() => setSelectedClass('')}>All</button>
                  {courses.map(c => (
                    <button key={c.id} className={`btn ${selectedClass === c.name.trim() ? '' : 'btn-outline'}`} onClick={() => setSelectedClass(c.name.trim())}>{c.name.trim()}</button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <h4>Students {selectedClass ? `— ${selectedClass}` : ''}</h4>
                <div style={{ marginTop: 10 }}>
                  {filteredStudents.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)' }}>No students found.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f4f7fa', textAlign: 'left' }}>
                          <th style={{ padding: 10 }}>ID</th>
                          <th style={{ padding: 10 }}>Name</th>
                          <th style={{ padding: 10 }}>Class</th>
                        </tr>
                      </thead>
                      <tbody>
                            {filteredStudents.slice(0, 10).map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: 8 }}>{s.id}</td>
                                <td style={{ padding: 8 }}>{s.name}</td>
                                <td style={{ padding: 8 }}>{s.department}</td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>

          {viewing && (
            <div className="modal-overlay" onClick={() => setViewing(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header"><h3>Student Details</h3></div>
                <div className="modal-body">
                  <p><strong>Student ID / Username:</strong> {viewing.id}</p>
                  <p><strong>Name:</strong> {viewing.name}</p>
                  <p><strong>Class:</strong> {viewing.department}</p>
                  <p><strong>Email:</strong> {viewing.email}</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {editing && (
            <div className="modal-overlay" onClick={() => setEditing(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <div className="modal-header"><h3>Edit Student</h3></div>
                <div className="modal-body">
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" className="form-control" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Email</label>
                    <input type="email" className="form-control" value={editForm.email} onChange={(e) => setEditForm({...editForm, email: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>Class</label>
                    <select className="form-control" value={editForm.department} onChange={(e) => setEditForm({...editForm, department: e.target.value})}>
                      <option value="">-- Select Class --</option>
                      {courses.map(c => <option key={c.id} value={c.name.trim()}>{c.name.trim()}</option>)}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
                  <button className="btn" onClick={async () => {
                    const target = editing;
                    if (!target) return;
                    const next = {
                      ...target,
                      name: editForm.name.trim(),
                      email: editForm.email.trim(),
                      department: editForm.department.trim(),
                    };
                    const backupStudents = students;
                    // Optimistic UX: close modal and update immediately.
                    setEditing(null);
                    setStudents(prev => prev.map(s => s.id === target.id ? { ...s, ...next } : s));
                    toast.showToast?.('Student updated successfully!', 'success');
                    try {
                      const res = await fetch('/api/students', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: target.id, name: next.name, email: next.email, department: next.department }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to update');
                      setStudents(prev => prev.map(s => s.id === target.id ? data.student : s));
                      try { new BroadcastChannel('attendance_channel').postMessage({ type: 'students_updated', name: data.student.name }); } catch (e) {}
                    } catch (err: any) {
                      setStudents(backupStudents);
                      setEditing(target);
                      setEditForm({ name: target.name || '', email: target.email || '', department: target.department || '' });
                      toast.showToast?.(err.message || 'Failed to update student', 'error');
                    }
                  }}>Save</button>
                </div>
              </div>
            </div>
          )}

          {deleting && (
            <div className="modal-overlay" onClick={() => setDeleting(null)}>
              <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <div className="modal-header"><h3>Confirm Delete</h3></div>
                <div className="modal-body">
                  <p>Are you sure you want to delete <strong>{deleting.name}</strong> (ID: {deleting.id})?</p>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-outline" onClick={() => setDeleting(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={async () => {
                    try {
                      const res = await fetch('/api/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleting.id }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to delete');
                      setStudents(prev => prev.filter(s => s.id !== deleting.id));
                      const txt = `Student ${deleting.name} deleted successfully!`;
                      setDeleting(null);
                      toast.showToast?.(txt, 'success');
                      try { new BroadcastChannel('attendance_channel').postMessage({ type: 'students_updated', name: deleting.name }); } catch (e) {}
                    } catch (err: any) {
                      toast.showToast?.(err.message || 'Failed to delete student', 'error');
                    }
                  }}>Delete</button>
                </div>
              </div>
            </div>
          )}

        </DashboardLayout>
      );
    }
