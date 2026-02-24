"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

export default function AdminSubjects() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingSubject, setEditingSubject] = useState<{ name: string; courseId: string } | null>(null);
  const [editedName, setEditedName] = useState('');
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);
  const toast = useToast();
  const sourceId = useMemo(() => `admin-subjects-${Math.random().toString(36).slice(2)}`, []);

  const refreshCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const broadcastCoursesUpdated = useCallback(() => {
    try {
      const bc = new BroadcastChannel('attendance_channel');
      bc.postMessage({ type: 'courses_updated', silent: true, source: sourceId });
      bc.close();
    } catch (e) {}
  }, [sourceId]);

  useEffect(() => {
    refreshCourses();
  }, [refreshCourses]);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg || msg.type !== 'courses_updated') return;
      if (msg.source === sourceId) return;
      refreshCourses();
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => window.removeEventListener('attendance:update', onUpdate as any);
  }, [refreshCourses, sourceId]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjectName = newSubjectName.trim();
    if (!selectedCourse || !subjectName) return;
    const alreadyExists = (courses.find(c => c.id === selectedCourse)?.subjects || [])
      .some((s: string) => s.toLowerCase() === subjectName.toLowerCase());
    if (alreadyExists) {
      toast.showToast?.('Subject already exists for this course.', 'error');
      return;
    }

    const backup = courses;
    setCourses(prev => prev.map(c =>
      c.id === selectedCourse
        ? { ...c, subjects: [...(c.subjects || []), subjectName] }
        : c
    ));
    setNewSubjectName('');
    toast.showToast?.(`Successfully Added ${subjectName}`, 'success');

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourse, name: subjectName })
      });

      if (res.ok) {
        broadcastCoursesUpdated();
      } else {
        setCourses(backup);
        toast.showToast?.('Failed to add subject. Reverted.', 'error');
      }
    } catch (err) {
      setCourses(backup);
      toast.showToast('Error adding subject. Reverted.', 'error');
    }
  };

  const subjectsForSelected = selectedCourse ? (courses.find(c => c.id === selectedCourse)?.subjects || []) : [];

  const startEdit = (name: string) => {
    setEditingSubject({ name, courseId: selectedCourse });
    setEditedName(name);
  };

  const cancelEdit = () => {
    setEditingSubject(null);
    setEditedName('');
  };

  const saveEdit = async () => {
    const nextName = editedName.trim();
    if (!editingSubject || !nextName) return;
    const backup = courses;
    setCourses(prev => prev.map(c => {
      if (c.id !== editingSubject.courseId) return c;
      return {
        ...c,
        subjects: (c.subjects || []).map((s: string) => s === editingSubject.name ? nextName : s)
      };
    }));
    toast.showToast('Subject updated successfully!', 'success');
    cancelEdit();
    try {
      const res = await fetch('/api/subjects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: editingSubject.courseId, oldName: editingSubject.name, newName: nextName })
      });

      if (res.ok) {
        broadcastCoursesUpdated();
      } else {
        setCourses(backup);
        toast.showToast('Failed to update subject. Reverted.', 'error');
      }
    } catch (err) {
      setCourses(backup);
      toast.showToast('Error updating subject. Reverted.', 'error');
    }
  };

  const removeSubject = (name: string) => {
    setSubjectToDelete(name);
  };

  const confirmRemoveSubject = async () => {
    if (!selectedCourse || !subjectToDelete) return;
    const deletingName = subjectToDelete;
    setSubjectToDelete(null);
    const backup = courses;
    setCourses(prev => prev.map(c =>
      c.id === selectedCourse
        ? { ...c, subjects: (c.subjects || []).filter((s: string) => s !== deletingName) }
        : c
    ));
    toast.showToast?.('Record removed successfully.', 'success');
    try {
      const res = await fetch('/api/subjects', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourse, name: deletingName })
      });

      if (res.ok) {
        broadcastCoursesUpdated();
      } else {
        setCourses(backup);
        toast.showToast?.('Failed to delete subject. Reverted.', 'error');
      }
    } catch (err) {
      setCourses(backup);
      toast.showToast('Error deleting subject. Reverted.', 'error');
    }
  };

  return (
    <DashboardLayout role={UserRole.ADMIN}>
      <h1 style={{ marginBottom: '20px', color: '#003366' }}>Manage Subjects</h1>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <h3>Add New Subject</h3>
          <form onSubmit={handleAddSubject} style={{ marginTop: '15px' }}>
            <div className="input-group">
              <label>Select Course</label>
              <select 
                className="form-control" 
                value={selectedCourse} 
                onChange={(e) => setSelectedCourse(e.target.value)}
                required
              >
                <option value="">-- Select Course --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group">
              <label>Subject Name</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Mathematics" 
                value={newSubjectName} 
                onChange={(e) => setNewSubjectName(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn" disabled={!selectedCourse}>Add Subject</button>
          </form>
        </div>

        <div className="card">
          <h3>Existing Subjects</h3>
          {!selectedCourse ? (
            <p style={{ color: 'var(--text-secondary)' }}>Select a course to view its subjects.</p>
          ) : (
            <ul style={{ marginTop: 12, paddingLeft: 0 }}>
              {subjectsForSelected.length === 0 ? (
                <li style={{ color: 'var(--text-secondary)' }}>No subjects for this course.</li>
              ) : subjectsForSelected.map((s: string) => (
                <li key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    {editingSubject && editingSubject.name === s ? (
                      <input className="form-control" value={editedName} onChange={(e) => setEditedName(e.target.value)} />
                    ) : (
                      <span style={{ fontWeight: 600 }}>{s}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingSubject && editingSubject.name === s ? (
                      <>
                        <button className="btn btn-sm" onClick={saveEdit} type="button">Save</button>
                        <button className="btn btn-sm btn-outline" onClick={cancelEdit} type="button">Cancel</button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-sm btn-outline" onClick={() => startEdit(s)} type="button" aria-label={`Edit ${s}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="m12 6 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => removeSubject(s)} type="button" aria-label={`Delete ${s}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 6V4h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {subjectToDelete && (
        <div className="modal-overlay" onClick={() => setSubjectToDelete(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Subject</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{subjectToDelete}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setSubjectToDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmRemoveSubject}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
