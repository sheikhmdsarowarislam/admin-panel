import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js'; // 🔥 CryptoJS ইমপোর্ট করা হলো

const EXTERNAL_PROXY_URL = "https://admin-panel-plum-eight.vercel.app/api/proxy";
const SECRET_KEY = "S3cr3t_K3y_For_Skilledustore"; // 🔥 আপনার সিক্রেট কী (এক্সটেনশনেও এটাই ব্যবহার করতে হবে)

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

    // 🔥 ৩. কুকিগুলো প্লেইন-টেক্সটে না পাঠিয়ে, এনক্রিপ্ট করে পাঠানো হচ্ছে
    const payloadToEncrypt = {
      url: sessionData.url,
      cookies: sessionData.cookies
    };

    // ডেটাকে স্ট্রিং বানিয়ে AES-256 দিয়ে এনক্রিপ্ট করা
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(payloadToEncrypt), SECRET_KEY).toString();

    // শুধুমাত্র এনক্রিপ্টেড ডেটা রিটার্ন করা হচ্ছে
    return NextResponse.json({
      success: true,
      encrypted_payload: encryptedData,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}