import { createHash } from 'node:crypto';
import type { CustomerAccount, CustomerAppointmentDetail, CustomerOrderDetail } from '../src/shared/customer';
import { ApiError } from './types';
import type { SaleEstimate } from '../src/shared/sales';

const escape = (value: string | number) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const time = (value: string | null, timeZone = 'America/New_York') => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'full', timeStyle: 'short' }).format(new Date(value)) : 'Time not set';
const styles = 'body{font:16px/1.6 Arial,sans-serif;color:#161616;background:white;max-width:760px;margin:40px auto;padding:24px}h1{font:32px/1.2 Georgia,serif}h2{font-size:20px}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:12px 8px;border-bottom:1px solid #aaa;overflow-wrap:anywhere}p{overflow-wrap:anywhere}.notice{padding:16px;border:1px solid #666}small{font-size:13px}@media print{body{margin:0;padding:0}tr{break-inside:avoid}h1,h2{break-after:avoid}}';
export const documentPolicy = `default-src 'none'; style-src 'sha256-${createHash('sha256').update(styles).digest('base64')}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox`;
function document(title: string, account: CustomerAccount, content: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${escape(documentPolicy)}"><title>${escape(title)} | The Kut Shoppe</title><style>${styles}</style></head><body><header><p>The Kut Shoppe · 518 Main Street, Stroudsburg, PA 18360</p><h1>${escape(title)}</h1><p>Prepared for ${escape(account.profile.name)}</p></header>${content}<footer><p><small>Generated ${escape(time(new Date().toISOString()))} (America/New_York). This downloaded copy does not update automatically. Check your account for the latest status. Use your browser’s Print command to print or save as PDF.</small></p></footer></body></html>`;
}
export function appointmentDocument(account: CustomerAccount, appointment: CustomerAppointmentDetail) {
  const confirmed = appointment.status === 'confirmed';
  const title = confirmed ? 'Appointment confirmation' : appointment.status === 'requested' || appointment.status === 'waitlisted' ? 'Appointment request acknowledgement' : 'Appointment record';
  const address = appointment.location.address;
  return document(title, account, `<p>Reference: ${escape(appointment.id)}</p><p><strong>Status: ${escape(appointment.status.replaceAll('_', ' '))}</strong></p>
    <p class="notice">${confirmed ? 'Your appointment is confirmed at the time shown below.' : 'This document does not confirm an upcoming visit. Refer to the status above.'} This is not a payment receipt.</p>
    ${appointment.cancellationState === 'pending' ? '<p class="notice">Cancellation is awaiting approval. The appointment remains confirmed.</p>' : ''}
    <table><caption>Current appointment details</caption><tbody>${[['Service', appointment.serviceName], ['Professional', appointment.barberName ?? 'To be assigned'], ['Start', time(appointment.startsAt, appointment.location.timeZone)], ['End', time(appointment.endsAt, appointment.location.timeZone)], ['Time zone', appointment.location.timeZone], ['Location', appointment.location.name], ['Address', [address.line1, address.line2, address.city, address.state, address.postalCode].filter(Boolean).join(', ')], ['Recorded service price', money(appointment.priceCents)], ['Last updated', time(appointment.updatedAt, appointment.location.timeZone)]].map(([label, value]) => `<tr><th scope="row">${escape(label!)}</th><td>${escape(value!)}</td></tr>`).join('')}</tbody></table>
    <p>Any pending replacement time remains a proposal until accepted. This document shows the current appointment time, not a proposed replacement.</p>`);
}
export function orderDocument(account: CustomerAccount, order: CustomerOrderDetail) {
  if (!order.itemsComplete) throw new ApiError(409, 'Contact the shop for a complete document for this order. A partial item list cannot be issued.');
  return document('Order acknowledgement', account, `<p>Reference: ${escape(order.id)}</p><p><strong>Status: ${escape(order.status.replaceAll('_', ' '))}</strong></p>
    <p class="notice">This acknowledges your order and recorded amounts. It is not proof of payment or a tax invoice. Check with the shop before collecting an order or making payment.</p>
    <p>Fulfillment: ${escape(order.fulfillment)} · Placed: ${escape(time(order.createdAt))}</p>
    <table><caption>Recorded order items</caption><thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Total</th></tr></thead><tbody>${order.items.map(item => `<tr><td>${escape(item.productName)}<br>${escape(item.variantName)}</td><td>${escape(item.quantity)}</td><td>${escape(money(item.unitPriceCents))}</td><td>${escape(money(item.quantity * item.unitPriceCents))}</td></tr>`).join('')}</tbody></table>
    <table><caption>Recorded amounts</caption><tbody>${[['Subtotal', order.subtotalCents], ['Shipping', order.shippingCents], ['Tax', order.taxCents], ['Total', order.totalCents]].map(([label, amount]) => `<tr><th scope="row">${escape(label!)}</th><td>${escape(money(Number(amount)))}</td></tr>`).join('')}</tbody></table>
    ${order.fulfillment === 'shipping' ? '<p>Shipping charges and any outstanding payment arrangements must be confirmed with the shop.</p>' : ''}`);
}

export function estimateDocument(estimate: SaleEstimate) {
  const amount = (value: number | null) => value === null ? 'Not yet determined' : money(value);
  const facts = [['Item subtotal', estimate.subtotalCents], ['Discount', estimate.discountCents], ['Items after discount', estimate.netCents], ['Tax', estimate.taxCents], ['Shipping', estimate.shippingCents], ['Estimated total', estimate.totalCents]] as const;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${escape(documentPolicy)}"><title>Sale estimate | The Kut Shoppe</title><style>${styles}</style></head><body>
    <header><p>The Kut Shoppe</p><h1>Sale estimate</h1><p>Prepared for ${escape(estimate.customerName)}</p><p>Reference: ${escape(estimate.id)}<br>Issued: ${escape(time(estimate.createdAt, estimate.timeZone))} (${escape(estimate.timeZone)})</p></header>
    <p class="notice">This is an estimate, not an invoice or payment receipt. It does not request or record payment, reserve stock or confirm an appointment. Any unresolved charges must be confirmed with the shop.</p>
    ${estimate.appointmentId ? `<p>Appointment: ${escape(estimate.appointmentId)}<br>Recorded time: ${escape(time(estimate.appointmentTime, estimate.timeZone))}</p>` : ''}
    ${estimate.orderId ? `<p>Order: ${escape(estimate.orderId)}</p>` : ''}
    <table><caption>Items at issue</caption><thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Discount</th><th scope="col">Net</th></tr></thead><tbody>${estimate.lines.map(line => `<tr><td>${escape(line.description)}${line.professionalName ? `<br>${escape(line.professionalName)}` : ''}</td><td>${line.quantity}</td><td>${money(line.unitPriceCents)}</td><td>${money(line.discountCents)}</td><td>${money(line.netCents)}</td></tr>`).join('')}</tbody></table>
    <table><caption>Estimated amounts (USD)</caption><tbody>${facts.map(([label, value]) => `<tr><th scope="row">${label}</th><td>${amount(value)}</td></tr>`).join('')}</tbody></table>
    ${estimate.discountReason ? `<p>Discount: ${escape(estimate.discountReason)}</p>` : ''}${estimate.chargeNote ? `<p>Tax/shipping explanation: ${escape(estimate.chargeNote)}</p>` : ''}
    <footer><p>This is a saved copy of the amounts and details at issue. Later appointment, product and account changes do not update this copy. Confirm current arrangements with the shop. Use your browser’s Print command to print or save as PDF.</p></footer></body></html>`;
}

export function cashReceiptDocument(receipt: import('../src/shared/counter').CashReceipt) {
  const title = receipt.kind === 'payment' ? 'Cash payment receipt' : receipt.kind === 'refund' ? 'Cash refund receipt' : 'Sale void record';
  const sale = receipt.sale;
  const rows = [['Item subtotal', sale.subtotalCents], ['Discount', sale.discountCents], ['Tax', sale.taxCents ?? 0], ['Shipping', sale.shippingCents ?? 0], ['Sale total', sale.totalCents ?? 0], ['Tip', receipt.tipCents], [receipt.kind === 'refund' ? 'Cash refunded' : 'Amount paid', receipt.amountCents],
    ...(receipt.kind === 'payment' ? [['Cash received', receipt.cashReceivedCents], ['Change given', receipt.changeCents]] : [])] as Array<[string,number]>;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta http-equiv="Content-Security-Policy" content="${escape(documentPolicy)}"><title>${title} | ${escape(receipt.sellerName)}</title><style>${styles}</style></head><body>
    <header><p>${escape(receipt.sellerName)} · ${escape(receipt.sellerAddress)}</p><h1>${title}</h1><p>For ${escape(sale.customerName)}</p></header>
    <p>Receipt: ${escape(receipt.id)}<br>Sale: ${escape(receipt.saleId)}<br>Recorded: ${escape(time(receipt.createdAt,sale.timeZone))} (${escape(sale.timeZone)})</p>
    <p class="notice">${receipt.kind === 'payment' ? 'The shop recorded receipt of the cash shown below. Fulfillment and appointment status remain separate.' : receipt.kind === 'refund' ? 'The shop recorded a full cash refund, including the original tip. This does not automatically return merchandise to inventory.' : 'This unpaid sale was voided. No payment or refund was recorded.'}</p>
    ${receipt.originalReceiptId ? `<p>Original payment receipt: ${escape(receipt.originalReceiptId)}</p>` : ''}
    ${sale.appointmentId ? `<p>Appointment: ${escape(sale.appointmentId)}</p>` : ''}${sale.orderId ? `<p>Order: ${escape(sale.orderId)}</p>` : ''}
    <table><caption>Items at sale</caption><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Discount</th><th>Net</th></tr></thead><tbody>${sale.lines.map(line=>`<tr><td>${escape(line.description)}${line.professionalName?`<br>${escape(line.professionalName)}`:''}</td><td>${line.quantity}</td><td>${money(line.unitPriceCents)}</td><td>${money(line.discountCents)}</td><td>${money(line.netCents)}</td></tr>`).join('')}</tbody></table>
    <table><caption>USD amounts</caption><tbody>${rows.map(([label,value])=>`<tr><th scope="row">${label}</th><td>${money(value)}</td></tr>`).join('')}</tbody></table>
    ${sale.discountReason?`<p>Discount: ${escape(sale.discountReason)}</p>`:''}${sale.chargeNote?`<p>Tax/shipping explanation: ${escape(sale.chargeNote)}</p>`:''}${receipt.reason?`<p>Reason: ${escape(receipt.reason)}</p>`:''}
    <footer><p>This is the saved record at issue. Subsequent refunds have separate receipts. Use Print to print or save as PDF; check your account or contact the shop for later activity.</p></footer></body></html>`;
}
