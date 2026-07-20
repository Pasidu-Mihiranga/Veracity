import { NextResponse } from 'next/server';

/** OAuth callback is unused with local Postgres auth — redirect home. */
export async function GET() {
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
}
