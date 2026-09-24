import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OrderWithdrawal } from './OrderWithdrawal';
import { accountApi } from '../data/customer-api';
vi.mock('../data/customer-api', () => ({ accountApi: vi.fn() }));
const api = vi.mocked(accountApi); let root: Root; let element: HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); api.mockReset(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.unstubAllGlobals(); });
const click = async (text: string) => { const button = [...element.querySelectorAll('button')].find(node => node.textContent === text); expect(button).toBeDefined(); await act(async () => button!.click()); };
it('requires confirmation and retries the originally reviewed version after a lost response', async () => {
  const onSaved = vi.fn(); await act(async () => root.render(createElement(OrderWithdrawal, { id: 'order', updatedAt: 'original', onSaved })));
  await click('Withdraw order request'); expect(api).not.toHaveBeenCalled(); await click('Keep order request');
  await click('Withdraw order request'); api.mockRejectedValueOnce(new Error('Connection lost')); await click('Confirm withdrawal');
  expect(element.textContent).toContain('Connection lost'); expect(onSaved).not.toHaveBeenCalled();
  api.mockResolvedValueOnce({ message: 'Request withdrawn.' }); await click('Confirm withdrawal');
  expect(api.mock.calls[0]).toEqual(['/me/orders/order/withdraw', { updatedAt: 'original' }]); expect(api.mock.calls[0]).toEqual(api.mock.calls[1]);
  expect(onSaved).toHaveBeenCalledWith('Request withdrawn.');
});
