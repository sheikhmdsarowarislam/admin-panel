import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_SYSTEM_SECRET = 'SUPER_SECRET_INTERNAL_VAULT_KEY_998877665544332211';

const ALLOWED_DOMAINS = [
  'skilledustore.com',
  'www.skilledustore.com',
  'dashboard.skilledustore.com',
  'localhost:3000',
  'skilledustore.shop',
  'www.skilledustore.shop',
  'admin-panel-plum-eight.vercel.app',
];

function isAllowedDomain(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const userAgent = req.headers.get('user-agent') || '';

  const blockedAgents = ['curl', 'wget', 'python', 'scrapy', 'bot'];
  for (const blocked of blockedAgents) {
    if (userAgent.toLowerCase().includes(blocked)) return false;
  }

  if (!origin && !referer) return true;

  let hostName = '';
  try {
    const url = new URL(origin || referer);
    hostName = url.hostname;
  } catch (e) {
    return true;
  }

  return ALLOWED_DOMAINS.some(allowed => 
    hostName === allowed || 
    hostName.endsWith('.' + allowed) || 
    hostName.endsWith('.vercel.app')
  );
}

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Panel-Auth, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const headers = corsHeaders(req);

  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers });
  }

  const { search } = new URL(req.url);
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';

  // 🔒 ইন্টারনালি সিক্রেট ভিআইপি রুটে কল পাঠানো হচ্ছে
  const internalVaultUrl = `${protocol}://${host}/api/vault-core-db${search}`;

  try {
    const response = await fetch(internalVaultUrl, {
      method: 'GET',
      headers: {
        'x-internal-vault-pass': INTERNAL_SYSTEM_SECRET,
        'x-panel-auth': req.headers.get('x-panel-auth') || ''
      }
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'System Error' }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers });
  }

  const { search } = new URL(req.url);
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'https';

  const internalVaultUrl = `${protocol}://${host}/api/vault-core-db${search}`;

  try {
    const body = await req.json();
    const response = await fetch(internalVaultUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-vault-pass': INTERNAL_SYSTEM_SECRET,
        'x-panel-auth': req.headers.get('x-panel-auth') || ''
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'System Error' }, { status: 500, headers });
  }
}