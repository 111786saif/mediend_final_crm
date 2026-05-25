import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInternalBaseUrl } from "@/lib/cron-internal-url";

/** mysql-leads returns ApiResponse<{ synced, updated, processed, ... }>; tolerate extra nesting or string numbers */
function parseMysqlLeadsPayload(syncData: unknown): {
  synced: number;
  updated: number;
  processed: number;
} {
  const root = syncData as Record<string, unknown> | null;
  let inner = root?.data as Record<string, unknown> | undefined;
  if (
    inner &&
    typeof inner === "object" &&
    inner.data !== undefined &&
    typeof inner.data === "object" &&
    inner.data !== null &&
    ("synced" in (inner.data as object) || "updated" in (inner.data as object) || "processed" in (inner.data as object))
  ) {
    inner = inner.data as Record<string, unknown>;
  }
  const n = (v: unknown) => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const p = parseInt(v, 10);
      return Number.isNaN(p) ? 0 : p;
    }
    return 0;
  };
  return {
    synced: n(inner?.synced),
    updated: n(inner?.updated),
    processed: n(inner?.processed),
  };
}

/**
 * Cron wrapper for leads sync
 * Called by system cron every 5 minutes
 * Logs execution to CronJobLog table
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const jobName = "leads_sync";

  try {
    // Authenticate
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use INTERNAL_API_URL (loopback) when set so this fetch doesn't egress
    // through the public hostname and trip the Nginx IP allowlist.
    const syncUrl = new URL("/api/sync/mysql-leads", getInternalBaseUrl(request));
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
    const stats = parseMysqlLeadsPayload(syncData);
    const written = stats.synced + stats.updated;
    // Prefer rows written; if none (all skipped/errors in batch) but batch ran, still count processed
    const recordsProcessed = written || stats.processed;

    // Log to CronJobLog
    await prisma.cronJobLog.create({
      data: {
        jobName,
        status: isSuccess ? "success" : "error",
        durationMs,
        recordsProcessed,
        message: isSuccess
          ? `Synced ${stats.synced} new, updated ${stats.updated} leads`
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
