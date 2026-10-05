import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LaunchPlaceholder } from './LaunchPlaceholder';
import { readBookingIntent } from '../data/booking-intent';
let element: HTMLDivElement; let root: Root;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); window.history.replaceState({}, '', '/'); vi.unstubAllGlobals(); });
it.each([
  ['?type=loctician', 'Steph', 'glossgenius.com'],
  ['?barber=kash', 'KasH', 'booksy.com'],
  ['?barber=mr-glen', 'Mr. Glen', 'booksy.com'],
  ['?barber=kris-p', 'Kris-P', 'booksy.com'],
])('preserves the provider and professional from %s', async (query, name, host) => {
  window.history.replaceState({}, '', '/book' + query);
  await act(async () => root.render(createElement(LaunchPlaceholder, { kind: 'booking' })));
  const links = element.querySelectorAll<HTMLAnchorElement>('.launch-provider');
  expect(links).toHaveLength(1); expect(links[0]!.href).toContain(host);
  expect(element.textContent).toContain(name);
  expect(element.querySelector('a[href="/book"]')?.textContent).toBe('See all booking options');
  expect(element.querySelectorAll('h1')).toHaveLength(1); expect(element.querySelector('form')).toBeNull();
});
it('offers both providers without a preference and updates on route history changes', async () => {
  window.history.replaceState({}, '', '/book');
  await act(async () => root.render(createElement(LaunchPlaceholder, { kind: 'booking' })));
  expect(element.querySelectorAll('.launch-provider')).toHaveLength(2);
  await act(async () => { window.history.pushState({}, '', '/book?type=loctician'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(element.querySelectorAll('.launch-provider')).toHaveLength(1);
});
it('does not treat unknown handles or inherited object keys as professional names', () => {
  for (const handle of ['unknown', 'constructor', '__proto__', 'any']) expect(readBookingIntent('?barber=' + handle).professional).toBeNull();
  expect(readBookingIntent('?type=unknown').provider).toBeNull();
});
