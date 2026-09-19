import Cookies from 'js-cookie';

export function saveRedirectAfterLogin() {
  if (typeof window !== 'undefined') {
    const fullPath = window.location.pathname + window.location.search;
    sessionStorage.setItem('redirectAfterLogin', fullPath);
  }
}

export function getAuthContext() {
  const userId = Cookies.get('userid') || Cookies.get('user_id') || Cookies.get('empid');
  const firmId = Cookies.get('firmid') || Cookies.get('firm_id') || Cookies.get('FIRMID');
  return { userId, firmId, isAuthenticated: Boolean(userId && firmId) };
}

export function checkAuthAndRedirect() {
  saveRedirectAfterLogin();

  const { userId, firmId, isAuthenticated } = getAuthContext();
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProd = hostname.includes('myblocks.in') || (!['localhost', '127.0.0.1'].includes(hostname));

  if (isProd && !isAuthenticated) {
    window.location.href = 'https://myblocks.in/login';
    return false;
  }
  return true;
}
