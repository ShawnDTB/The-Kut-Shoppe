import { useEffect, useMemo, useState } from 'react';
import { readPlatformAccounts } from '../data/auth-v2';
import { getCustomerProfileV5 } from '../data/account-profile-v5';
import {
  formatMoney,
  readOrders,
  readProducts,
  saveOrder,
  subscribeToStorefrontChanges,
  updateOrder,
  type OrderStatus,
  type StoreOrder,
} from '../data/storefront';
import {
  getOrderOperationsV5,
  saveOrderOperationsV5,
  subscribeToOrderOperationsV5,
  type PaymentStatusV5,
} from '../data/order-operations-v5';

const terminalStatuses = new Set<OrderStatus>(['completed', 'declined', 'cancelled']);
const pickupFlow: OrderStatus[] = ['submitted', 'accepted', 'preparing', 'ready-for-pickup', 'completed'];
const shippingFlow: OrderStatus[] = ['payment-required', 'accepted', 'preparing', 'shipped', 'completed'];

function nextStatus(order: StoreOrder) {
  const flow = order.fulfillment === 'pickup' ? pickupFlow : shippingFlow;
  const index = flow.indexOf(order.status);
  return index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
}

function statusLabel(status: OrderStatus) {
  return status.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function OrderCardV5({ order, onUpdated }: { order: StoreOrder; onUpdated: () => void }) {
  const operations = getOrderOperationsV5(order.id);
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const [tracking, setTracking] = useState(order.trackingNumber);
  const next = nextStatus(order);
  const locked = operations.locked || terminalStatuses.has(order.status);
  const canAdvance = Boolean(next) && !locked && (next !== 'shipped' || tracking.trim());

  const applyStatus = (status: OrderStatus) => {
    const updated = updateOrder(order.id, { status, trackingNumber: tracking, ownerActionRequired: false });
    if (!updated) return;
    if (terminalStatuses.has(status)) saveOrderOperationsV5({ ...operations, locked: true });
    setConfirming(null);
    onUpdated();
  };

  const updatePayment = (paymentStatus: PaymentStatusV5) => {
    saveOrderOperationsV5({ ...operations, paymentStatus });
    onUpdated();
  };

  return <article className={`order-v5-card order-v5-${order.fulfillment}`}><header><div><p className="eyebrow">{operations.channel === 'in-person' ? 'In-person sale' : order.fulfillment === 'pickup' ? 'Pickup priority' : 'Shipping queue'}</p><h2>{order.customer.name}</h2><p>{order.customer.phone || order.customer.email}</p></div><div><span className={`order-status order-status-${order.status}`}>{statusLabel(order.status)}</span><span className={`order-payment order-payment-${operations.paymentStatus}`}>{operations.paymentStatus}</span></div></header><div className="order-admin-items">{order.items.map((item) => <div key={`${item.productId}-${item.variantId}`}><span>{item.quantity} × {item.name}<small>{item.variantName} · {item.sku}</small></span><strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong></div>)}</div><dl className="order-v5-meta"><div><dt>Total</dt><dd>{formatMoney(order.totalCents)}</dd></div><div><dt>Received</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd></div><div><dt>Channel</dt><dd>{operations.channel}</dd></div><div><dt>Payment</dt><dd>{operations.paymentStatus}</dd></div></dl>{order.fulfillment === 'shipping' && !locked ? <label>Tracking number<input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Required before Mark shipped" /></label> : null}<div className="order-v5-actions">{operations.paymentStatus !== 'paid' && !locked ? <button type="button" onClick={() => updatePayment('paid')}>Record payment collected</button> : null}{next && !locked ? <>{confirming === next ? <div className="order-v5-confirm"><span>Move this order to <strong>{statusLabel(next)}</strong>?</span><button className="button" type="button" disabled={!canAdvance} onClick={() => applyStatus(next)}>Confirm</button><button className="button button-secondary" type="button" onClick={() => setConfirming(null)}>Keep current status</button></div> : <button className="button" type="button" disabled={!canAdvance} onClick={() => setConfirming(next)}>{statusLabel(next)}</button>}</> : null}{!locked && ['submitted', 'payment-required'].includes(order.status) ? <button className="text-button danger" type="button" onClick={() => setConfirming('declined')}>Decline</button> : null}{confirming === 'declined' ? <div className="order-v5-confirm"><span>Decline this order and release reserved inventory?</span><button className="button danger" type="button" onClick={() => applyStatus('declined')}>Confirm decline</button><button className="button button-secondary" type="button" onClick={() => setConfirming(null)}>Keep order</button></div> : null}{locked ? <span className="order-v5-locked">Final status locked</span> : null}</div></article>;
}

function InPersonCheckoutV5({ onCreated }: { onCreated: () => void }) {
  const products = readProducts().filter((product) => product.status === 'published');
  const [lookup, setLookup] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const accounts = readPlatformAccounts();
  const matchedAccount = accounts.find((account) => {
    const profile = getCustomerProfileV5(account);
    const digits = lookup.replace(/\D/g, '');
    return Boolean(digits && profile?.phone.endsWith(digits)) || Boolean(lookup.includes('@') && account.email === lookup.trim().toLowerCase());
  }) ?? null;
  const options = products.flatMap((product) => product.variants.filter((variant) => variant.active && variant.stockOnHand > 0).map((variant) => ({ product, variant, key: `${product.id}:${variant.id}` })));
  const line = options.find((option) => option.key === selected);

  const createSale = () => {
    if (!line || (!matchedAccount && !email.trim())) { setMessage('Choose a product and identify the customer by phone or email.'); return; }
    const now = new Date().toISOString();
    const customerEmail = matchedAccount?.email ?? email.trim().toLowerCase();
    const customerProfile = matchedAccount ? getCustomerProfileV5(matchedAccount) : null;
    const order: StoreOrder = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `pos-${crypto.randomUUID()}` : `pos-${Date.now()}`,
      items: [{ productId: line.product.id, variantId: line.variant.id, name: line.product.name, variantName: line.variant.name, sku: line.variant.sku, quantity, unitPriceCents: line.variant.priceCents }],
      subtotalCents: line.variant.priceCents * quantity,
      shippingCents: 0,
      taxCents: 0,
      totalCents: line.variant.priceCents * quantity,
      fulfillment: 'pickup',
      customer: { name: matchedAccount?.name ?? 'In-store guest', email: customerEmail, phone: customerProfile?.phone ?? lookup.replace(/\D/g, '').slice(-10) },
      shippingAddress: null,
      status: 'submitted',
      ownerActionRequired: true,
      trackingNumber: '',
      internalNote: 'In-person sale created from order administration.',
      createdAt: now,
      updatedAt: now,
    };
    saveOrder(order);
    saveOrderOperationsV5({ orderId: order.id, channel: 'in-person', paymentStatus: 'unpaid', customerAccountId: matchedAccount?.id ?? null, locked: false, updatedAt: now });
    setMessage(`In-person order created for ${order.customer.name}. Record payment before completing it.`);
    setSelected(''); setQuantity(1); onCreated();
  };

  return <section className="order-v5-pos"><p className="eyebrow">In-person checkout</p><h2>Start a counter sale</h2><p>Find a customer by mobile number or email. A guest email begins the account invitation path without blocking the sale.</p><div className="order-v5-pos-grid"><label>Customer mobile or email<input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="570-555-0123 or name@example.com" /></label>{matchedAccount ? <div className="order-v5-customer-match"><strong>{matchedAccount.name}</strong><span>{matchedAccount.email}</span></div> : <label>Guest email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Required when no account is found" /></label>}<label>Product and option<select value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose inventory</option>{options.map((option) => <option value={option.key} key={option.key}>{option.product.name} · {option.variant.name} · {formatMoney(option.variant.priceCents)}</option>)}</select></label><label>Quantity<input type="number" min="1" max={line?.variant.stockOnHand ?? 1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label></div>{message ? <p className={message.startsWith('In-person') ? 'success-message' : 'form-error'} role="status">{message}</p> : null}<button className="button" type="button" onClick={createSale}>Create in-person order</button></section>;
}

export function OrderAdminV5() {
  const [orders, setOrders] = useState(() => readOrders());
  const [queue, setQueue] = useState<'pickup' | 'shipping' | 'in-person' | 'all'>('pickup');
  useEffect(() => {
    const refresh = () => setOrders(readOrders());
    const unsubscribeStore = subscribeToStorefrontChanges(refresh);
    const unsubscribeOperations = subscribeToOrderOperationsV5(refresh);
    return () => { unsubscribeStore(); unsubscribeOperations(); };
  }, []);
  const visible = useMemo(() => orders.filter((order) => {
    const operations = getOrderOperationsV5(order.id);
    if (queue === 'all') return true;
    if (queue === 'in-person') return operations.channel === 'in-person';
    return operations.channel !== 'in-person' && order.fulfillment === queue;
  }), [orders, queue]);
  const counts = { pickup: orders.filter((order) => getOrderOperationsV5(order.id).channel !== 'in-person' && order.fulfillment === 'pickup' && !terminalStatuses.has(order.status)).length, shipping: orders.filter((order) => getOrderOperationsV5(order.id).channel !== 'in-person' && order.fulfillment === 'shipping' && !terminalStatuses.has(order.status)).length, inPerson: orders.filter((order) => getOrderOperationsV5(order.id).channel === 'in-person' && !terminalStatuses.has(order.status)).length };

  return <section className="section order-admin-page order-admin-v5 platform-pattern platform-pattern-products"><div className="container route-wide"><header className="catalog-admin-header"><div><p className="eyebrow">Store operations</p><h1>Orders and in-person sales.</h1><p className="lede">Pickup stays first for face-to-face service. Shipping remains a separate background queue, and counter sales use customer lookup before payment is recorded.</p></div><a className="button button-secondary" href="/admin/products">Manage products</a></header><div className="order-v5-tabs" role="tablist" aria-label="Order queues"><button className={queue === 'pickup' ? 'is-active' : ''} type="button" onClick={() => setQueue('pickup')}>Pickup <span>{counts.pickup}</span></button><button className={queue === 'shipping' ? 'is-active' : ''} type="button" onClick={() => setQueue('shipping')}>Shipping <span>{counts.shipping}</span></button><button className={queue === 'in-person' ? 'is-active' : ''} type="button" onClick={() => setQueue('in-person')}>In-person <span>{counts.inPerson}</span></button><button className={queue === 'all' ? 'is-active' : ''} type="button" onClick={() => setQueue('all')}>All</button></div>{queue === 'in-person' ? <InPersonCheckoutV5 onCreated={() => setOrders(readOrders())} /> : null}{visible.length ? <div className="order-admin-list order-admin-list-v5">{visible.map((order) => <OrderCardV5 order={order} key={order.id} onUpdated={() => setOrders(readOrders())} />)}</div> : <div className="commerce-empty-catalog"><h2>No orders in this queue.</h2></div>}</div></section>;
}
