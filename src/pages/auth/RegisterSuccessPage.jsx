import { Link } from 'react-router-dom';
import Icon from '../../components/feedback/Icon';

/** Mirrors RegistrationSuccessScreen: the three stages that follow an application. */
const STAGES = [
  ['file', 'Application review', 'Our team verifies your drug license, GST details and store information.'],
  ['phone', 'Verification call', 'We may call the number you registered to confirm a few details.'],
  ['check', 'Account activation', 'Once approved, your login credentials arrive by email and you can start ordering.'],
];

export default function RegisterSuccessPage() {
  return (
    <div className="auth__form text-center">
      <span
        className="state__icon"
        style={{ width: 62, height: 62, margin: '0 auto var(--sp-5)', borderRadius: 20 }}
      >
        <Icon name="check" size={28} strokeWidth={2.6} />
      </span>

      <h1 style={{ fontSize: 'var(--fs-2xl)' }}>Registration submitted</h1>
      <p className="page__sub" style={{ margin: '6px auto var(--sp-6)' }}>
        Thanks — your application is with the VS Arogya admin team. Here is what happens next.
      </p>

      <div className="stack gap-3" style={{ textAlign: 'left' }}>
        {STAGES.map(([icon, title, text], i) => (
          <div className="card card--pad row gap-4" key={title}>
            <span className="stat__icon" style={{ width: 34, height: 34 }}><Icon name={icon} size={16} /></span>
            <div>
              <p style={{ fontWeight: 700 }}>{i + 1}. {title}</p>
              <p className="subtle" style={{ fontSize: 'var(--fs-sm)' }}>{text}</p>
            </div>
          </div>
        ))}
      </div>

      <Link to="/login" className="btn btn--primary btn--lg btn--block" style={{ marginTop: 'var(--sp-6)' }}>
        Back to sign in
      </Link>
    </div>
  );
}
