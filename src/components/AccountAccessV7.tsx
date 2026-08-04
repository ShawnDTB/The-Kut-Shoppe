import { getPlatformSessionAccount } from '../data/auth-v2';
import { AccountAccessV5 } from './AccountAccessV5';
import { RoleDashboardV6 } from './RoleDashboardV6';

export function AccountAccessV7() {
  return getPlatformSessionAccount() ? <RoleDashboardV6 /> : <AccountAccessV5 />;
}
