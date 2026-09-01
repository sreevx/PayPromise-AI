// PayPromise AI - Demo Reset Endpoint
// Development only. Resets all demo data to initial state.
// MUST NOT work in production.

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export async function POST() {
  // Security: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Demo reset is not available in production.' },
      { status: 403 },
    );
  }

  try {
    // Reset database
    execSync('npx prisma db push --force-reset --skip-generate', {
      cwd: process.cwd(),
      timeout: 30000,
    });

    // Reseed
    execSync('npx tsx prisma/seed.ts', {
      cwd: process.cwd(),
      timeout: 60000,
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data has been reset to initial state.',
      environment: process.env.NODE_ENV,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Reset failed: ${error.message}` },
      { status: 500 },
    );
  }
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({
    available: true,
    message: 'Send POST to reset demo data.',
    environment: process.env.NODE_ENV,
  });
}
