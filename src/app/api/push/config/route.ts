import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  if (!key) return NextResponse.json({ enabled: false });
  return NextResponse.json({ enabled: true, publicKey: key });
}
