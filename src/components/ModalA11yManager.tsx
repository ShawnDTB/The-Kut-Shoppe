import { useEffect } from 'react';

const focusable = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function controls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.offsetParent !== null);
}

export function ModalA11yManager() {
  useEffect(() => {
    let dialog: HTMLElement | null = null;
    let trigger: HTMLElement | null = null;
    let inerted: HTMLElement[] = [];

    const restore = () => {
      inerted.forEach((item) => item.removeAttribute('inert'));
      inerted = [];
      if (trigger?.isConnected) trigger.focus();
      trigger = null;
      dialog = null;
    };

    const sync = () => {
      const next = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      if (next === dialog) return;
      if (dialog) restore();
      if (!next) return;

      dialog = next;
      trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      let root = next;
      while (root.parentElement && root.parentElement !== document.body) root = root.parentElement;
      inerted = Array.from(document.body.children).filter((item): item is HTMLElement => (
        item instanceof HTMLElement && item !== root && !item.hasAttribute('inert')
      ));
      inerted.forEach((item) => item.setAttribute('inert', ''));
      window.requestAnimationFrame(() => (controls(next)[0] ?? next).focus());
    };

    const trap = (event: KeyboardEvent) => {
      if (!dialog || event.key !== 'Tab') return;
      const items = controls(dialog);
      if (!items.length) return event.preventDefault();
      const first = items[0]!;
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('keydown', trap, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener('keydown', trap, true);
      if (dialog) restore();
    };
  }, []);
  return null;
}
