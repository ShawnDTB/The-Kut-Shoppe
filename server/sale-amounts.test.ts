import { describe, expect, it } from 'vitest';
import { saleAmounts } from './sale-amounts';
const line = (id: string, price: number, quantity = 1) => ({ id, kind: 'merchandise' as const, description: id, unitPriceCents: price, quantity, professionalName: null, professionalId: null });
describe('sale amount allocation', () => {
  it('allocates every discount cent deterministically, including equal remainders', () => {
    const lines = [line('c', 100), line('a', 100), line('b', 100)];
    const amounts = saleAmounts(lines, 2, 18, 500);
    expect(amounts).toMatchObject({ subtotalCents: 300, discountCents: 2, netCents: 298, totalCents: 816 });
    expect(Object.fromEntries(amounts.lines.map(value => [value.id, value.discountCents]))).toEqual({ a: 1, b: 1, c: 0 });
    expect(Object.fromEntries(saleAmounts([...lines].reverse(), 2, 18, 500).lines.map(value => [value.id, value.discountCents]))).toEqual({ a: 1, b: 1, c: 0 });
  });
  it('distinguishes unknown charges, explicit zero and a fully discounted sale', () => {
    expect(saleAmounts([line('a', 1500, 2)], 0, null, 0)).toMatchObject({ taxCents: null, shippingCents: 0, netCents: 3000, totalCents: null });
    expect(saleAmounts([line('a', 1500)], 0, 0, null).totalCents).toBeNull();
    expect(saleAmounts([line('a', 1500)], 1500, 0, 0)).toMatchObject({ totalCents: 0, lines: [{ grossCents: 1500, discountCents: 1500, netCents: 0 }] });
    expect(saleAmounts([line('free', 0)], 0, 0, 0).totalCents).toBe(0);
  });
  it('preserves exact amounts near the supported limit', () => {
    const values = saleAmounts([line('a', 49_999_999), line('b', 50_000_001)], 99_999_999, 0, 0);
    expect(values.lines.reduce((sum, value) => sum + value.discountCents, 0)).toBe(99_999_999);
    expect(values.lines.reduce((sum, value) => sum + value.netCents, 0)).toBe(1);
    expect(values.lines.every(value => value.discountCents <= value.grossCents)).toBe(true);
  });
  it('rejects malformed, duplicate, negative and excessive totals', () => {
    for (const invalid of [-1, 0.5, NaN, Infinity, 100_000_001]) expect(() => saleAmounts([line('a', invalid)], 0, 0, 0)).toThrow();
    expect(() => saleAmounts([line('a', 1)], 2, 0, 0)).toThrow();
    expect(() => saleAmounts([line('a', 1, 0)], 0, 0, 0)).toThrow();
    expect(() => saleAmounts([line('a', 1), line('a', 2)], 0, 0, 0)).toThrow();
    expect(() => saleAmounts([line('a', 100_000_000)], 0, 1, null)).toThrow();
    expect(() => saleAmounts([], 0, 0, 0)).toThrow();
  });
});
