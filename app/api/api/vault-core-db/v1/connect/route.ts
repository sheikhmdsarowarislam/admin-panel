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

// CORS Preflight Request Handling
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Panel-Auth',
    },
  });
}

function isAllowedDomain(req: NextRequest) {
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';
  const userAgent = req.headers.get('user-agent') || '';

  // Block automated scrapers/bots
  const blockedAgents = ['curl', 'wget', 'python', 'scrapy', 'bot'];
  if (blockedAgents.some((agent) => userAgent.toLowerCase().includes(agent))) {
    return false;
  }

  // Allow direct browser visits for testing or matching origins
  if (!origin && !referer) return true;

  return ALLOWED_DOMAINS.some(
    (domain) => origin.includes(domain) || referer.includes(domain)
  );
}

export async function GET(req: NextRequest) {
  if (!isAllowedDomain(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized Domain' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'test') {
    return NextResponse.json({
      success: true,
      database: 'Connected',
      message: 'API is working properly!',
    });
  }

  if (action === 'list') {
    // Return sample data or database list
    return NextResponse.json({
      success: true,
      data: [],
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid Action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isAllowedDomain(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized Domain' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (action === 'login') {
      // Perform your login logic
      return NextResponse.json({ success: true, token: 'session_active' });
    }

    if (action === 'add' || action === 'update') {
      return NextResponse.json({ success: true, message: 'Saved successfully!' });
    }

    return NextResponse.json({ success: false, error: 'Invalid POST Action' });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Server Parsing Error' }, { status: 500 });
  }
}