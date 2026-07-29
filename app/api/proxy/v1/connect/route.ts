import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_DOMAINS = [
  'skilledustore.com',
  'www.skilledustore.com',
  'dashboard.skilledustore.com',
  'localhost:3000',
  'skilledustore.shop',
  'www.skilledustore.shop',
  'admin-panel-plum-eight.vercel.app',
];

const BLOCKED_AGENTS = ['curl', 'wget', 'python', 'scrapy', 'bot'];

function isRequestAllowed(req: NextRequest): boolean {
  const userAgent = req.headers.get('user-agent') || '';
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  for (const blocked of BLOCKED_AGENTS) {
    if (userAgent.toLowerCase().includes(blocked)) return false;
  }

  if (!origin && !referer) return false;

  const targetUrl = origin || referer;
  let domain = '';

  try {
    const parsed = new URL(targetUrl);
    domain = parsed.host;
  } catch {
    return false;
  }

  if (!domain) return false;

  const hostWithoutPort = domain.split(':')[0];
  return ALLOWED_DOMAINS.some(
    (allowed) => domain === allowed || hostWithoutPort === allowed
  );
}

// Internal Helper to query Main Vault API
async function callVaultCore(payload: object) {
  const vaultUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/vault-core-db`;
  
  const res = await fetch(vaultUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_SECRET_KEY || '',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  return await res.json();
}

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };

  // 1. Security check
  if (!isRequestAllowed(req)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const encryptedToken = searchParams.get('t');
  const idParam = searchParams.get('id');

  try {
    // Action 1: Generate temporary Base64 Token
    if (action === 'gentoken' && idParam) {
      const timestamp = Math.floor(Date.now() / 1000);
      const rawToken = `${idParam}:${timestamp}`;
      const token = Buffer.from(rawToken).toString('base64');
      return NextResponse.json({ success: true, token }, { headers: corsHeaders });
    }

    // Action 2: Retrieve cookie using Base64 token (?t=xxx)
    if (encryptedToken) {
      const decoded = Buffer.from(encryptedToken, 'base64').toString('utf-8');
      const parts = decoded.split(':');

      if (parts.length !== 2) {
        return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400, headers: corsHeaders });
      }

      const cookieId = parseInt(parts[0], 10);
      const timestamp = parseInt(parts[1], 10);

      if (Math.floor(Date.now() / 1000) - timestamp > 300) {
        return NextResponse.json({ success: false, error: 'Token expired' }, { status: 401, headers: corsHeaders });
      }

      // Call internal Main API safely
      const vaultResult = await callVaultCore({ action: 'get_by_id', id: cookieId });

      if (vaultResult.success && vaultResult.cookie) {
        const c = vaultResult.cookie;
        return NextResponse.json(
          {
            success: true,
            url: c.target_url,
            cookies: c.cookies_json,
            domain: c.domain,
            id: c.id,
          },
          { headers: corsHeaders }
        );
      }

      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404, headers: corsHeaders });
    }

    // Action 3: Fetch HTML widget code
    if (action === 'gethtml' && idParam) {
      const htmlCode = `<button onclick="handleAutoLogin(this, ${idParam})">Inject Session</button>`;
      return NextResponse.json({ success: true, html: htmlCode }, { headers: corsHeaders });
    }

    // Action 4: Default fetch by ID
    if (action === 'get' && idParam) {
      const vaultResult = await callVaultCore({ action: 'get_by_id_simple', id: idParam });
      return NextResponse.json(vaultResult, { headers: corsHeaders });
    }

    // Action 5: List cookies
    if (action === 'list') {
      const vaultResult = await callVaultCore({ action: 'list' });
      return NextResponse.json(vaultResult, { headers: corsHeaders });
    }

    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Service error' }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
  };

  if (!isRequestAllowed(req)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403, headers: corsHeaders });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    const body = await req.json();

    if (action === 'add' || action === 'update') {
      const vaultResult = await callVaultCore({ action, ...body });
      return NextResponse.json(vaultResult, { headers: corsHeaders });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400, headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
}