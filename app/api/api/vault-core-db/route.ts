import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('x-internal-secret');

    // Verify secret key from Proxy API call
    if (authHeader !== process.env.INTERNAL_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized Vault Access' },
        { status: 401 }
      );
    }

    const { action, id, domain, url, cookies } = await req.json();

    // 1. Fetch single cookie by ID
    if (action === 'get_by_id') {
      const [rows]: any = await pool.execute('SELECT * FROM cookies WHERE id = ?', [id]);
      if (rows && rows.length > 0) {
        return NextResponse.json({ success: true, cookie: rows[0] });
      }
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // 2. Generate Encrypted Token Link Support
    if (action === 'get_by_id_simple') {
      const [rows]: any = await pool.execute('SELECT * FROM cookies WHERE id = ?', [id]);
      if (rows && rows.length > 0) {
        return NextResponse.json({ success: true, data: rows[0] });
      }
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    // 3. List all cookies
    if (action === 'list') {
      const [rows]: any = await pool.execute('SELECT * FROM cookies ORDER BY id DESC');
      return NextResponse.json({ success: true, data: rows });
    }

    // 4. Add or Update cookies
    if (action === 'add') {
      await pool.execute(
        'INSERT INTO cookies (domain, target_url, cookies_json) VALUES (?, ?, ?)',
        [domain, url, cookies]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      await pool.execute(
        'UPDATE cookies SET domain = ?, target_url = ?, cookies_json = ? WHERE id = ?',
        [domain, url, cookies, id]
      );
      return NextResponse.json({ success: true });
    }

    // 5. Delete cookie
    if (action === 'delete') {
      await pool.execute('DELETE FROM cookies WHERE id = ?', [id]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid Action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}