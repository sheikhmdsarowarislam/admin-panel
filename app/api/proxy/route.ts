import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const ALLOWED_DOMAINS = [
  'skilledustore.com',
  'www.skilledustore.com',
  'dashboard.skilledustore.com',
  'localhost:3000',
  'skilledustore.shop',
  'www.skilledustore.shop',
  'admin-panel-plum-eight.vercel.app', // <-- এটি যোগ করুন
  'vercel.app'                          // <-- যেকোনো vercel সাবডোমেইন এলাউ করার জন্য
];

function isAllowedDomain(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const userAgent = req.headers.get('user-agent') || '';

  const blockedAgents = ['curl', 'wget', 'python', 'scrapy', 'bot'];
  for (const blocked of blockedAgents) {
    if (userAgent.toLowerCase().includes(blocked)) return false;
  }

  if (!origin && !referer) return false;

  let domain = '';
  try {
    const url = new URL(origin || referer);
    domain = url.host;
  } catch (e) {
    return false;
  }

  return ALLOWED_DOMAINS.some(allowed => domain === allowed || domain.split(':')[0] === allowed);
}

export async function GET(req: NextRequest) {
  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const encryptedId = searchParams.get('t');

  if (!encryptedId) {
    return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
  }

  try {
    const decoded = Buffer.from(encryptedId, 'base64').toString('utf-8');
    const parts = decoded.split(':');

    if (parts.length !== 2) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
    }

    const cookieId = parseInt(parts[0], 10);
    const timestamp = parseInt(parts[1], 10);

    if (Math.floor(Date.now() / 1000) - timestamp > 300) {
      return NextResponse.json({ success: false, error: 'Token expired' }, { status: 401 });
    }

    const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [cookieId]);
    if (rows.length > 0) {
      const cookie = rows[0];
      return NextResponse.json({
        success: true,
        url: cookie.target_url,
        cookies: cookie.cookies_json,
        domain: cookie.domain,
        id: cookie.id
      });
    }

    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: 'Service error' }, { status: 500 });
  }
}