// =============================================================================
// DEV ONLY — mock role switcher.
//
// Rendered ONLY while VITE_USE_MOCK is true. This is the "development login
// mechanism" the brief asks for, deliberately isolated in ONE file so removing
// it is: delete this file, drop the two lines in LoginPage that import and
// render it, set VITE_USE_MOCK=false.
//
// It does not bypass authentication — it fills the real form with a demo
// account's credentials and submits through the normal authService.login path.
// =============================================================================

import { ROLE_LABELS, ROLES } from '../../constants/roles';
import { DEMO_ACCOUNTS, DEMO_OUTLET, DEMO_PASSWORD } from '../../mock/users';
import Icon from '../../components/feedback/Icon';

const ROLE_ICON = {
  [ROLES.ADMIN]: 'shield',
  [ROLES.MARKETING]: 'chart',
  [ROLES.VENDOR]: 'store',
  [ROLES.DELIVERY]: 'truck',
  [ROLES.OUTLET]: 'building',
  [ROLES.AGENT]: 'pin',
};

const ACCOUNTS = [
  ...DEMO_ACCOUNTS.map((a) => ({ role: a.role, mobile: a.mobile_no, name: a.store_name || a.contact_person_name })),
  { role: ROLES.OUTLET, mobile: DEMO_OUTLET.mobileNo, name: DEMO_OUTLET.outletName },
];

export default function DevRoleSwitcher({ onPick, busy }) {
  return (
    <div className="card card--flat" style={{ background: 'var(--surface-alt)', marginTop: 'var(--sp-6)' }}>
      <div className="card__head" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
        <div className="row gap-2">
          <Icon name="info" size={14} />
          <div>
            <p style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Demo sign-in</p>
            <p className="field__hint">Frontend-only build. Pick a role to sign in with its demo account.</p>
          </div>
        </div>
      </div>
      <div className="card__body card__body--tight">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--sp-2)' }}>
          {ACCOUNTS.map((a) => (
            <button
              key={a.role}
              type="button"
              disabled={busy}
              onClick={() => onPick({ mobile: a.mobile, password: DEMO_PASSWORD })}
              className="row gap-2"
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-btn)',
                background: 'var(--surface)',
                textAlign: 'left',
              }}
            >
              <span className="stat__icon" style={{ width: 26, height: 26 }}>
                <Icon name={ROLE_ICON[a.role]} size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
                  {ROLE_LABELS[a.role]}
                </span>
                <span className="subtle truncate" style={{ display: 'block', fontSize: 10.5 }}>{a.mobile}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
