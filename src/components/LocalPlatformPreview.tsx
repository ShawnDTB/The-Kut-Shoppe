// Loaded only by an explicit development build. This preserves the original
// design-review workflows without shipping a browser-trusted platform to users.
import { getPlatformSessionAccount } from '../data/auth-v2';
import { Booking, WalkInEntry } from './Booking';
import { StaffPlatformGate } from './StaffPlatformGate';
import { StaffOnboardingV6 } from './StaffOnboardingV6';
import { StaffSettingsV5 } from './StaffSettingsV5';
import { AccountAccessV5 } from './AccountAccessV5';
import { AccountDashboard } from './AccountDashboard';
import { CartPageV4 } from './CartPageV4';
import { StorefrontV5 } from './StorefrontV5';
import { AdminGuard } from './AdminAccess';
import { ProductAdminHubV5 } from './ProductAdminHubV5';
import { OrderAdminV5 } from './OrderAdminV5';
import { CheckoutPageV5, ProductDetailPageV5 } from './CommerceCustomerV5';

export default function LocalPlatformPreview({ path }: { path: string }) {
  const product = path.match(/^\/shop\/([^/]+)$/);
  const content = path === '/book/walk-in' ? <WalkInEntry />
    : path === '/book' ? <Booking />
    : path === '/shop' ? <StorefrontV5 />
    : product ? <ProductDetailPageV5 slug={decodeURIComponent(product[1] ?? '')} />
    : path === '/cart' ? <CartPageV4 />
    : path === '/checkout' ? <CheckoutPageV5 />
    : path === '/account' ? getPlatformSessionAccount() ? <AccountDashboard /> : <AccountAccessV5 />
    : path === '/dashboard' ? <AccountDashboard />
    : path === '/staff/setup' ? <StaffOnboardingV6 />
    : path === '/staff/settings' ? <StaffSettingsV5 />
    : path === '/admin/products' ? <AdminGuard><ProductAdminHubV5 /></AdminGuard>
    : path === '/admin/orders' ? <AdminGuard><OrderAdminV5 /></AdminGuard>
    : <StaffPlatformGate path={path} />;
  return <><p className="local-platform-notice" role="note">Local design preview. Use made-up details only. Accounts, bookings, and orders stay in this browser and are not sent to the shop.</p>{content}</>;
}
