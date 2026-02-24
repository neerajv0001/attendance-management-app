'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/components/ToastProvider';
import Modal from '@/components/Modal';

export default function TeacherStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]); // This line remains unchanged
  const [loading, setLoading] = useState(true);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [viewStudent, setViewStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', department: '' });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const toast = useToast();

  const fetchStudents = useCallback(() => {
    fetch('/api/students', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setStudents(list);
        setFiltered(list);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg) return;
      if (msg.type === 'students_updated' || msg.type === 'courses_updated') {
        fetchStudents();
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => window.removeEventListener('attendance:update', onUpdate as any);
  }, [fetchStudents]);

  // debounced search
  useEffect(() => setFiltered(students), [students]);

  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name,
      email: student.email || '',
      department: student.department || ''
    });
    setMessage(null);
  };

  const handleView = (student: any) => {
    setViewStudent(student);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    const target = editingStudent;
    const next = {
      ...target,
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      department: editForm.department.trim(),
    };
    const backupStudents = students;
    const backupFiltered = filtered;

    // Optimistic UX: close modal and update row immediately on first click.
    setEditingStudent(null);
    setStudents(prev => prev.map(s => s.id === target.id ? { ...s, ...next } : s));
    setFiltered(prev => prev.map(s => s.id === target.id ? { ...s, ...next } : s));
    toast.showToast?.('Student updated successfully!', 'success');

    try {
      const res = await fetch(`/api/students/${target.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: next.name,
          email: next.email,
          department: next.department,
        })
      });

      if (res.ok) {
        try {
          const bc = new BroadcastChannel('attendance_channel');
          bc.postMessage({ type: 'students_updated', source: 'teacher-students' });
          bc.close();
        } catch (e) {}
        fetchStudents();
      } else {
        const data = await res.json();
        setStudents(backupStudents);
        setFiltered(backupFiltered);
        setEditingStudent(target);
        setEditForm({ name: target.name || '', email: target.email || '', department: target.department || '' });
        setMessage({ type: 'error', text: data.error || 'Failed to update student' });
        toast.showToast?.(data.error || 'Failed to update student', 'error');
      }
    } catch (error) {
      setStudents(backupStudents);
      setFiltered(backupFiltered);
      setEditingStudent(target);
      setEditForm({ name: target.name || '', email: target.email || '', department: target.department || '' });
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
      toast.showToast?.('An error occurred. Please try again.', 'error');
    }
  };

  const handleDelete = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        const name = student ? student.name : studentId;
        const text = `Student ${name} deleted successfully!`;
        setMessage({ type: 'success', text });
        toast.showToast?.(text, 'success');
        try {
          const bc = new BroadcastChannel('attendance_channel');
          bc.postMessage({ type: 'students_updated', source: 'teacher-students' });
          bc.close();
        } catch (e) {}
        setDeleteConfirm(null);
        fetchStudents();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete student' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.showToast?.('Successfully copied text to clipboard!', 'success');
    } catch (err) {
      toast.showToast?.('Failed to copy', 'error');
    }
  };

  const deletingStudent = deleteConfirm ? students.find(s => s.id === deleteConfirm) : null;

  if (loading) {
    return (
      <DashboardLayout role={UserRole.TEACHER}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading students...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.TEACHER}>
      <div className="page-header">
        <h1>My Students</h1>
        <p>Manage your students and their information.</p>
      </div>

      {/* Inline alert banners removed in favor of toasts */}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            placeholder="Search students by ID, name, email or class"
            className="form-control"
            value={query}
            onChange={(e) => {
              const q = e.target.value;
              setQuery(q);
              const key = q.trim().toLowerCase();
              if (!key) setFiltered(students);
              else setFiltered(students.filter(s => (
                (s.id || '').toLowerCase().includes(key) ||
                (s.name || '').toLowerCase().includes(key) ||
                (s.email || '').toLowerCase().includes(key) ||
                (s.department || '').toLowerCase().includes(key)
              )));
            }}
            style={{ minWidth: '600px', maxWidth: '90%', flex: '0 0 600px', minHeight: 44, lineHeight: '1.4', padding: '10px 12px' }}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
      <div className="card">
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Class/Subject</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(student => (
                  <tr key={student.id}>
                    <td style={{ fontWeight: '600', fontFamily: 'monospace' }}>{student.id}</td>
                    <td style={{ fontWeight: '500' }}>{student.name}</td>
                    <td>{student.email || '-'}</td>
                    <td>{student.department || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          className="btn btn-sm"
                          onClick={() => handleView(student)}
                          title={`View ${student.name}`}
                          aria-label={`View ${student.name}`}
                          style={{ padding: '6px 10px', minWidth: 60, height: 32, borderRadius: 6 }}
                        >
                          View
                        </button>
                        <button 
                          className="btn btn-sm btn-outline"
                          onClick={() => handleEdit(student)}
                          title={`Edit ${student.name}`}
                          aria-label={`Edit ${student.name}`}
                          style={{ padding: '6px 8px', minWidth: 38, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn btn-sm btn-danger"
                          onClick={() => setDeleteConfirm(student.id)}
                          title={`Delete ${student.name}`}
                          aria-label={`Delete ${student.name}`}
                          style={{ padding: '6px 10px', minWidth: 70, height: 32, borderRadius: 6 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🎓</div>
            <p>No students found.</p>
            <Link href="/teacher/add-student" className="btn" style={{ marginTop: '16px' }}>
              Add Your First Student
            </Link>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <div className="modal-header">
          <h3>Confirm Delete</h3>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to delete <strong>{deletingStudent ? deletingStudent.name : 'this student'}</strong>? This action cannot be undone.</p>
        </div>
        <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setDeleteConfirm(null)}
          >
            Cancel
          </button>
          <button 
            className="btn btn-danger" 
            onClick={() => handleDelete(deleteConfirm!)}
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* View Student Modal */}
      <Modal open={!!viewStudent} onClose={() => setViewStudent(null)}>
        <div className="modal-header">
          <h3>Student Details</h3>
        </div>
        <div className="modal-body">
          <p>
            <strong>ID:</strong>
            <span style={{ fontFamily: 'monospace', marginLeft: 8, marginRight: 8 }}>{viewStudent?.id}</span>
            <button type="button" className="btn btn-sm" onClick={() => copyToClipboard(viewStudent?.id || '')} title="Copy student ID" aria-label="Copy student ID">📋</button>
          </p>
          <p><strong>Name:</strong> {viewStudent?.name}</p>
          <p><strong>Email:</strong> {viewStudent?.email || '-'}</p>
          <p><strong>Class/Subject:</strong> {viewStudent?.department || '-'}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setViewStudent(null)}>Close</button>
        </div>
      </Modal>

      {/* Edit Student Modal (centered) */}
      <Modal open={!!editingStudent} onClose={() => setEditingStudent(null)}>
        <div className="modal-header">
          <h3>Edit Student</h3>
        </div>
        <div className="modal-body">
          <form onSubmit={handleUpdate}>
            <div className="input-group">
              <label>Student ID</label>
              <input type="text" className="form-control" value={editingStudent?.id} disabled style={{ background: '#f1f5f9' }} />
            </div>
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" className="form-control" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input type="email" className="form-control" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Class/Subject</label>
              <input type="text" className="form-control" value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-outline" onClick={() => setEditingStudent(null)}>Cancel</button>
              <button type="submit" className="btn">Save</button>
            </div>
          </form>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
