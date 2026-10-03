import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

/** Shell for the five internal roles: Admin, Marketing, Outlet, Delivery, Agent. */
export default function DashboardLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="shell">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <div className="main">
        <Topbar onBurger={() => setMenuOpen(true)} />
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
