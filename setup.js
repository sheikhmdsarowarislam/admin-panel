const fs = require('fs');
const path = require('path');

// ফোল্ডার তৈরি
const dirs = ['app/api/api', 'app/api/proxy', 'lib'];
dirs.forEach(dir => {
  fs.mkdirSync(path.join(__dirname, dir), { recursive: true });
});

// ফাইলগুলোর কনটেন্ট
const files = {
  'package.json': `{
  "name": "cookie-manager-next",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "mysql2": "^3.9.1",
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20.11.16",
    "@types/react": "^18.2.52",
    "@types/react-dom": "^18.2.18",
    "typescript": "^5.3.3"
  }
}`,

  '.env.local': `DB_HOST=localhost
DB_USER=skilled4_testCookiesAdminuser
DB_PASSWORD=)O_V,*qiT6I}9Nw]
DB_NAME=skilled4_testCookiesAdmin`,

  'lib/db.ts': `import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});`,

  'app/layout.tsx': `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cookie Manager Panel",
  description: "Cookie Manager System in Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,

  'app/api/api/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

const ALLOWED_DOMAINS = [
  'skilledustore.com',
  'www.skilledustore.com',
  'dashboard.skilledustore.com',
  'localhost:3000',
  'skilledustore.shop',
  'www.skilledustore.shop'
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

function corsHeaders(req: NextRequest) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-Panel-Auth',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 200, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden', message: 'Access denied.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'list';
  const headers = corsHeaders(req);

  try {
    if (action === 'test') {
      return NextResponse.json({
        success: true,
        message: 'API is working',
        database: 'Connected',
        server_time: new Date().toISOString()
      }, { headers });
    }

    if (action === 'list') {
      const [rows] = await pool.query('SELECT * FROM cookies ORDER BY created_at DESC');
      return NextResponse.json({ success: true, data: rows }, { headers });
    }

    if (action === 'get') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400, headers });

      const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [id]);
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
      return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404, headers });
    }

    if (action === 'gethtml') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400, headers });

      const [rows]: any = await pool.query('SELECT * FROM cookies WHERE id = ?', [id]);
      if (rows.length === 0) return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404, headers });

      const cookie = rows[0];
      const htmlCode = \`<button style="background:linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%);color:white;border:none;padding:12px 24px;font-size:15px;font-weight:600;border-radius:10px;cursor:pointer;box-shadow:0 4px 20px rgba(139,92,246,0.5);transition:all 0.3s ease;display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.15);" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 25px rgba(139,92,246,0.65)';" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 4px 20px rgba(139,92,246,0.5)';" onclick="handleAutoLogin(this, \${cookie.id}, '\${cookie.domain}')"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg> Access Now</button>\`;

      return NextResponse.json({ success: true, html: htmlCode }, { headers });
    }

    if (action === 'domain') {
      const domain = searchParams.get('domain');
      if (!domain) return NextResponse.json({ success: false, error: 'Missing domain' }, { status: 400, headers });

      const [rows]: any = await pool.query('SELECT * FROM cookies WHERE domain = ? LIMIT 1', [domain]);
      if (rows.length > 0) {
        return NextResponse.json({
          success: true,
          url: rows[0].target_url,
          cookies: rows[0].cookies_json
        }, { headers });
      }
      return NextResponse.json({ success: false, error: 'Domain not found' }, { status: 404, headers });
    }

    if (action === 'delete') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400, headers });

      await pool.query('DELETE FROM cookies WHERE id = ?', [id]);
      return NextResponse.json({ success: true, message: 'Cookie deleted successfully' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400, headers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message }, { status: 500, headers });
  }
}

export async function POST(req: NextRequest) {
  if (!isAllowedDomain(req)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const headers = corsHeaders(req);

  try {
    const body = await req.json();

    if (action === 'login') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400, headers });
      }

      const [rows]: any = await pool.query("SELECT * FROM admin_users WHERE username = ? AND status = 'active' LIMIT 1", [username]);
      if (rows.length > 0) {
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password) || password === user.password;
        if (match) {
          return NextResponse.json({ success: true, message: 'Login successful', username: user.username }, { headers });
        }
      }
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401, headers });
    }

    if (action === 'add') {
      const { domain, url, cookies } = body;
      if (!domain || !url || !cookies) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400, headers });
      }

      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
      const [result]: any = await pool.query('INSERT INTO cookies (domain, target_url, cookies_json, created_at) VALUES (?, ?, ?, NOW())', [domain, url, cookiesJson]);

      return NextResponse.json({ success: true, id: result.insertId, message: 'Cookie added successfully' }, { status: 201, headers });
    }

    if (action === 'update') {
      const { id, domain, url, cookies } = body;
      if (!id || !domain || !url || !cookies) {
        return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400, headers });
      }

      let cookiesJson = typeof cookies === 'string' ? cookies : JSON.stringify(cookies);
      await pool.query('UPDATE cookies SET domain = ?, target_url = ?, cookies_json = ?, created_at = NOW() WHERE id = ?', [domain, url, cookiesJson, id]);

      return NextResponse.json({ success: true, message: 'Cookie updated successfully' }, { headers });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400, headers });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: 'Database error: ' + error.message }, { status: 500, headers });
  }
}`,

  'app/api/proxy/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const ALLOWED_DOMAINS = [
  'skilledustore.com',
  'www.skilledustore.com',
  'dashboard.skilledustore.com',
  'localhost:3000',
  'skilledustore.shop',
  'www.skilledustore.shop'
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
}`,

  'app/globals.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; padding: 20px; }
.container { max-width: 1200px; margin: 0 auto; }
.header { background: white; padding: 20px 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; }
.header h1 { color: #667eea; font-size: 24px; }
.header-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.status { padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.status:hover { transform: scale(1.05); }
.status.active { background: #4CAF50; color: white; }
.status.inactive { background: #e0e0e0; color: #666; }
.status.checking { background: #ff9800; color: white; }
.status.error { background: #f44336; color: white; }
.panel { background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); padding: 30px; margin-bottom: 20px; }
.form-group { margin-bottom: 20px; }
label { display: block; margin-bottom: 8px; color: #333; font-weight: 600; }
input, textarea { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; transition: border-color 0.3s; }
input:focus, textarea:focus { outline: none; border-color: #667eea; }
textarea { min-height: 120px; font-family: 'Courier New', monospace; resize: vertical; }
.search-box { position: relative; margin-bottom: 20px; }
.search-box input { padding-left: 40px; }
.search-box::before { content: '🔍'; position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; z-index: 1; }
.btn { padding: 12px 30px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.btn-primary { background: #667eea; color: white; }
.btn-primary:hover:not(:disabled) { background: #5568d3; transform: translateY(-2px); box-shadow: 0 4px 8px rgba(0,0,0,0.2); }
.btn-danger { background: #f44336; color: white; }
.btn-danger:hover:not(:disabled) { background: #da190b; }
.btn-success { background: #4CAF50; color: white; }
.btn-success:hover:not(:disabled) { background: #45a049; }
.btn-warning { background: #ff9800; color: white; }
.btn-warning:hover:not(:disabled) { background: #e68900; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-group { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.cookies-list { margin-top: 20px; }
.cookie-item { background: #f5f5f5; border: 2px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 15px; transition: all 0.3s; }
.cookie-item:hover { border-color: #667eea; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.cookie-item.editing { border-color: #ff9800; background: #fff3e0; box-shadow: 0 4px 8px rgba(255, 152, 0, 0.3); }
.cookie-item.editing::before { content: '✏️ Currently Editing'; display: block; background: #ff9800; color: white; padding: 5px 10px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 10px; width: fit-content; }
.cookie-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 10px; }
.cookie-domain { font-size: 18px; font-weight: 700; color: #333; }
.cookie-url { font-size: 14px; color: #666; margin-bottom: 10px; word-break: break-all; }
.cookie-preview { font-family: 'Courier New', monospace; font-size: 12px; color: #666; background: white; padding: 10px; border-radius: 4px; overflow-x: auto; max-height: 100px; overflow-y: auto; }
.cookie-actions { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.toast { position: fixed; top: 20px; right: 20px; background: white; border-radius: 8px; padding: 16px 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 12px; z-index: 1000; animation: slideIn 0.3s ease-out; max-width: 400px; }
.toast.success { border-left: 4px solid #4CAF50; }
.toast.error { border-left: 4px solid #f44336; }
.toast-icon { font-size: 24px; }
@keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
.empty-state { text-align: center; padding: 60px 20px; color: #999; }
.empty-state-icon { font-size: 64px; margin-bottom: 20px; }
.loading { text-align: center; padding: 40px; color: #667eea; font-size: 18px; }
.api-status { padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; }
.api-status.connected { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
.api-status.disconnected { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
.login-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; }
.login-box { background: white; padding: 40px; border-radius: 15px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); width: 100%; max-width: 400px; }
.login-box h1 { color: #667eea; text-align: center; margin-bottom: 30px; font-size: 28px; }
.login-form-group { margin-bottom: 20px; }
.login-form-group label { display: block; margin-bottom: 8px; color: #333; font-weight: 600; }
.login-form-group input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 14px; }
.remember-me { display: flex; align-items: center; margin-bottom: 20px; gap: 8px; }
.login-btn { width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; }
.error-message { background: #fee; color: #c33; padding: 12px; border-radius: 6px; margin-bottom: 20px; font-size: 14px; text-align: center; }
.lock-icon { text-align: center; font-size: 50px; margin-bottom: 20px; }
.logout-btn { padding: 8px 16px; font-size: 14px; }`,

  'app/page.tsx': `"use client";

import { useState, useEffect } from 'react';

const API_URL = '/api/api';
const SESSION_KEY = 'cookie_manager_auth';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [apiConnected, setApiConnected] = useState(false);
  const [apiStatusText, setApiStatusText] = useState('🔴 Connecting to API...');
  const [extensionStatusText, setExtensionStatusText] = useState('🔍 Checking Extension...');
  const [extensionStatusClass, setExtensionStatusClass] = useState('status checking');
  const [extensionInstalled, setExtensionInstalled] = useState(false);

  const [domainInput, setDomainInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [cookiesInput, setCookiesInput] = useState('');
  const [editingCookieId, setEditingCookieId] = useState<number | null>(null);

  const [allCookies, setAllCookies] = useState<any[]>([]);
  const [filteredCookies, setFilteredCookies] = useState<any[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loadingCookies, setLoadingCookies] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const showToast = (message: string, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const savedAuth = sessionStorage.getItem(SESSION_KEY);
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth);
        if (auth.username && auth.timestamp) {
          const hoursPassed = (Date.now() - auth.timestamp) / (1000 * 60 * 60);
          if (hoursPassed < 720) {
            setIsAuthenticated(true);
          }
        }
      } catch (e) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      testAPI();
      loadCookies();

      const handleMessage = (event: MessageEvent) => {
        if (event.source !== window) return;
        if (event.data.type === 'EXTENSION_STATUS') {
          if (event.data.installed) {
            setExtensionInstalled(true);
            setExtensionStatusText('✅ Extension Ready');
            setExtensionStatusClass('status active');
          } else {
            setExtensionInstalled(false);
            setExtensionStatusText('❌ Extension Error');
            setExtensionStatusClass('status error');
            if (event.data.error) showToast('⚠️ ' + event.data.error, 'error');
          }
        }
        if (event.data.type === 'SETUP_RESPONSE') {
          if (event.data.response?.success) {
            showToast('✅ Session injected! Opening in new tab...', 'success');
          } else {
            showToast('❌ Failed: ' + (event.data.response?.error || 'Unknown error'), 'error');
          }
        }
      };

      window.addEventListener('message', handleMessage);
      window.postMessage({ type: 'CHECK_EXTENSION' }, '*');

      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await fetch(\`\${API_URL}?action=login\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();

      if (result.success) {
        if (rememberMe) {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            username,
            timestamp: Date.now()
          }));
        }
        setIsAuthenticated(true);
      } else {
        setLoginError('❌ ' + (result.error || 'Invalid credentials'));
      }
    } catch (err) {
      setLoginError('❌ Connection error!');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    if (confirm('Are you sure you want to logout?')) {
      sessionStorage.removeItem(SESSION_KEY);
      setIsAuthenticated(false);
      showToast('✅ Logged out successfully', 'success');
    }
  };

  const testAPI = async () => {
    try {
      const res = await fetch(\`\${API_URL}?action=test\`);
      const result = await res.json();
      if (result.success) {
        setApiConnected(true);
        setApiStatusText('🟢 API Connected: ' + result.database);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      setApiConnected(false);
      setApiStatusText('🔴 API Error: ' + err.message);
    }
  };

  const loadCookies = async () => {
    setLoadingCookies(true);
    try {
      const res = await fetch(\`\${API_URL}?action=list\`);
      const result = await res.json();
      if (result.success && result.data) {
        setAllCookies(result.data);
        setFilteredCookies(result.data);
      } else {
        setAllCookies([]);
        setFilteredCookies([]);
      }
    } catch (err) {
      setAllCookies([]);
      setFilteredCookies([]);
    } finally {
      setLoadingCookies(false);
    }
  };

  const saveCookie = async () => {
    if (!domainInput || !urlInput || !cookiesInput) {
      showToast('❌ Please fill all fields', 'error');
      return;
    }

    try {
      JSON.parse(cookiesInput);
      const action = editingCookieId ? 'update' : 'add';
      const payload: any = { domain: domainInput, url: urlInput, cookies: cookiesInput };
      if (editingCookieId) payload.id = editingCookieId;

      const res = await fetch(\`\${API_URL}?action=\${action}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (result.success) {
        showToast(editingCookieId ? '✅ Cookie updated!' : '✅ Cookie saved!', 'success');
        clearForm();
        loadCookies();
      } else {
        showToast('❌ Error: ' + result.error, 'error');
      }
    } catch (err: any) {
      showToast('❌ Error: Invalid JSON or Server Error', 'error');
    }
  };

  const editCookie = async (id: number) => {
    try {
      const res = await fetch(\`\${API_URL}?action=get&id=\${id}\`);
      const result = await res.json();
      if (result.success) {
        setDomainInput(result.domain);
        setUrlInput(result.url);
        try {
          setCookiesInput(JSON.stringify(JSON.parse(result.cookies), null, 2));
        } catch {
          setCookiesInput(result.cookies);
        }
        setEditingCookieId(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showToast('📝 Cookie loaded for editing', 'success');
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const deleteCookie = async (id: number) => {
    if (!confirm('Are you sure you want to delete this cookie?')) return;
    try {
      const res = await fetch(\`\${API_URL}?action=delete&id=\${id}\`);
      const result = await res.json();
      if (result.success) {
        showToast('✅ Cookie deleted', 'success');
        if (editingCookieId === id) clearForm();
        loadCookies();
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const injectCookie = async (id: number) => {
    try {
      const res = await fetch(\`\${API_URL}?action=get&id=\${id}\`);
      const result = await res.json();
      if (result.success) {
        window.postMessage({
          type: 'SETUP_SESSION',
          sessionData: { url: result.url, cookies: result.cookies }
        }, '*');
      }
    } catch (err: any) {
      showToast('❌ Error: ' + err.message, 'error');
    }
  };

  const copyHTMLCode = async (id: number) => {
    try {
      const res = await fetch(\`\${API_URL}?action=gethtml&id=\${id}\`);
      const result = await res.json();
      if (result.success && result.html) {
        await navigator.clipboard.writeText(result.html);
        showToast('✅ HTML Code copied! Paste in Elementor HTML widget', 'success');
      }
    } catch (err: any) {
      showToast('❌ Failed to copy code: ' + err.message, 'error');
    }
  };

  const clearForm = () => {
    setDomainInput('');
    setUrlInput('');
    setCookiesInput('');
    setEditingCookieId(null);
  };

  const handleSearch = (term: string) => {
    setSearchInput(term);
    if (!term.trim()) {
      setFilteredCookies(allCookies);
    } else {
      setFilteredCookies(allCookies.filter(item => item.domain.toLowerCase().includes(term.toLowerCase())));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-box">
          <div className="lock-icon">🔒</div>
          <h1>🍪 Cookie Manager</h1>
          {loginError && <div className="error-message">{loginError}</div>}
          <form onSubmit={handleLogin}>
            <div className="login-form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="login-form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="remember-me">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember me for 30 days</label>
            </div>
            <button type="submit" className="login-btn" disabled={isLoggingIn}>
              {isLoggingIn ? '⏳ Verifying...' : '🚀 Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {toast && (
        <div className={\`toast \${toast.type}\`}>
          <span className="toast-icon">{toast.type === 'success' ? '✅' : '❌'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      <div className="header">
        <h1>🍪 Cookie Manager Panel</h1>
        <div className="header-actions">
          <div className={extensionStatusClass} onClick={() => window.postMessage({ type: 'CHECK_EXTENSION' }, '*')}>
            {extensionStatusText}
          </div>
          <button className="btn btn-danger logout-btn" onClick={logout}>🚪 Logout</button>
        </div>
      </div>

      <div className="panel">
        <div className={\`api-status \${apiConnected ? 'connected' : 'disconnected'}\`}>{apiStatusText}</div>
        <h2 style={{ marginBottom: '20px', color: '#333' }}>
          {editingCookieId ? '✏️ Edit Cookie Session' : 'Add New Cookie Session'}
        </h2>
        <div className="form-group">
          <label>Domain *</label>
          <input
            type="text"
            placeholder="example.com"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Target URL *</label>
          <input
            type="url"
            placeholder="https://example.com"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Cookies (JSON Array) *</label>
          <textarea
            placeholder='[{"name": "session", "value": "abc123", "domain": "example.com"}]'
            value={cookiesInput}
            onChange={(e) => setCookiesInput(e.target.value)}
          ></textarea>
          <small style={{ color: '#666' }}>Format: Array of objects with name, value, and domain</small>
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={saveCookie}>
            {editingCookieId ? '💾 Update Cookie' : '💾 Save to Database'}
          </button>
          <button className="btn btn-danger" onClick={clearForm}>🗑️ Clear Form</button>
        </div>
      </div>

      <div className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#333' }}>Database Cookies</h2>
          <button className="btn btn-primary" onClick={loadCookies}>🔄 Refresh</button>
        </div>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by domain..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="cookies-list">
          {loadingCookies ? (
            <div className="loading">⏳ Loading cookies...</div>
          ) : filteredCookies.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <p>No cookies found</p>
            </div>
          ) : (
            filteredCookies.map((item) => (
              <div key={item.id} className={\`cookie-item \${editingCookieId === item.id ? 'editing' : ''}\`}>
                <div className="cookie-header">
                  <span className="cookie-domain">🌐 {item.domain}</span>
                  <span style={{ color: '#999', fontSize: '12px' }}>{new Date(item.created_at).toLocaleString()}</span>
                </div>
                <div className="cookie-url">🔗 {item.target_url}</div>
                <div className="cookie-preview">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(item.cookies_json), null, 2);
                    } catch {
                      return item.cookies_json;
                    }
                  })()}
                </div>
                <div className="cookie-actions">
                  <button className="btn btn-success" onClick={() => injectCookie(item.id)}>🚀 Inject & Login</button>
                  <button className="btn btn-primary" onClick={() => editCookie(item.id)}>✏️ Edit</button>
                  <button className="btn btn-danger" onClick={() => deleteCookie(item.id)}>🗑️ Delete</button>
                  <button className="btn btn-warning" onClick={() => copyHTMLCode(item.id)}>📋 Copy HTML Code</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}`
};

// ফাইল লিখা
for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(__dirname, filePath), content);
  console.log('✅ Created:', filePath);
}

console.log('\n🎉 All project files have been created successfully!');