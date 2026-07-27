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

  // ১. ক্ষতিকারক বট, কার্ল বা ডিরেক্ট স্ক্র্যাপার ব্লক
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

  try {
    // 🔒 ১. কেউ যদি সরাসরি ব্রাউজারে ?action=get&id=১ লিখে লিংক খোলে (টোকেন ছাড়া) -> ব্লক
    if (action === 'get' && !token) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized Direct Access Restricted' 
      }, { status: 403, headers });
    }

    // 🔑 ২. শুধুমাত্র বাটন থেকে গোপন টোকেন (?t=) আসলে কুকিজ রিড হবে
    if (token) {
      let targetId = '';
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        targetId = decoded.split(':')[0]; // Base64 থেকে ID ফিল্টার করা
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
            cookies: cookie.cookies_json, // বাটনের রিকোয়েস্টে আসল কুকি যাবে
            domain: cookie.domain,
            id: cookie.id
          }, { headers });
        }
      }
      return NextResponse.json({ success: false, error: 'Session expired or not found' }, { status: 404, headers });
    }

    // 🔒 ৩. লিস্ট দেখার সময় কুকিজ হাইড থাকবে (কুকিজ_json পাঠানো হবে না)
    if (action === 'list') {
      const [rows]: any = await pool.query('SELECT id, domain, target_url, created_at FROM cookies ORDER BY created_at DESC');
      return NextResponse.json({ success: true, data: rows }, { headers });
    }

    if (action === 'test') {
      return NextResponse.json({ success: true, message: 'API Service Active' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Protected Route' }, { status: 400, headers });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Database Error' }, { status: 500, headers });
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

      return NextResponse.json({ success: true, message: 'Cookie updated' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400, headers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500, headers });
  }
}