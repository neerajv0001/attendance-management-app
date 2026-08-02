'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ToastProvider';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/lib/types';

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    const load = () => {
      fetch('/api/students', { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (!mounted) return;
          setStudents(Array.isArray(data) ? data : []);
          setLoading(false);
        }).catch(() => {
          if (!mounted) return;
          toast.showToast?.('Failed to load students', 'error');
          setLoading(false);
        });
    };
    load();
    const onUpdate = (e: any) => {
      const d = e?.detail;
      if (!d) return;
      if (d.type === 'students_updated' || d.type === 'courses_updated') {
        load();
      }
    };
    window.addEventListener('attendance:update', onUpdate as any);
    return () => { mounted = false; window.removeEventListener('attendance:update', onUpdate as any); };
  }, []);

  if (loading) {
    return (
      <DashboardLayout role={UserRole.ADMIN}>
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading students...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={UserRole.ADMIN}>
      <div className="page-header">
        <h1>All Students</h1>
        <p>View and manage all registered students in the system.</p>
      </div>
      
      {students.length > 0 ? (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {students.map(student => (
                  <tr key={student.id}>
                    <td style={{ fontWeight: '500' }}>{student.id}</td>
                    <td>{student.name}</td>
                    <td>{student.department}</td>
                    <td>{new Date(student.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p>No students found.</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
