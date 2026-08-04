import { useEffect } from 'react';

const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function ModalA11yManager() {
  useEffect(() => {
    const contain = (event: FocusEvent) => {
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (!dialog || dialog.contains(event.target as Node)) return;
      (dialog.querySelector<HTMLElement>(focusable) ?? dialog).focus();
    };
    document.addEventListener('focusin', contain, true);
    return () => document.removeEventListener('focusin', contain, true);
  }, []);
  return null;
}
