import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron wrapper for attendance sync
 * Called by system cron every 5 minutes
 * Logs execution to CronJobLog table
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const jobName = "attendance_sync";

  try {
    // Authenticate
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the actual sync endpoint - use reliable base URL for serverless
    let baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL
    if (!baseUrl && request.url) {
      try {
        baseUrl = new URL(request.url).origin
      } catch {
        baseUrl = 'http://localhost:3000'
      }
    }
    baseUrl = baseUrl || 'http://localhost:3000'
    const syncUrl = new URL('/api/attendance/sync/daily', baseUrl)
    const syncRequest = new Request(syncUrl.toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
      },
    });

    const syncResponse = await fetch(syncRequest);
    const syncData = await syncResponse.json();

    const durationMs = Date.now() - startTime;
    const isSuccess = syncResponse.ok;
    const recordsProcessed = syncData.data?.processed || 0;

    // Log to CronJobLog
    await prisma.cronJobLog.create({
      data: {
        jobName,
        status: isSuccess ? "success" : "error",
        durationMs,
        recordsProcessed,
        message: isSuccess
          ? `Synced ${recordsProcessed} attendance records`
          : "Sync failed",
        error: isSuccess ? null : JSON.stringify(syncData),
      },
    });

    return NextResponse.json({
      success: isSuccess,
      jobName,
      durationMs,
      recordsProcessed,
      syncData,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log error
    await prisma.cronJobLog.create({
      data: {
        jobName,
        status: "error",
        durationMs,
        recordsProcessed: 0,
        message: "Cron job failed",
        error: errorMessage,
      },
    });

    return NextResponse.json(
      { error: errorMessage, jobName, durationMs },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
