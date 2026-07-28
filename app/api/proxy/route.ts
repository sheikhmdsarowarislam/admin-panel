import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

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
    return NextResponse.json({ success: false, error: 'Forbidden', message: 'Access denied.' }, { status: 403, headers });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('t');
  const action = searchParams.get('action');
  const id = searchParams.get('id');
  const panelAuth = req.headers.get('x-panel-auth');

  try {
    if (action === 'test') {
      return NextResponse.json({ success: true, message: 'API Connected', database: 'Connected' }, { headers });
    }

    if (token) {
      let targetId = '';
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        targetId = decoded.split(':')[0];
      } catch (e) {
        targetId = token;
      }

      if (targetId) {
        const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [targetId]);
        if (rows.length > 0) {
          const cookie = rows[0];
          return NextResponse.json({
            success: true,
            url: cookie.target_url,
            cookies: cookie.cookies_json,
            domain: cookie.domain,
            id: cookie.id
          }, { headers });
        }
      }
      return NextResponse.json({ success: false, error: 'Session expired or not found' }, { status: 404, headers });
    }

    if (!panelAuth && (action === 'list' || action === 'get')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Access Denied', 
        message: 'Direct API access restricted.' 
      }, { status: 403, headers });
    }

    if (action === 'get' && id && panelAuth === 'active') {
      const [rows]: any = await pool.query('SELECT id, domain, target_url FROM cookies WHERE id = ?', [id]);
      if (rows.length > 0) {
        const cookie = rows[0];
        return NextResponse.json({
          success: true,
          id: cookie.id,
          domain: cookie.domain,
          url: cookie.target_url,
          cookies: ""
        }, { headers });
      }
      return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404, headers });
    }

    if ((action === 'list' || !action) && panelAuth === 'active') {
      const [rows]: any = await pool.query('SELECT id, domain, target_url, created_at FROM cookies ORDER BY created_at DESC');
      return NextResponse.json({ success: true, data: rows }, { headers });
    }

    if (action === 'gethtml') {
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400, headers });

      const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [id]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404, headers });

      const cookie = rows[0];
      const htmlCode = `<button style="background:linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%);color:white;border:none;padding:12px 24px;font-size:15px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 20px rgba(139,92,246,0.5);transition:all 0.3s ease;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.15);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 25px rgba(139,92,246,0.65)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(139,92,246,0.5)';" onclick="handleAutoLogin(this, ${cookie.id}, '${cookie.domain}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Access Now</button>`;

      return NextResponse.json({ success: true, html: htmlCode }, { headers });
    }

    if (action === 'delete') {
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400, headers });

      await pool.query('DELETE FROM cookies WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'Cookie deleted successfully' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Invalid Action' }, { status: 400, headers });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req);

  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403, headers });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  try {
    const body = await req.json();

    if (action === 'login') {
      const { username, password } = body;
      const [rows]: any = await pool.query("SELECT * FROM admin_users WHERE username = ? AND status = 'active' LIMIT 1", [username]);
      if (rows.length > 0) {
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password) || password === user.password;
        if (match) {
          return NextResponse.json({ success: true, message: 'Login successful' }, { headers });
        }
      }
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401, headers });
    }

    if (action === 'add') {
      const { domain, url, cookies } = body;
      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
      const [result]: any = await pool.query('INSERT INTO cookies (domain, target_url, cookies_json, created_at) VALUES (?, ?, ?, NOW())', [domain, url, cookiesJson]);

      return NextResponse.json({ success: true, id: result.insertId, message: 'Cookie saved' }, { status: 201, headers });
    }

    if (action === 'update') {
      const { id, domain, url, cookies } = body;
      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
      await pool.query('UPDATE cookies SET domain = ?, target_url = ?, cookies_json = ?, created_at = NOW() WHERE id = ?', [domain, url, cookiesJson, id]);

      return NextResponse.json({ success: true, message: 'Cookie updated successfully' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400, headers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500, headers });
  }
}