/**
 * Multi-tenancy safety net: the store's apiFetch sends X-Company-Id, but many screens call
 * fetch('/api/...') directly. Without the header the server falls back to the user's default
 * company, so after switching company those calls would read/write the wrong tenant.
 * Same-origin /api requests get the active company header unless one is already set.
 */
export function installCompanyFetch(): void {
  if (typeof window === 'undefined' || (window as any).__companyFetchInstalled) return;
  (window as any).__companyFetchInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const isApi = url.startsWith('/api/') || url.startsWith(`${window.location.origin}/api/`);
      const company = localStorage.getItem('erp_active_company');
      if (isApi && company) {
        const headers = new Headers(init?.headers || (typeof input === 'object' && 'headers' in input ? (input as Request).headers : undefined));
        if (!headers.has('X-Company-Id')) headers.set('X-Company-Id', company);
        return nativeFetch(input, { ...init, headers });
      }
    } catch {
      // fall through to the plain request
    }
    return nativeFetch(input, init);
  };
}
