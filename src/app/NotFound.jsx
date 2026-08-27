import { Link } from 'react-router-dom';
import Icon from '../components/feedback/Icon';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { session, home } = useAuth();
  return (
    <div className="state" style={{ minHeight: '70vh' }}>
      <div className="state__icon"><Icon name="search" size={22} /></div>
      <p className="state__title">Page not found</p>
      <p className="state__text">
        That address doesn’t exist in this portal — it may have moved, or you may not have access to it.
      </p>
      <Link to={session ? home : '/login'} className="btn btn--primary">
        {session ? 'Back to your dashboard' : 'Go to sign in'}
      </Link>
    </div>
  );
}
