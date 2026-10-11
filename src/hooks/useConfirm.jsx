import { useCallback, useState } from 'react';
import ConfirmDialog from '../components/feedback/ConfirmDialog';

/**
 * Promise-based confirmation for destructive actions.
 *
 *   const [confirm, confirmUi] = useConfirm();
 *   if (await confirm({ title: 'Delete batch?', tone: 'danger' })) …
 *   return <>{…}{confirmUi}</>;
 */
export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setState({ ...options, resolve });
  }), []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  const ui = state ? (
    <ConfirmDialog
      {...state}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  ) : null;

  return [confirm, ui];
}

export default useConfirm;
