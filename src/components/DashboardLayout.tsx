"use client";
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { UserRole } from '@/lib/types';
import { useToast } from '@/components/ToastProvider';
import { toast as hotToast } from 'react-hot-toast';

export default function DashboardLayout({ children, role }: { children: React.ReactNode, role: UserRole }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const toast = useToast();

  useEffect(() => {
    // Fetch user info
    fetch('/api/user/settings')
      .then(res => res.json())
      .then(data => {
        if (data.name) setUserName(data.name);
        else setUserName(role === UserRole.ADMIN ? 'Admin' : role === UserRole.TEACHER ? 'Teacher' : 'Student');

        // Welcome toast is handled at login; avoid duplicate messages here.
      })
      .catch(() => {
        // Fallback
        setUserName(role === UserRole.ADMIN ? 'Admin' : role === UserRole.TEACHER ? 'Teacher' : 'Student');
      });
  }, [role]);

  // Show welcome toast after redirect from login (persisted as justLoggedIn)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('justLoggedIn');
      if (raw) {
        const obj = JSON.parse(raw);
        try { hotToast.dismiss(); } catch (e) {}
        if (obj.role === 'ADMIN') {
          toast.showToast?.('Welcome back, Admin!', 'success', '👑');
        } else if (obj.role === 'TEACHER') {
          toast.showToast?.(`Welcome back, ${obj.name}!`, 'success', '👨‍🏫');
        } else if (obj.role === 'STUDENT') {
          toast.showToast?.(`Welcome back, ${obj.name}!`, 'success', '🎓');
        } else {
          toast.showToast?.(`Welcome back, ${obj.name}!`, 'success');
        }
        // Open the mobile sidebar after login so users on phones see the nav
        try { document.body.classList.add('sidebar-mobile-open'); } catch (e) {}
        setSidebarOpen(true);
      }
    } catch (e) {
      // ignore
    }
    try { localStorage.removeItem('justLoggedIn'); } catch {}
  }, []);

  const getRoleLabel = () => {
    switch(role) {
      case UserRole.ADMIN: return 'Administrator';
      case UserRole.TEACHER: return 'Teacher';
      case UserRole.STUDENT: return 'Student';
      default: return '';
    }
  };

  const getRoleColor = () => {
    switch(role) {
      case UserRole.ADMIN: return '#ef4444';
      case UserRole.TEACHER: return '#3b82f6';
      case UserRole.STUDENT: return '#10b981';
      default: return '#6b7280';
    }
  };

  // Welcome toast is handled only once after login via localStorage flag.

  return (
    <div className="dashboard-layout">
      <Sidebar role={role} isOpen={sidebarOpen} />
       <div className="main-content">
         <header className="top-navbar">
           <button
             className="menu-toggle"
             onClick={() => {
               try { document.body.classList.toggle('sidebar-mobile-open'); } catch (e) {}
               setSidebarOpen(s => !s);
             }}
             aria-label="Toggle menu"
             title="Toggle menu"
             style={{ 
               background: 'transparent', 
               border: 'none', 
               padding: 8, 
               cursor: 'pointer',
               flexShrink: 0,
               width: 40,
               height: 40,
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center'
             }}
           >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
               <path d="M4 6h16M4 12h16M4 18h16" />
             </svg>
           </button>
           <div style={{ 
             display: 'flex', 
             alignItems: 'center', 
             gap: '12px',
             minWidth: 0,
             overflow: 'hidden',
             marginLeft: 'auto',
             flexWrap: 'wrap'
           }}>
             <div style={{ textAlign: 'right', minWidth: 0 }}>
               <div suppressHydrationWarning style={{ 
                 fontWeight: '600', 
                 color: 'var(--text-primary)', 
                 fontSize: 'clamp(0.8rem, 2.5vw, 0.95rem)',
                 whiteSpace: 'nowrap',
                 overflow: 'hidden',
                 textOverflow: 'ellipsis'
               }}>
                 {userName || getRoleLabel()}
               </div>
               <div style={{ 
                 fontSize: 'clamp(0.65rem, 2vw, 0.75rem)', 
                 color: getRoleColor(),
                 fontWeight: '600',
                 textTransform: 'uppercase',
                 letterSpacing: '0.5px'
               }}>
                 {getRoleLabel()}
               </div>
             </div>
             <div style={{ 
               width: 40, 
               height: 40, 
               minWidth: 40,
               borderRadius: '50%', 
               background: `linear-gradient(135deg, ${getRoleColor()}20 0%, ${getRoleColor()}40 100%)`,
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'center',
               fontSize: '1.1rem',
               border: `2px solid ${getRoleColor()}40`,
               flexShrink: 0
             }}>
               {role === UserRole.ADMIN ? (
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                   <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6l-7-3z" />
                   <path d="m9 12 2 2 4-4" />
                 </svg>
               ) : role === UserRole.TEACHER ? (
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                   <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                   <path d="M4 20a8 8 0 0 1 16 0" />
                   <path d="M18 7h4" />
                   <path d="M20 5v4" />
                 </svg>
               ) : (
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                   <path d="M22 10 12 5 2 10l10 5 10-5z" />
                   <path d="M6 12v5c3 2 9 2 12 0v-5" />
                   <path d="M22 10v6" />
                 </svg>
               )}
             </div>
           </div>
         </header>
         <main className="page-content">
           {children}
         </main>
       </div>
        {/* Sidebar sizing handled in globals.css */}
   </div>
 );
}
