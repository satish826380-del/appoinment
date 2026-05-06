import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Stethoscope,
  User,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const patientLinks = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/book', label: 'Book', icon: CalendarDays },
  { to: '/my-appointments', label: 'Appointments', icon: ClipboardList }
];

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/slots', label: 'Slots', icon: CalendarDays }
];

export default function Layout() {
  const { user, isAdmin, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const links = isAdmin ? adminLinks : patientLinks;

  async function handleSignOut(event) {
    event.preventDefault();
    await signOut();
    navigate('/', { replace: true });
    window.location.assign('/');
  }

  /* ── Admin sidebar layout ── */
  if (user && isAdmin) {
    return (
      <div className="admin-layout">
        {/* Sidebar – desktop only */}
        <aside className="admin-sidebar">
          <div className="sidebar-top">
            <Link to="/" className="sidebar-logo">
              <Stethoscope size={22} />
            </Link>
            <nav className="sidebar-nav">
              {links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="sidebar-icon-btn" title={label}>
                  <Icon size={20} />
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="sidebar-bottom">
            <button className="sidebar-icon-btn" onClick={handleSignOut} title="Sign out">
              <LogOut size={20} />
            </button>
          </div>
        </aside>

        <div className="admin-main">
          {/* Top bar */}
          <header className="admin-topbar">
            <h2 className="topbar-title">CareQueue Clinic</h2>
            <div className="topbar-actions">
              <button className="topbar-icon"><Search size={16} /></button>
              <button className="topbar-icon"><Bell size={16} /></button>
              <div className="topbar-profile">
                <div className="topbar-avatar"><User size={15} /></div>
                <div className="topbar-user-info">
                  <span className="topbar-username">{profile?.full_name || 'Admin'}</span>
                  <span className="topbar-role">Administrator</span>
                </div>
              </div>
            </div>
          </header>

          <main className="admin-content">
            <Outlet />
          </main>
        </div>

        {/* Bottom nav – mobile only */}
        <nav className="admin-bottom-nav md:hidden">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button onClick={handleSignOut}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </nav>
      </div>
    );
  }

  /* ── Patient / public layout ── */
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="patient-header">
        <div className="header-inner">
          <Link to="/" className="header-logo">
            <span className="header-logo-icon"><Stethoscope size={18} /></span>
            <span>CareQueue</span>
          </Link>

          <nav className="header-nav-desktop">
            {user &&
              links.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} className="nav-pill" end={to === '/'}>
                  <Icon size={16} />
                  {label}
                </NavLink>
              ))}
          </nav>

          <div className="header-actions">
            {!user ? (
              <>
                <Link className="btn-outline" to="/login">Patient Login</Link>
                <Link className="btn-filled" to="/admin/login">Admin</Link>
              </>
            ) : (
              <button className="btn-outline" onClick={handleSignOut}>
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="patient-content">
        <Outlet />
      </main>

      {/* Bottom nav – mobile only, when logged in */}
      {user && (
        <nav className="patient-bottom-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button onClick={handleSignOut}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </nav>
      )}
    </div>
  );
}
