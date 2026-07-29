import { NextRequest, NextResponse } from 'next/server';

const EXTERNAL_PROXY_URL = "https://admin-panel-plum-eight.vercel.app/api/proxy";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    }

    // ১. সার্ভার সাইড থেকে Token জেনারেট করুন
    const tokenRes = await fetch(`${EXTERNAL_PROXY_URL}?action=gentoken&id=${id}`, {
      cache: 'no-store',
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.success || !tokenData.token) {
      return NextResponse.json({ success: false, error: 'Token generation failed' }, { status: 400 });
    }

    // ২. সার্ভার সাইড থেকে Session Cookie তথ্য ফেচ করুন
    const sessionRes = await fetch(`${EXTERNAL_PROXY_URL}?t=${tokenData.token}`, {
      cache: 'no-store',
    });
    const sessionData = await sessionRes.json();

    if (!sessionData.success) {
      return NextResponse.json({ success: false, error: sessionData.error || 'Session failed' }, { status: 400 });
    }

    // ৩. শুধুমাত্র প্রয়োজনীয় এক্সটেনশন ডাটা ক্লায়েন্টে পাঠান
    return NextResponse.json({
      success: true,
      url: sessionData.url,
      cookies: sessionData.cookies,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}