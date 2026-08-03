import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

const EXTERNAL_PROXY_URL = "https://admin-panel-plum-eight.vercel.app/api/proxy";
const SECRET_KEY = "S3cr3t_K3y_For_Skilledustore"; 

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID' }, { status: 400 });
    }

    // ১. টোকেন তৈরি
    const tokenRes = await fetch(`${EXTERNAL_PROXY_URL}?action=gentoken&id=${id}`, { cache: 'no-store' });
    const tokenData = await tokenRes.json();

    if (!tokenData.success || !tokenData.token) {
      return NextResponse.json({ success: false, error: 'Token generation failed' }, { status: 400 });
    }

    // ২. সেশন ডেটা আনা
    const sessionRes = await fetch(`${EXTERNAL_PROXY_URL}?t=${tokenData.token}`, { cache: 'no-store' });
    const sessionData = await sessionRes.json();

    if (!sessionData.success || !sessionData.url) {
      return NextResponse.json({ success: false, error: sessionData.error || 'Session failed or empty' }, { status: 400 });
    }

    // 🔥 ৩. সার্ভারের ভেতরেই ডেটা এনক্রিপ্ট করা হচ্ছে (ব্রাউজার শুধু তালা মারা ডেটা পাবে)
    const payloadToEncrypt = {
      url: sessionData.url,
      cookies: sessionData.cookies
    };
    
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(payloadToEncrypt), SECRET_KEY).toString();

    // এক্সটেনশনের কাছে শুধু এনক্রিপ্টেড ডেটা পাঠানো হচ্ছে
    return NextResponse.json({
      success: true,
      encrypted_payload: encryptedData,
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}