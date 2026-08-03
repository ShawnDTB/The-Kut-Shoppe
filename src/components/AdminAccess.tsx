import { useEffect, useState, type ReactNode } from 'react';
import {
  getPlatformSessionAccount,
  hasPlatformCapability,
  subscribeToPlatformAuth,
  type PlatformAccount,
} from '../data/auth-v2';

function canManageCommerce(account: PlatformAccount | null) {
  return hasPlatformCapability(account, 'manage-products') || hasPlatformCapability(account, 'manage-orders');
}

export function AdminGuard({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PlatformAccount | null>(() => getPlatformSessionAccount());

  useEffect(() => subscribeToPlatformAuth(() => setAccount(getPlatformSessionAccount())), []);

  if (!account) {
    return (
      <section className="section staff-login-required platform-pattern platform-pattern-products">
        <div className="container narrow-container">
          <div className="staff-empty-state">
            <p className="eyebrow">Account required</p>
            <h1>Sign in to manage the Shop.</h1>
            <p>Product inventory, customer orders, and fulfillment tools are available only to approved management roles.</p>
            <a className="button" href="/account">Account / Login</a>
          </div>
        </div>
      </section>
    );
  }

  if (!canManageCommerce(account)) {
    return (
      <section className="section staff-login-required platform-pattern platform-pattern-products">
        <div className="container narrow-container">
          <div className="staff-empty-state">
            <p className="eyebrow">Management access required</p>
            <h1>This account cannot manage products or orders.</h1>
            <p>Barbers manage their own chair, services, hours, and appointment activity. Store administration remains limited to approved Manager, Owner, and Developer accounts.</p>
            <div className="commerce-inline-actions">
              <a className="button" href="/dashboard">Return to dashboard</a>
              <a className="button button-secondary" href="/shop">View customer Shop</a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return children;
}

export function AdminAccessPage() {
  return (
    <section className="section staff-login-required platform-pattern platform-pattern-account">
      <div className="container narrow-container">
        <div className="staff-empty-state">
          <p className="eyebrow">Account access moved</p>
          <h1>Use the shared Kut Shoppe login.</h1>
          <p>Owner, Developer, and Manager access is assigned from the role-based dashboard. A separate product-administration login is no longer used.</p>
          <a className="button" href="/account">Account / Login</a>
        </div>
      </div>
    </section>
  );
}
