"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

export default function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCourseName, setNewCourseName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingCourse, setDeletingCourse] = useState<any | null>(null);
  const toast = useToast();
  const sourceId = useMemo(() => `admin-courses-${Math.random().toString(36).slice(2)}`, []);
  const sortCoursesByName = useCallback((list: any[]) => {
    return [...list].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' }));
  }, []);

  const refreshCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses', { cache: 'no-store' });
      const data = await res.json();
      setCourses(sortCoursesByName(Array.isArray(data) ? data : []));
    } catch (e) {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [sortCoursesByName]);

  const broadcastCoursesUpdated = useCallback((name?: string) => {
    try {
      const bc = new BroadcastChannel('attendance_channel');
      bc.postMessage({ type: 'courses_updated', name, silent: true, source: sourceId });
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

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const courseName = newCourseName.trim();
    if (!courseName) return;
    // optimistic UI: add locally first
    const tempId = `temp-${Date.now()}`;
    const tempCourse = { id: tempId, name: courseName, subjects: [] };
    setCourses(prev => sortCoursesByName([...prev, tempCourse]));
    setNewCourseName('');
    toast.showToast?.(`Successfully Added ${courseName}`, 'success');
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: courseName })
      });
      const payload = await res.json();
      if (res.ok) {
        // replace temp item with server item (if server returned it)
        setCourses(prev => sortCoursesByName(prev.map(c => c.id === tempId ? (payload && payload.id ? payload : { ...c, id: payload?.id || c.id, name: payload?.name || c.name }) : c)));
        broadcastCoursesUpdated(payload?.name || courseName);
      } else {
        // remove optimistic item
        setCourses(prev => prev.filter(c => c.id !== tempId));
        const msg = payload?.error || `Failed to add ${courseName}. Reverted.`;
        toast.showToast?.(msg, 'error');
      }
    } catch (err: any) {
      setCourses(prev => prev.filter(c => c.id !== tempId));
      const msg = err?.message || `Error adding ${courseName}. Reverted.`;
      toast.showToast?.(msg, 'error');
    }
  };

  const handleStartEdit = (c: any) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    const nextName = editingName.trim();
    if (!nextName) return;
    const backup = courses;
    setCourses(prev => sortCoursesByName(prev.map(c => c.id === id ? { ...c, name: nextName } : c)));
    setEditingId(null);
    setEditingName('');
    toast.showToast?.('Course updated successfully!', 'success');
    try {
      const res = await fetch('/api/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name: nextName })
      });

      if (res.ok) {
        broadcastCoursesUpdated(nextName);
      } else {
        setCourses(backup);
        toast.showToast?.('Failed to update course. Reverted.', 'error');
      }
    } catch (err) {
      setCourses(backup);
      toast.showToast?.('Error updating course. Reverted.', 'error');
    }
  };

  const handleRemove = (course: any) => {
    setDeletingCourse(course);
  };

  const confirmDeleteCourse = async () => {
    if (!deletingCourse) return;
    const courseToDelete = deletingCourse;
    setDeletingCourse(null);
    // optimistic remove: remove locally first, keep backup
    const backup = courses;
    setCourses(prev => prev.filter(c => c.id !== courseToDelete.id));
    toast.showToast?.(`Course ${courseToDelete.name} removed successfully!`, 'success');
    try {
      const res = await fetch('/api/courses', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: courseToDelete.id })
      });
      const payload = await res.json();
      if (res.ok) {
        broadcastCoursesUpdated(courseToDelete.name);
      } else {
        // revert on failure
        setCourses(backup);
        const msg = payload?.error || `Failed to remove ${courseToDelete.name}. Reverted.`;
        toast.showToast?.(msg, 'error');
      }
    } catch (err: any) {
      setCourses(backup);
      const msg = err?.message || `Error removing ${courseToDelete.name}. Reverted.`;
      toast.showToast?.(msg, 'error');
    }
  };

  return (
    <DashboardLayout role={UserRole.ADMIN}>
      <h1 style={{ marginBottom: '20px', color: '#003366' }}>Manage Courses</h1>

      <div className="card" style={{ maxWidth: '600px', marginBottom: '30px' }}>
        <h3>Add New Course</h3>
        <form onSubmit={handleAddCourse} style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Course Name (e.g. B.Tech CS)" 
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            required
          />
          <button type="submit" className="btn">Add</button>
        </form>
      </div>

      <div className="card">
        <h3>Existing Courses</h3>
        {loading ? (
          <p>Loading...</p>
        ) : courses.length > 0 ? (
          <ul style={{ marginTop: '15px', paddingLeft: '0' }}>
            {courses.map(course => (
              <li key={course.id} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {editingId === course.id ? (
                    <input className="form-control" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                  ) : (
                    <div style={{ fontWeight: 600 }}>{course.name}</div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {editingId === course.id ? (
                    <>
                      <button className="btn btn-sm" onClick={() => handleSaveEdit(course.id)} type="button">Save</button>
                      <button className="btn btn-sm btn-outline" onClick={handleCancelEdit} type="button">Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-sm btn-outline" onClick={() => handleStartEdit(course)} type="button">✏️</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRemove(course)} type="button">🗑️</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No courses found.</p>
        )}
      </div>
      {deletingCourse && (
        <div className="modal-overlay" onClick={() => setDeletingCourse(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Course</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{deletingCourse.name}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setDeletingCourse(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDeleteCourse}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
