import { useState } from 'react';
import { AuthDialog } from './AuthDialog';
import { useAuth } from '../hooks/useAuth';

/** The username/logout-or-log-in cluster, shared by the nav bar and the home screen's own corner control. */
export function AuthControl() {
  const auth = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {auth.status === 'authed' && (
        <>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-400)' }}>{auth.username}</span>
          <button className="btn btn-secondary" style={{ fontSize: 12.5 }} onClick={auth.logout}>
            Log out
          </button>
        </>
      )}
      {auth.status === 'anon' && (
        <button className="btn btn-primary" style={{ fontSize: 12.5 }} onClick={() => setDialogOpen(true)}>
          Log in
        </button>
      )}
      {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
