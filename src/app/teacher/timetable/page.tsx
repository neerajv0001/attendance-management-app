'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';

type TimetableEntry = {
  id: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
  teacherId?: string;
  teacherName?: string;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelReason?: string;
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX: Record<string, number> = DAYS.reduce((acc, day, idx) => ({ ...acc, [day]: idx }), {});

export default function TimetablePage() {
  const [teacherSubject, setTeacherSubject] = useState('');
  const [formData, setFormData] = useState({
    subject: '',
    day: 'Monday',
    startTime: '',
    endTime: ''
  });
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingCancelId, setTogglingCancelId] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', day: 'Monday', startTime: '', endTime: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showAllTimetable, setShowAllTimetable] = useState(false);
  const [allEntries, setAllEntries] = useState<TimetableEntry[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const toast = useToast();

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/timetable', { cache: 'no-store' });
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      setEntries([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    fetch('/api/user/settings', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const subject = typeof data?.subject === 'string' ? data.subject.trim() : '';
        if (!subject) return;
        setTeacherSubject(subject);
        setFormData(prev => ({ ...prev, subject: prev.subject || subject }));
      })
      .catch(() => {});
  }, []);

  const loadAllEntries = useCallback(async () => {
    setLoadingAll(true);
    try {
      const res = await fetch('/api/timetable?scope=all', { cache: 'no-store' });
      const data = await res.json();
      setAllEntries(Array.isArray(data) ? data : []);
    } catch (e) {
      setAllEntries([]);
    } finally {
      setLoadingAll(false);
    }
  }, []);

  useEffect(() => {
    const onUpdate = (event: any) => {
      const msg = event?.detail;
      if (!msg || msg.type !== 'timetable_updated') return;
      loadEntries();
      if (showAllTimetable) loadAllEntries();
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => window.removeEventListener('attendance:update', onUpdate as any);
  }, [loadEntries, loadAllEntries, showAllTimetable]);

  const upcomingLectures = useMemo(() => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    return [...entries].sort((a, b) => {
      const aIdx = DAY_INDEX[a.day] ?? 0;
      const bIdx = DAY_INDEX[b.day] ?? 0;
      if (aIdx !== bIdx) return aIdx - bIdx;
      return toMinutes(a.startTime) - toMinutes(b.startTime);
    });
  }, [entries]);

  const allLecturesByDay = useMemo(() => {
    const toMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };
    const grouped: Record<string, TimetableEntry[]> = DAYS.reduce((acc, day) => {
      acc[day] = [];
      return acc;
    }, {} as Record<string, TimetableEntry[]>);

    allEntries.forEach((entry) => {
      if (!grouped[entry.day]) grouped[entry.day] = [];
      grouped[entry.day].push(entry);
    });

    DAYS.forEach((day) => {
      grouped[day] = grouped[day].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
    });
    return grouped;
  }, [allEntries]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json().catch(() => ({}));
      
      if (res.ok) {
        toast.showToast?.('Timetable entry added successfully!', 'success');
        try {
          const bc = new BroadcastChannel('attendance_channel');
          bc.postMessage({ type: 'timetable_updated', source: 'teacher-timetable' });
          bc.close();
        } catch (e) {}
        if (data?.entry) {
          setEntries(prev => [data.entry, ...prev]);
        } else {
          loadEntries();
        }
        setFormData({ subject: teacherSubject || '', day: 'Monday', startTime: '', endTime: '' });
      } else {
        toast.showToast?.(data?.error || 'Failed to add timetable entry', 'error');
      }
    } catch (e) {
      toast.showToast?.('Failed to add timetable entry', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch('/api/timetable', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setEntries(prev => prev.filter(entry => entry.id !== id));
        toast.showToast?.('Lecture deleted successfully!', 'success');
        try {
          const bc = new BroadcastChannel('attendance_channel');
          bc.postMessage({ type: 'timetable_updated', source: 'teacher-timetable' });
          bc.close();
        } catch (e) {}
      } else {
        const data = await res.json().catch(() => ({}));
        toast.showToast?.(data?.error || 'Failed to delete lecture', 'error');
      }
    } catch (e) {
      toast.showToast?.('Failed to delete lecture', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleCancel = async (entry: TimetableEntry) => {
    const nextCancelled = !entry.isCancelled;
    setTogglingCancelId(entry.id);
    const backup = entries;
    setEntries(prev => prev.map(e => e.id === entry.id
      ? {
          ...e,
          isCancelled: nextCancelled,
          cancelledAt: nextCancelled ? new Date().toISOString() : undefined,
          cancelReason: nextCancelled ? (e.cancelReason || 'Cancelled by teacher') : undefined,
        }
      : e));

    try {
      const res = await fetch('/api/timetable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          isCancelled: nextCancelled,
          cancelReason: nextCancelled ? 'Cancelled by teacher' : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEntries(backup);
        toast.showToast?.(data?.error || 'Failed to update lecture status', 'error');
        return;
      }

      if (data?.entry) {
        setEntries(prev => prev.map(e => (e.id === entry.id ? data.entry : e)));
      }

      toast.showToast?.(
        nextCancelled ? 'Lecture cancelled successfully!' : 'Lecture resumed successfully!',
        'success'
      );
      try {
        const bc = new BroadcastChannel('attendance_channel');
        bc.postMessage({ type: 'timetable_updated', source: 'teacher-timetable', id: entry.id, isCancelled: nextCancelled });
        bc.close();
      } catch (e) {}
    } catch (e) {
      setEntries(backup);
      toast.showToast?.('Failed to update lecture status', 'error');
    } finally {
      setTogglingCancelId(null);
    }
  };

  const openEdit = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setEditForm({
      subject: entry.subject || teacherSubject || '',
      day: entry.day || 'Monday',
      startTime: entry.startTime || '',
      endTime: entry.endTime || '',
    });
  };

  const saveEdit = async () => {
    if (!editingEntry) return;
    setSavingEdit(true);
    const target = editingEntry;
    const payload = {
      id: target.id,
      subject: (teacherSubject || editForm.subject).trim(),
      day: editForm.day,
      startTime: editForm.startTime,
      endTime: editForm.endTime,
    };
    const backup = entries;
    setEntries(prev =>
      prev.map(e => (e.id === target.id ? { ...e, ...payload, subject: payload.subject } : e))
    );
    setEditingEntry(null);

    try {
      const res = await fetch('/api/timetable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEntries(backup);
        toast.showToast?.(data?.error || 'Failed to update lecture', 'error');
        return;
      }
      if (data?.entry) {
        setEntries(prev => prev.map(e => (e.id === target.id ? data.entry : e)));
      }
      toast.showToast?.('Lecture updated successfully!', 'success');
      try {
        const bc = new BroadcastChannel('attendance_channel');
        bc.postMessage({ type: 'timetable_updated', source: 'teacher-timetable', id: target.id });
        bc.close();
      } catch (e) {}
    } catch (e) {
      setEntries(backup);
      toast.showToast?.('Failed to update lecture', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const openAllTimetable = async () => {
    setShowAllTimetable(true);
    await loadAllEntries();
  };

  return (
    <DashboardLayout role={UserRole.TEACHER}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: '20px' }}>
        <h1 style={{ margin: 0, color: '#003366' }}>Create Timetable</h1>
        <button type="button" className="btn btn-outline" onClick={openAllTimetable}>
          Check Timetable
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Subject</label>
              <input
                type="text"
                className="form-control"
                required
                readOnly={!!teacherSubject}
                value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
              {teacherSubject && (
                <small style={{ color: 'var(--text-secondary)' }}>
                  Subject auto-filled from your registration profile.
                </small>
              )}
            </div>

            <div className="input-group">
              <label>Day</label>
              <select className="form-control"
                value={formData.day} onChange={(e) => setFormData({ ...formData, day: e.target.value })}>
                {DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <div className="input-group" style={{ flex: 1 }}>
                <label>Start Time</label>
                <input type="time" className="form-control" required
                  value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} />
              </div>
              <div className="input-group" style={{ flex: 1 }}>
                <label>End Time</label>
                <input type="time" className="form-control" required
                  value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} />
              </div>
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Saving...' : 'Add to Timetable'}
            </button>
          </form>
        </div>

        <div className="card" style={{ alignSelf: 'start' }}>
          <h3 style={{ marginBottom: 12 }}>Scheduled Lectures</h3>
          {loadingList ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading schedule...</p>
          ) : upcomingLectures.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No lectures scheduled yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingLectures.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    padding: 10,
                    border: `1px solid ${entry.isCancelled ? '#fca5a5' : 'var(--border-color)'}`,
                    borderRadius: 10,
                    background: entry.isCancelled ? '#fff1f2' : 'var(--card-bg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <strong
                      style={{
                        color: 'var(--text-primary)',
                        textDecoration: entry.isCancelled ? 'line-through' : 'none',
                        opacity: entry.isCancelled ? 0.8 : 1,
                      }}
                    >
                      {entry.subject}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{entry.day}</span>
                  </div>
                  <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {entry.startTime} - {entry.endTime}
                  </div>
                  {entry.isCancelled && (
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
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
                  <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEdit(entry)}
                      disabled={deletingId === entry.id || togglingCancelId === entry.id}
                      style={{ marginRight: 8 }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${entry.isCancelled ? 'btn-outline' : ''}`}
                      onClick={() => handleToggleCancel(entry)}
                      disabled={togglingCancelId === entry.id || deletingId === entry.id}
                      style={{ marginRight: 8 }}
                    >
                      {togglingCancelId === entry.id
                        ? (entry.isCancelled ? 'Resuming...' : 'Cancelling...')
                        : (entry.isCancelled ? 'Resume' : 'Cancel')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id || togglingCancelId === entry.id}
                    >
                      {deletingId === entry.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {editingEntry && (
        <div className="modal-overlay" onClick={() => !savingEdit && setEditingEntry(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3>Edit Lecture</h3></div>
            <div className="modal-body">
              <div className="input-group">
                <label>Subject</label>
                <input
                  type="text"
                  className="form-control"
                  value={teacherSubject || editForm.subject}
                  readOnly={!!teacherSubject}
                  onChange={(e) => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div className="input-group">
                <label>Day</label>
                <select
                  className="form-control"
                  value={editForm.day}
                  onChange={(e) => setEditForm(prev => ({ ...prev, day: e.target.value }))}
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editForm.startTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="input-group" style={{ flex: 1 }}>
                  <label>End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={editForm.endTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingEntry(null)} disabled={savingEdit}>Cancel</button>
              <button className="btn" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showAllTimetable && (
        <div className="modal-overlay" onClick={() => setShowAllTimetable(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 980 }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>All Teachers Timetable</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  className="form-control"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  style={{ minWidth: 170 }}
                >
                  {DAYS.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-sm btn-outline" onClick={loadAllEntries} disabled={loadingAll}>
                  {loadingAll ? 'Loading...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="modal-body">
              {loadingAll ? (
                <p style={{ color: 'var(--text-secondary)' }}>Loading timetable...</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 10 }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong>{selectedDay}</strong>
                    </div>
                    {(allLecturesByDay[selectedDay] || []).length === 0 ? (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No lectures</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(allLecturesByDay[selectedDay] || []).map((entry) => (
                          <div key={entry.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, background: entry.isCancelled ? '#fff1f2' : '#fff' }}>
                            <div style={{ fontWeight: 600 }}>{entry.subject}</div>
                            <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                              {entry.startTime} - {entry.endTime}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Teacher: {entry.teacherName || entry.teacherId || 'N/A'}
                            </div>
                            {entry.isCancelled && (
                              <div style={{ marginTop: 4, fontSize: '0.78rem', color: '#b91c1c' }}>
                                Cancelled
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAllTimetable(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
