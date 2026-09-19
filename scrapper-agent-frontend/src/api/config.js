// Dynamic API Base URL & Fetch Wrapper
export function getApiBaseUrl() {
  const hostname = window.location.hostname;
  const isProd = hostname.includes('myblocks.in') || (!['localhost', '127.0.0.1'].includes(hostname));
  
  if (isProd) {
    return 'https://myblocks.in:7800';
  }
  return '';
}

export function getWsBaseUrl() {
  const hostname = window.location.hostname;
  const isProd = hostname.includes('myblocks.in') || (!['localhost', '127.0.0.1'].includes(hostname));
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  
  if (isProd) {
    return `${protocol}//myblocks.in:7700`;
  }
  return `${protocol}//${hostname}:7700`;
}

export async function apiFetch(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const fullUrl = endpoint.startsWith('http')
    ? endpoint
    : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  return fetch(fullUrl, options);
}
