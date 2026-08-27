import { Outlet } from 'react-router-dom';
import Icon from '../feedback/Icon';

const POINTS = [
  'One catalogue across pharmacies, clinics and hospitals',
  'Batch-wise inventory with FEFO allocation and expiry alerts',
  'Server-generated GST tax invoices on every accepted order',
  'Cold-chain products tracked from warehouse to counter',
];

/** Split-screen auth shell: brand pitch on the left, form on the right. */
export default function AuthLayout() {
  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="row gap-3">
          <span className="sidebar__mark" style={{ width: 34, height: 34 }}>VS</span>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>VS Arogya</span>
        </div>

        <div className="auth__pitch">
          <h2>The distribution platform behind every counter.</h2>
          <p>Order, track and invoice medicines across your whole network — from the warehouse to the outlet to the patient.</p>
          <div className="auth__points">
            {POINTS.map((p) => (
              <div className="auth__point" key={p}>
                <Icon name="check" size={15} strokeWidth={2.4} />
                <span>{p}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 1, fontSize: 'var(--fs-sm)', color: 'rgba(255,255,255,.5)' }}>
          © {new Date().getFullYear()} VS Arogya. All rights reserved.
        </p>
      </aside>

      <main className="auth__panel"><Outlet /></main>
    </div>
  );
}
