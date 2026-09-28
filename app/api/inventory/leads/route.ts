import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest, getSessionWithFreshUser } from "@/lib/session";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = (await getSessionWithFreshUser()) || getSessionFromRequest(request);
    if (!session) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const ref = searchParams.get("ref")?.trim();
    const search = searchParams.get("search")?.trim();

    if (ref) {
      const lead = await prisma.lead.findFirst({
        where: {
          leadRef: {
            equals: ref,
            mode: "insensitive",
          },
        },
        select: {
          id: true,
          leadRef: true,
          patientName: true,
          circle: true,
          treatment: true,
          hospitalName: true,
          surgeonName: true,
          surgeryDate: true,
          modeOfPayment: true,
          bdeName: true,
          teamLeadId: true,
          bd: {
            select: {
              name: true,
              employee: {
                select: {
                  manager: {
                    select: {
                      user: {
                        select: {
                          name: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          treatmentMaster: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!lead) {
        return successResponse(null);
      }

      let managerName = lead.bd?.employee?.manager?.user?.name || "";
      if (!managerName && lead.teamLeadId) {
        const tlEmp = await prisma.employee.findFirst({
          where: { bdNumber: lead.teamLeadId },
          select: { user: { select: { name: true } } },
        });
        managerName = tlEmp?.user?.name || "";
      }

      return successResponse({
        id: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName || "",
        bdmName: lead.bd?.name || lead.bdeName || "",
        managerName,
        treatment: lead.treatmentMaster?.name || lead.treatment || "",
        circle: lead.circle || "",
        hospitalName: lead.hospitalName || "",
        drName: lead.surgeonName || "",
        surgeryDate: lead.surgeryDate ? lead.surgeryDate.toISOString().slice(0, 10) : "",
        mop: lead.modeOfPayment || "",
      });
    }

    const whereClause = search
      ? {
          OR: [
            { leadRef: { contains: search, mode: "insensitive" as const } },
            { patientName: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const leads = await prisma.lead.findMany({
      where: whereClause,
      take: 15,
      orderBy: { createdDate: "desc" },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        circle: true,
        treatment: true,
        hospitalName: true,
        surgeonName: true,
        surgeryDate: true,
        modeOfPayment: true,
        bdeName: true,
        teamLeadId: true,
        bd: {
          select: {
            name: true,
            employee: {
              select: {
                manager: {
                  select: {
                    user: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        treatmentMaster: {
          select: {
            name: true,
          },
        },
      },
    });

    const formatted = leads.map((lead) => ({
      id: lead.id,
      leadRef: lead.leadRef,
      patientName: lead.patientName || "",
      bdmName: lead.bd?.name || lead.bdeName || "",
      managerName: lead.bd?.employee?.manager?.user?.name || "",
      treatment: lead.treatmentMaster?.name || lead.treatment || "",
      circle: lead.circle || "",
      hospitalName: lead.hospitalName || "",
      drName: lead.surgeonName || "",
      surgeryDate: lead.surgeryDate ? lead.surgeryDate.toISOString().slice(0, 10) : "",
      mop: lead.modeOfPayment || "",
    }));

    return successResponse(formatted);
  } catch (error) {
    console.error("[API_ERROR] GET /api/inventory/leads:", error);
    return errorResponse("Failed to fetch lead information.", 500);
  }
}
