import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ইন্টারনাল সিক্রেট যা শুধু সার্ভার জানবে
const INTERNAL_SYSTEM_SECRET = 'SUPER_SECRET_INTERNAL_VAULT_KEY_998877665544332211';
const usedTokensSet = new Set<string>();

export async function GET(req: NextRequest) {
  const internalPass = req.headers.get('x-internal-vault-pass');

  // ইন্টারনাল সিক্রেট পাস ছাড়া সরাসরি হিট করলে সম্পূর্ণ ব্লক
  if (internalPass !== INTERNAL_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('t');
  const action = searchParams.get('action');
  const id = searchParams.get('id');

  try {
    if (action === 'test') {
      return NextResponse.json({ success: true, message: 'API Connected', database: 'Connected' });
    }

    // 🔒 ওয়ান-টাইম সিকিউর্ড টোকেন ভ্যালিডেশন
    if (token) {
      if (usedTokensSet.has(token)) {
        return NextResponse.json({ success: false, error: 'Token Already Used! Re-click button from website.' }, { status: 403 });
      }

      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const [targetId, timestamp, nonce] = decoded.split(':');

        if (!targetId || !timestamp || !nonce) {
          return NextResponse.json({ success: false, error: 'Invalid Token Format' }, { status: 400 });
        }

        const tokenTime = parseInt(timestamp, 10);
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime - tokenTime > 15) {
          return NextResponse.json({ success: false, error: 'Token Expired! Re-click button from website.' }, { status: 403 });
        }

        // একবার ব্যবহার হলেই টোকেন লক
        usedTokensSet.add(token);
        setTimeout(() => usedTokensSet.delete(token), 300000);

        const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [targetId]);
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

        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });

      } catch (e) {
        return NextResponse.json({ success: false, error: 'Invalid Token Payload' }, { status: 400 });
      }
    }

    // 🔑 ওয়ান-টাইম ডাইনামিক টোকেন জেনারেটর
    if (action === 'gentoken' && id) {
      const timestamp = Math.floor(Date.now() / 1000);
      const nonce = crypto.randomBytes(6).toString('hex');
      const rawToken = `${id}:${timestamp}:${nonce}`;
      const encodedToken = Buffer.from(rawToken).toString('base64');

      return NextResponse.json({ success: true, token: encodedToken });
    }

    // 📋 এডমিন প্যানেলের তালিকা
    if (action === 'list') {
      const [rows]: any = await pool.query('SELECT id, domain, target_url, created_at FROM cookies ORDER BY created_at DESC');
      return NextResponse.json({ success: true, data: rows });
    }

    // 📋 এডিট ভিউ
    if (action === 'get' && id) {
      const [rows]: any = await pool.query('SELECT id, domain, target_url FROM cookies WHERE id = ?', [id]);
      if (rows.length > 0) {
        const cookie = rows[0];
        return NextResponse.json({
          success: true,
          id: cookie.id,
          domain: cookie.domain,
          url: cookie.target_url,
          cookies: ""
        });
      }
      return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404 });
    }

    // 📋 HTML বাটন কোড জেনারেশন
    if (action === 'gethtml') {
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

      const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [id]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404 });

      const cookie = rows[0];
      const htmlCode = `<button style="background:linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%);color:white;border:none;padding:12px 24px;font-size:15px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 20px rgba(139,92,246,0.5);transition:all 0.3s ease;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.15);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 25px rgba(139,92,246,0.65)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(139,92,246,0.5)';" onclick="handleSecureLogin(this, ${cookie.id}, '${cookie.domain}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Access Now</button>`;

      return NextResponse.json({ success: true, html: htmlCode });
    }

    // 🗑️ ডিলিট
    if (action === 'delete') {
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });

      await pool.query('DELETE FROM cookies WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'Cookie deleted successfully' });
    }

    return NextResponse.json({ success: false, error: 'Invalid Action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const internalPass = req.headers.get('x-internal-vault-pass');

  if (internalPass !== INTERNAL_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
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
          return NextResponse.json({ success: true, message: 'Login successful' });
        }
      }
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }

    if (action === 'add') {
      const { domain, url, cookies } = body;
      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);

      const [maxRows]: any = await pool.query('SELECT MAX(id) as maxId FROM cookies');
      const nextId = (maxRows[0]?.maxId || 0) + 1;

      await pool.query(
        'INSERT INTO cookies (id, domain, target_url, cookies_json, created_at) VALUES (?, ?, ?, ?, NOW())',
        [nextId, domain, url, cookiesJson]
      );

      return NextResponse.json({ success: true, id: nextId, message: 'Cookie saved successfully' }, { status: 201 });
    }

    if (action === 'update') {
      const { id, domain, url, cookies } = body;
      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
      await pool.query('UPDATE cookies SET domain = ?, target_url = ?, cookies_json = ?, created_at = NOW() WHERE id = ?', [domain, url, cookiesJson, id]);

      return NextResponse.json({ success: true, message: 'Cookie updated successfully' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
  }
}