import { ApiError } from './types';
import type { SaleAmounts, SaleLine } from '../src/shared/sales';

export const MAX_SALE_CENTS = 100_000_000;
export function cents(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > MAX_SALE_CENTS) throw new ApiError(400, 'Amounts must be non-negative whole cents within the sale limit.');
  return Number(value);
}
type InputLine = Omit<SaleLine, 'grossCents' | 'discountCents' | 'netCents'>;
/** Stable largest-remainder allocation: line order cannot change who receives a rounding cent. */
export function saleAmounts(input: InputLine[], discount: number, tax: number | null, shipping: number | null): SaleAmounts {
  if (!input.length || input.length > 100 || new Set(input.map(line => line.id)).size !== input.length) throw new ApiError(400, 'Use one to one hundred distinct sale lines.');
  cents(discount); if (tax !== null) cents(tax); if (shipping !== null) cents(shipping);
  const lines = input.map(line => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 999) throw new ApiError(400, 'Check the sale quantity.');
    cents(line.unitPriceCents);
    return { ...line, grossCents: cents(line.unitPriceCents * line.quantity), discountCents: 0, netCents: 0 };
  });
  const subtotalCents = cents(lines.reduce((sum, line) => sum + line.grossCents, 0));
  if (discount > subtotalCents) throw new ApiError(400, 'The discount cannot exceed the item subtotal.');
  if (subtotalCents && discount) {
    const denominator = BigInt(subtotalCents);
    const remainders = lines.map(line => {
      const numerator = BigInt(line.grossCents) * BigInt(discount);
      line.discountCents = Number(numerator / denominator);
      return { line, remainder: numerator % denominator };
    }).sort((a, b) => a.remainder === b.remainder ? (a.line.id < b.line.id ? -1 : 1) : a.remainder > b.remainder ? -1 : 1);
    const remaining = discount - lines.reduce((sum, line) => sum + line.discountCents, 0);
    for (let index = 0; index < remaining; index++) remainders[index]!.line.discountCents++;
  }
  for (const line of lines) line.netCents = line.grossCents - line.discountCents;
  const netCents = subtotalCents - discount;
  // Validate even the known portion when one charge remains unresolved.
  const knownTotal = cents(netCents + (tax ?? 0) + (shipping ?? 0));
  return { lines, subtotalCents, discountCents: discount, netCents, taxCents: tax, shippingCents: shipping,
    totalCents: tax === null || shipping === null ? null : knownTotal };
}
