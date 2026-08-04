import type { ReactNode } from 'react';
import { SiteLayoutV5 } from './LayoutV5';
import { ModalA11yManager } from './ModalA11yManager';

function isOperationalPath(path: string) {
  return path === '/account'
    || path === '/dashboard'
    || path === '/book'
    || path === '/cart'
    || path === '/checkout'
    || path.startsWith('/staff')
    || path.startsWith('/admin');
}

export function SiteLayoutV6({ children, currentPath }: { children: ReactNode; currentPath: string }) {
  const operational = isOperationalPath(currentPath);
  return (
    <div className={`route-shell-v6${operational ? ' is-operational' : ' is-public'}`} data-route-kind={operational ? 'operational' : 'public'}>
      <ModalA11yManager />
      <SiteLayoutV5 currentPath={currentPath}>{children}</SiteLayoutV5>
    </div>
  );
}
