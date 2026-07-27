import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function pingDatabase(timeoutMs = 3000) {
  await Promise.race([
    prisma.$queryRaw`SELECT 1`,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Database ping timed out")), timeoutMs);
    }),
  ]);
}

export async function GET() {
  try {
    await pingDatabase();
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      uptime: process.uptime(),
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: "unhealthy", 
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 503 }
    );
  }
}
