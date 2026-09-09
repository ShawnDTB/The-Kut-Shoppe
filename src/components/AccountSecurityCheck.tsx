import { useEffect, useRef, useState } from 'react';

interface Turnstile {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(widget: string): void;
}
declare global { interface Window { turnstile?: Turnstile } }
let scriptReady: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptReady) scriptReady = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptReady = null; script.remove(); reject(new Error('Security check could not load.')); };
    document.head.append(script);
  });
  return scriptReady;
}
export function AccountSecurityCheck({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let widget: string | undefined;
    void loadScript().then(() => {
      if (disposed || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, { sitekey: siteKey, action: 'account', theme: 'dark', size: 'flexible',
        callback: onToken, 'expired-callback': () => onToken(''),
        'error-callback': () => { onToken(''); setError('The security check could not finish. Refresh this page to retry.'); } });
    }).catch(() => { if (!disposed) setError('The security check could not load. Check your connection and refresh.'); });
    return () => { disposed = true; if (widget) window.turnstile?.remove(widget); };
  }, [siteKey, onToken]);
  return <div className="account-security-check"><div ref={container} />{error ? <p role="alert" className="form-error">{error}</p> : null}</div>;
}
