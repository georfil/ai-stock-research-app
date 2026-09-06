import { useState } from 'react';
import { AuthDialog } from './AuthDialog';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useMediaQuery';

interface AuthControlProps {
  /** 'md' is the full-size treatment (~40px tall, base 14px .btn type) for
   *  the home screen's top bar, where the login button is the page's only
   *  action. 'sm' keeps the quieter nav-bar sizing everywhere else. */
  size?: 'sm' | 'md';
}

/** The username/logout-or-log-in cluster, shared by the nav bar and the home screen's own corner control. */
export function AuthControl({ size = 'sm' }: AuthControlProps) {
  const auth = useAuth();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const isMd = size === 'md';
  // On mobile this is the nav's single account control, so it has to be one
  // element at a full tap target — the username label is dropped rather than
  // allowed to push the row into a second line.
  const buttonStyle = isMobile
    ? { fontSize: 13, minHeight: 'var(--tap-min)', padding: '0 14px' }
    : isMd
      ? { padding: '11px 18px' }
      : { fontSize: 12.5 };

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: isMd ? 14 : 10 }}>
      {auth.status === 'authed' && (
        <>
          {!isMobile && (
            <span style={{ fontSize: isMd ? 14 : 13, color: 'var(--color-neutral-400)' }}>{auth.username}</span>
          )}
          <button className="btn btn-secondary" style={buttonStyle} onClick={auth.logout}>
            Log out
          </button>
        </>
      )}
      {auth.status === 'anon' && (
        <button className="btn btn-primary" style={buttonStyle} onClick={() => setDialogOpen(true)}>
          Log in
        </button>
      )}
      {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
