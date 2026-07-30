import { lookup } from 'dns/promises';
import { isIP } from 'net';

// Blocks the remote-upload feature from being used to reach internal/private
// network targets (loopback, RFC1918 ranges, link-local - which includes the
// 169.254.169.254 cloud metadata endpoint on AWS/GCP/Azure/DigitalOcean).
// Checked against resolved IPs, not just the hostname string, so a public
// domain name that resolves to a private address (DNS rebinding) is still
// caught.

function isPrivateOrReservedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return true;
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 (loopback)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local, incl. cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true; // multicast/reserved

  return false;
}

function isPrivateOrReservedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 address - unwrap and check the IPv4 rules.
    const mapped = normalized.split(':').pop() || '';
    if (isIP(mapped) === 4) return isPrivateOrReservedIPv4(mapped);
  }
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (fc00::/7)
  return false;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateOrReservedIPv4(ip);
  if (version === 6) return isPrivateOrReservedIPv6(ip);
  return true; // unrecognized format - fail closed
}

// Throws if the hostname is a bare IP literal that's private/reserved, or if
// any address it resolves to is private/reserved.
export async function assertPublicHostname(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error('URL resolves to a private or reserved address');
    }
    return;
  }

  if (hostname === 'localhost') {
    throw new Error('URL resolves to a private or reserved address');
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new Error('Could not resolve URL host');
  }

  if (addresses.length === 0 || addresses.some((a) => isPrivateOrReservedIp(a.address))) {
    throw new Error('URL resolves to a private or reserved address');
  }
}

const MAX_REDIRECTS = 5;

// Fetches url but follows redirects manually, re-validating each hop's
// hostname against private/reserved IP ranges - `redirect: 'follow'` would
// let a server that first resolves to a public IP redirect to an internal
// one (e.g. 169.254.169.254) and bypass the initial check entirely.
export async function fetchWithValidatedRedirects(url: URL, init: RequestInit): Promise<Response> {
  let currentUrl = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHostname(currentUrl.hostname);

    const response = await fetch(currentUrl, { ...init, redirect: 'manual' });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return response;
      const nextUrl = new URL(location, currentUrl);
      if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
        throw new Error('Redirect target must be http:// or https://');
      }
      currentUrl = nextUrl;
      continue;
    }

    return response;
  }

  throw new Error('Too many redirects');
}
