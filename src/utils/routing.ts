export function routeToPath(page: string, id?: string | null): string {
  if (page === 'dashboard') return '/';
  if (page === 'quotation-detail') {
    return id && id !== 'new' ? `/quotations/${encodeURIComponent(id)}` : '/quotations/new';
  }
  if (page === 'invoice-detail') {
    return id && id !== 'new' ? `/invoices/${encodeURIComponent(id)}` : '/invoices/new';
  }
  if (page === 'quotations') return '/quotations';
  if (page === 'invoices') return '/invoices';
  if (page === 'customers') return '/customers';
  if (page === 'products') return '/products';
  if (page === 'suppliers') return '/suppliers';
  if (page === 'expenses') return '/expenses';
  if (page === 'recurring' || page === 'recurring-invoices') return '/recurring';
  if (page === 'showcase' || page === 'marketing') return '/showcase';
  if (page === 'inventory') return '/inventory';
  if (page === 'pos') return '/pos';
  if (page === 'tracking') return '/tracking';
  if (page === 'boq') return '/boq';
  if (page === 'reports') return '/reports';
  if (page === 'tasks') return '/tasks';
  if (page === 'companies') return '/companies';
  if (page === 'recycle-bin') return '/recycle-bin';
  if (page === 'settings') return '/settings';
  if (page === 'platform-admin') return '/platform-admin';
  return `/${page}`;
}

export function pathToRoute(pathname: string): { page: string; id: string | null } {
  // Check if it's a portal route
  if (pathname.startsWith('/portal/')) {
    return { page: 'portal', id: null };
  }

  const path = pathname.replace(/^\/+|\/+$/g, '');
  if (!path || path === 'dashboard') return { page: 'dashboard', id: null };

  const segments = path.split('/');
  const base = segments[0];

  if (base === 'quotations' || base === 'quotes') {
    if (segments[1] === 'new') return { page: 'quotation-detail', id: 'new' };
    if (segments[1]) return { page: 'quotation-detail', id: decodeURIComponent(segments[1]) };
    return { page: 'quotations', id: null };
  }

  if (base === 'invoices') {
    if (segments[1] === 'new') return { page: 'invoice-detail', id: 'new' };
    if (segments[1]) return { page: 'invoice-detail', id: decodeURIComponent(segments[1]) };
    return { page: 'invoices', id: null };
  }

  const validPages: Record<string, string> = {
    customers: 'customers',
    products: 'products',
    suppliers: 'suppliers',
    expenses: 'expenses',
    recurring: 'recurring',
    'recurring-invoices': 'recurring',
    inventory: 'inventory',
    pos: 'pos',
    tracking: 'tracking',
    boq: 'boq',
    reports: 'reports',
    tasks: 'tasks',
    companies: 'companies',
    'recycle-bin': 'recycle-bin',
    settings: 'settings',
    showcase: 'showcase',
    marketing: 'showcase',
    'platform-admin': 'platform-admin'
  };

  if (validPages[base]) {
    return { page: validPages[base], id: segments[1] || null };
  }

  return { page: 'dashboard', id: null };
}
