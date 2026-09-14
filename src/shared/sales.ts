export interface SaleLine {
  id: string;
  kind: 'service' | 'merchandise';
  description: string;
  quantity: number;
  unitPriceCents: number;
  professionalName: string | null;
  professionalId: string | null;
  grossCents: number;
  discountCents: number;
  netCents: number;
}
export interface SaleAmounts {
  lines: SaleLine[];
  subtotalCents: number;
  discountCents: number;
  netCents: number;
  taxCents: number | null;
  shippingCents: number | null;
  totalCents: number | null;
}
export interface SaleEstimate extends SaleAmounts {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  customerName: string;
  appointmentId: string | null;
  orderId: string | null;
  appointmentTime: string | null;
  timeZone: string;
  currency: 'USD';
  discountReason: string;
  chargeNote: string;
}
export interface EstimateInput {
  appointmentId: string | null;
  orderId: string | null;
  discountCents: number;
  discountReason: string;
  taxCents: number | null;
  shippingCents: number | null;
  chargeNote: string;
}
export interface EstimatePreview { estimate: SaleEstimate; token: string; expiresAt: string }
export interface EstimatePage { items: SaleEstimate[]; nextCursor: string | null }
export interface SaleSource {
  id: string; kind: 'appointment' | 'order'; customerName: string; description: string; status: string;
}
export interface SaleSourcePage { items: SaleSource[]; nextCursor: string | null }
