import Icon from './Icon';
import Button from '../common/Button';

/**
 * The single error state. `error` is an ApiError from the service layer, whose
 * message is always safe to show a user.
 */
export default function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  const message = error?.message || 'The request could not be completed.';
  const notImplemented = error?.code === 'NOT_IMPLEMENTED';

  return (
    <div className="state state--danger">
      <div className="state__icon"><Icon name={notImplemented ? 'info' : 'alert'} size={22} /></div>
      <p className="state__title">{notImplemented ? 'Not available yet' : title}</p>
      <p className="state__text">{message}</p>
      {onRetry && !notImplemented && (
        <Button variant="secondary" icon="refresh" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}
