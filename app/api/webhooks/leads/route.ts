import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Assuming this is where the prisma client instance is exported

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Store the raw payload
    const lead = await prisma.incomingLead.create({
      data: {
        source: 'external_api',
        payload: body,
        status: 'PENDING',
      },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (error) {
    console.error('Error processing lead webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
