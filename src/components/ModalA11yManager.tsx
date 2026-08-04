import { useEffect } from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type InertSnapshot = {
  element: HTMLElement;
  hadInert: boolean;
  ariaHidden: string | null;
};

function isVisible(element: HTMLElement) {
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && !element.hasAttribute('hidden');
}

function focusableElements(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(isVisible);
}

export function ModalA11yManager() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let restoreFocus: HTMLElement | null = null;
    let inerted: InertSnapshot[] = [];
    let scheduled = 0;

    const restoreBackground = () => {
      for (const snapshot of inerted) {
        if (!snapshot.hadInert) snapshot.element.removeAttribute('inert');
        if (snapshot.ariaHidden === null) snapshot.element.removeAttribute('aria-hidden');
        else snapshot.element.setAttribute('aria-hidden', snapshot.ariaHidden);
      }
      inerted = [];
    };

    const deactivate = () => {
      restoreBackground();
      const target = restoreFocus;
      activeDialog = null;
      restoreFocus = null;
      if (target?.isConnected) window.requestAnimationFrame(() => target.focus());
    };

    const activate = (dialog: HTMLElement) => {
      activeDialog = dialog;
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

      let dialogRoot: HTMLElement = dialog;
      while (dialogRoot.parentElement && dialogRoot.parentElement !== document.body) dialogRoot = dialogRoot.parentElement;

      inerted = Array.from(document.body.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child !== dialogRoot)
        .map((element) => ({
          element,
          hadInert: element.hasAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden'),
        }));

      for (const snapshot of inerted) {
        snapshot.element.setAttribute('inert', '');
        snapshot.element.setAttribute('aria-hidden', 'true');
      }

      window.requestAnimationFrame(() => {
        if (!activeDialog) return;
        if (activeDialog.contains(document.activeElement)) return;
        const focusable = focusableElements(activeDialog);
        (focusable[0] ?? activeDialog).focus();
      });
    };

    const findDialog = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
      .filter(isVisible)
      .at(-1) ?? null;

    const sync = () => {
      scheduled = 0;
      const next = findDialog();
      if (next === activeDialog) return;
      if (activeDialog) deactivate();
      if (next) activate(next);
    };

    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = window.requestAnimationFrame(sync);
    };

    const trapFocus = (event: KeyboardEvent) => {
      if (!activeDialog || event.key !== 'Tab') return;
      const focusable = focusableElements(activeDialog);
      if (!focusable.length) {
        event.preventDefault();
        activeDialog.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
    });
    document.addEventListener('keydown', trapFocus, true);
    sync();

    return () => {
      if (scheduled) window.cancelAnimationFrame(scheduled);
      observer.disconnect();
      document.removeEventListener('keydown', trapFocus, true);
      restoreBackground();
    };
  }, []);

  return null;
}
