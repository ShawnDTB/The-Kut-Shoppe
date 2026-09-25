export interface RegisterTotals {
  openingCents: number; paymentsCents: number; refundsCents: number;
  paidInCents: number; paidOutCents: number; depositsCents: number;
  expectedCents: number; entryCount: number;
}
export interface RegisterClose {
  id: string; openedAt: string; closedAt: string; totals: RegisterTotals;
  countedCents: number; varianceCents: number; reason: string;
}
export interface RegisterSession {
  id: string; openedAt: string; totals: RegisterTotals;
  close: RegisterClose | null; closeToken: string | null;
}
export interface RegisterPage { open: RegisterSession | null; items: RegisterSession[]; nextCursor: string | null }
export interface RegisterEntry {
  id: string; kind: 'payment' | 'refund' | 'paid_in' | 'paid_out' | 'deposit';
  amountCents: number; reason: string; createdAt: string; receiptId: string | null; saleId: string | null;
}
export interface RegisterEntries { items: RegisterEntry[]; nextCursor: string | null }
