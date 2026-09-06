import { useState } from 'react';
import { AuthDialog } from '../../components/AuthDialog';

/** Only rendered while anon (the parent conditions on auth status), so the login button here needs no branching of its own. */
export function SignInPrompt() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
      <p style={{ margin: 0, fontSize: 14.5, color: 'var(--color-neutral-500)' }}>Sign in to keep a watchlist here.</p>
      <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
        Log in
      </button>
      {dialogOpen && <AuthDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
