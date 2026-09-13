import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MobileNavigation } from './Layout';

let element: HTMLDivElement; let root: Root;
let desktop: boolean;
const mediaListeners = new Set<() => void>();
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
const showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
const closeModal = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  desktop = false; mediaListeners.clear(); showModal.mockClear(); closeModal.mockClear();
  // jsdom has no native modal/top-layer implementation. These mocks verify the
  // lifecycle contract; actual focus containment still needs browser acceptance.
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: showModal });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: closeModal });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return desktop; }, addEventListener: (_: string, fn: () => void) => mediaListeners.add(fn), removeEventListener: (_: string, fn: () => void) => mediaListeners.delete(fn) })));
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(640);
  element = document.createElement('div'); document.body.append(element); root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount()); element.remove();
  for (const [name, descriptor] of [['showModal', originalShow], ['close', originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
  document.body.removeAttribute('style'); document.documentElement.removeAttribute('style'); vi.unstubAllGlobals();
});
async function openMenu() {
  await act(async () => root.render(createElement(MobileNavigation, { currentPath: '/shop', account: null, cartCount: 2 })));
  const trigger = element.querySelector('button')!;
  await act(async () => trigger.click());
  return { trigger, dialog: document.querySelector('dialog')! };
}

it('opens a native modal at the close control, then restores focus and page styles on Escape cancellation', async () => {
  document.body.style.cssText = 'position: relative; inset: 3px; overflow: auto';
  document.documentElement.style.overflow = 'scroll';
  const originalStyles = document.body.style.cssText;
  const { trigger, dialog } = await openMenu();
  expect(showModal).toHaveBeenCalledOnce(); expect(dialog.open).toBe(true);
  expect(document.activeElement).toBe(dialog.querySelector('button[aria-label="Close navigation"]'));
  expect(document.body.style.position).toBe('fixed'); expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(dialog.querySelector('[aria-current="page"]')?.getAttribute('href')).toBe('/shop');
  expect(dialog.querySelector('a[href="/book"]')).not.toBeNull(); expect(dialog.textContent).toContain('Cart 2');
  await act(async () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })));
  expect(document.querySelector('dialog')).toBeNull(); expect(closeModal).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(trigger); expect(trigger.getAttribute('aria-expanded')).toBe('false');
  expect(document.body.style.cssText).toBe(originalStyles); expect(document.documentElement.style.overflow).toBe('scroll');
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 640, behavior: 'instant' });
});

it('keeps the menu open through mobile resizes and closes at the same desktop breakpoint as the header', async () => {
  const { dialog } = await openMenu();
  expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1041px)');
  await act(async () => window.dispatchEvent(new Event('resize'))); expect(dialog.open).toBe(true);
  desktop = true;
  await act(async () => mediaListeners.forEach(fn => fn()));
  expect(document.querySelector('dialog')).toBeNull(); expect(document.body.style.position).toBe('');
});

it('ignores panel clicks, dismisses on the outside surface, and reopens cleanly', async () => {
  const { trigger, dialog } = await openMenu();
  await act(async () => dialog.querySelector('nav')!.click()); expect(dialog.open).toBe(true);
  await act(async () => dialog.click()); expect(document.querySelector('dialog')).toBeNull();
  await act(async () => trigger.click()); expect(showModal).toHaveBeenCalledTimes(2);
  await act(async () => document.querySelector<HTMLButtonElement>('dialog button')!.click());
  expect(document.activeElement).toBe(trigger);
});

it('releases the scroll lock and modal on unmount', async () => {
  await openMenu(); await act(async () => root.render(null));
  expect(document.body.style.overflow).toBe(''); expect(document.body.style.inset).toBe('');
  expect(document.querySelector('dialog')).toBeNull(); expect(mediaListeners.size).toBe(0);
});
