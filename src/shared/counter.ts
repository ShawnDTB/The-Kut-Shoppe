import type { SaleEstimate } from './sales';
export interface FinalizedSale {
 id: string; estimateId: string; createdAt: string; estimate: SaleEstimate;
 totalCents: number; state: 'unpaid' | 'paid' | 'refunded' | 'void';
 receipts: CashReceipt[];
}
export interface CashReceipt {
 id: string; saleId: string; createdAt: string; kind: 'payment' | 'refund' | 'void';
 sale: SaleEstimate; amountCents: number; tipCents: number;
 cashReceivedCents: number; changeCents: number; reason: string;
 originalReceiptId: string | null;
 sellerName: string; sellerAddress: string;
}
export interface CounterPage { items: FinalizedSale[]; nextCursor: string | null }
export interface ReceiptPage { items: CashReceipt[]; nextCursor: string | null }
