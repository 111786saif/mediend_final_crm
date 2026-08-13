import { PrismaClient, type Prisma, UserRole } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

export type WorkspacePrisma = PrismaClient

export function createSourcePrisma(): WorkspacePrisma {
  const url = process.env.SOURCE_DATABASE_URL
  if (!url) {
    throw new Error('SOURCE_DATABASE_URL is required (old workspace Postgres connection string)')
  }
  const adapter = new PrismaPg({
    connectionString: url,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
  })
  return new PrismaClient({ adapter, log: ['error'] })
}

/** Parse YYYY-MM-DD as IST midnight → UTC Date. */
export function parseIstDate(s: string): Date {
  const d = new Date(`${s}T00:00:00+05:30`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${s} (expected YYYY-MM-DD)`)
  }
  return d
}

export function parseCliDates(argv: string[]): { from: Date; toExclusive: Date } {
  const fromIdx = argv.indexOf('--from')
  const toIdx = argv.indexOf('--to')
  const fromStr = fromIdx >= 0 ? argv[fromIdx + 1] : '2026-08-08'
  const toStr = toIdx >= 0 ? argv[toIdx + 1] : '2026-08-13'
  if (!fromStr || !toStr) throw new Error('--from and --to require YYYY-MM-DD values')

  const from = parseIstDate(fromStr)
  const toEnd = parseIstDate(toStr)
  const toExclusive = new Date(toEnd.getTime() + 24 * 60 * 60 * 1000)
  return { from, toExclusive }
}

export function parseLeadRefFilter(argv: string[]): string[] | null {
  const idx = argv.indexOf('--lead-ref')
  if (idx === -1) return null
  const raw = argv[idx + 1]
  if (!raw) throw new Error('--lead-ref requires a comma-separated list')
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

/** Map source User.id → target User.id by email; fallback to admin. */
export async function buildUserIdMap(
  source: WorkspacePrisma,
  target: WorkspacePrisma
): Promise<{ map: Map<string, string>; fallbackUserId: string }> {
  const [sourceUsers, targetUsers, fallback] = await Promise.all([
    source.user.findMany({ select: { id: true, email: true } }),
    target.user.findMany({ select: { id: true, email: true } }),
    target.user.findFirst({ where: { role: UserRole.ADMIN }, select: { id: true } }),
  ])

  if (!fallback) throw new Error('No ADMIN user on target database')

  const targetByEmail = new Map(targetUsers.map((u) => [u.email.toLowerCase(), u.id]))
  const map = new Map<string, string>()

  for (const u of sourceUsers) {
    const targetId = targetByEmail.get(u.email.toLowerCase())
    if (targetId) map.set(u.id, targetId)
  }

  return { map, fallbackUserId: fallback.id }
}

export function remapUserId(
  userId: string | null | undefined,
  userMap: Map<string, string>,
  fallbackUserId: string
): string | null {
  if (!userId) return null
  return userMap.get(userId) ?? fallbackUserId
}

/** Lead refs touched in [from, toExclusive) on source DB. */
export async function findLeadRefsInRange(
  source: WorkspacePrisma,
  from: Date,
  toExclusive: Date,
  leadRefFilter: string[] | null
): Promise<string[]> {
  if (leadRefFilter?.length) return [...new Set(leadRefFilter)]

  const rows = await source.$queryRaw<Array<{ leadRef: string }>>`
    SELECT DISTINCT l."leadRef" AS "leadRef"
    FROM "Lead" l
    WHERE
      (l."updatedDate" >= ${from} AND l."updatedDate" < ${toExclusive})
      OR (l."leadEntryDate" >= ${from} AND l."leadEntryDate" < ${toExclusive})
      OR (l."assignedDate" >= ${from} AND l."assignedDate" < ${toExclusive})
      OR (l."conversionDate" >= ${from} AND l."conversionDate" < ${toExclusive})
      OR (l."followUpDate" >= ${from} AND l."followUpDate" < ${toExclusive})
      OR (l."createdDate" >= ${from} AND l."createdDate" < ${toExclusive})
      OR EXISTS (
        SELECT 1 FROM "CaseStageHistory" h
        WHERE h."leadId" = l.id AND h."changedAt" >= ${from} AND h."changedAt" < ${toExclusive}
      )
      OR EXISTS (
        SELECT 1 FROM "LeadStageEvent" e
        WHERE e."leadId" = l.id AND e."changedAt" >= ${from} AND e."changedAt" < ${toExclusive}
      )
      OR EXISTS (
        SELECT 1 FROM "LeadRemarkEntry" r
        WHERE r."leadId" = l.id AND r."createdAt" >= ${from} AND r."createdAt" < ${toExclusive}
      )
      OR EXISTS (
        SELECT 1 FROM "CallNote" c
        WHERE c."leadId" = l.id AND c."createdAt" >= ${from} AND c."createdAt" < ${toExclusive}
      )
      OR EXISTS (
        SELECT 1 FROM "CaseChatMessage" m
        WHERE m."leadId" = l.id AND m."createdAt" >= ${from} AND m."createdAt" < ${toExclusive}
      )
      OR EXISTS (
        SELECT 1 FROM "KYPSubmission" k
        WHERE k."leadId" = l.id
          AND (k."updatedAt" >= ${from} AND k."updatedAt" < ${toExclusive}
            OR k."submittedAt" >= ${from} AND k."submittedAt" < ${toExclusive})
      )
      OR EXISTS (
        SELECT 1 FROM "ComplianceCall" cc
        WHERE cc."leadId" = l.id
          AND (cc."updatedAt" >= ${from} AND cc."updatedAt" < ${toExclusive}
            OR cc."createdAt" >= ${from} AND cc."createdAt" < ${toExclusive})
      )
      OR EXISTS (
        SELECT 1 FROM "LeadRemark" lr
        WHERE lr."leadRef" = l."leadRef"
          AND lr."updateDate" >= ${from} AND lr."updateDate" < ${toExclusive}
      )
    ORDER BY l."leadRef"
  `

  return rows.map((r) => r.leadRef)
}

/** Remove all lead-scoped rows on target before overwrite. */
export async function deleteTargetLeadBundle(tx: Prisma.TransactionClient, targetLeadId: string) {
  const kyp = await tx.kYPSubmission.findUnique({
    where: { leadId: targetLeadId },
    select: { id: true, preAuthData: { select: { id: true } } },
  })

  if (kyp?.preAuthData) {
    await tx.preAuthPDF.deleteMany({ where: { preAuthorizationId: kyp.preAuthData.id } })
    await tx.insuranceQuery.deleteMany({ where: { preAuthorizationId: kyp.preAuthData.id } })
    await tx.hospitalSuggestion.deleteMany({ where: { preAuthId: kyp.preAuthData.id } })
    await tx.preAuthorization.deleteMany({ where: { id: kyp.preAuthData.id } })
  }

  await tx.dischargeSheet.deleteMany({ where: { leadId: targetLeadId } })
  await tx.kYPSubmission.deleteMany({ where: { leadId: targetLeadId } })

  const admission = await tx.admissionRecord.findUnique({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  if (admission) {
    await tx.admissionRecordImplantUsage.deleteMany({ where: { admissionRecordId: admission.id } })
    await tx.admissionRecordPrescriptionImage.deleteMany({ where: { admissionRecordId: admission.id } })
    await tx.admissionRecord.deleteMany({ where: { id: admission.id } })
  }

  const opdApps = await tx.leadOpdAppointment.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const app of opdApps) {
    await tx.leadOpdAppointmentPrescriptionImage.deleteMany({ where: { opdAppointmentId: app.id } })
  }
  await tx.leadOpdAppointment.deleteMany({ where: { leadId: targetLeadId } })

  const invoices = await tx.invoiceRequest.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const inv of invoices) {
    await tx.invoiceRequestActivity.deleteMany({ where: { requestId: inv.id } })
  }
  await tx.invoiceRequest.deleteMany({ where: { leadId: targetLeadId } })

  const payoffs = await tx.doctorPayoffRequest.findMany({
    where: { leadId: targetLeadId },
    select: { id: true },
  })
  for (const p of payoffs) {
    await tx.doctorPayoffRequestActivity.deleteMany({ where: { requestId: p.id } })
  }
  await tx.doctorPayoffRequest.deleteMany({ where: { leadId: targetLeadId } })

  await tx.paymentInstallment.deleteMany({ where: { leadId: targetLeadId } })
  await tx.caseChatMessage.deleteMany({ where: { leadId: targetLeadId } })
  await tx.chatReadReceipt.deleteMany({ where: { leadId: targetLeadId } })
  await tx.complianceCall.deleteMany({ where: { leadId: targetLeadId } })
  await tx.outstandingCase.deleteMany({ where: { leadId: targetLeadId } })
  await tx.pLRecord.deleteMany({ where: { leadId: targetLeadId } })
  await tx.insuranceInitiateForm.deleteMany({ where: { leadId: targetLeadId } })
  await tx.insuranceCase.deleteMany({ where: { leadId: targetLeadId } })
  await tx.workflowResetLog.deleteMany({ where: { leadId: targetLeadId } })
  await tx.caseStageHistory.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadStageEvent.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadRemarkEntry.deleteMany({ where: { leadId: targetLeadId } })
  await tx.callNote.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadOpdPrescriptionImage.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadQrCallAuditLog.deleteMany({ where: { leadId: targetLeadId } })
  await tx.leadQrPublicLink.deleteMany({ where: { leadId: targetLeadId } })
  await tx.crmAssignmentPreviewLog.deleteMany({ where: { leadId: targetLeadId } })
}

export async function copyLeadBundle(
  source: WorkspacePrisma,
  target: WorkspacePrisma,
  leadRef: string,
  userMap: Map<string, string>,
  fallbackUserId: string
): Promise<'synced' | 'skipped'> {
  const sourceLead = await source.lead.findUnique({ where: { leadRef } })
  if (!sourceLead) return 'skipped'

  const targetLead = await target.lead.findUnique({ where: { leadRef } })
  if (!targetLead) return 'skipped'

  const sourceLeadId = sourceLead.id
  const targetLeadId = targetLead.id

  const treatmentMasterId =
    sourceLead.treatmentMasterId &&
    (await target.treatmentMaster.findUnique({ where: { id: sourceLead.treatmentMasterId }, select: { id: true } }))
      ? sourceLead.treatmentMasterId
      : null

  const { id: _sid, leadRef: _ref, ...leadScalars } = sourceLead
  const leadUpdate: Prisma.LeadUpdateInput = {
    ...leadScalars,
    treatmentMasterId,
    bdId: remapUserId(sourceLead.bdId, userMap, fallbackUserId)!,
    createdById: remapUserId(sourceLead.createdById, userMap, fallbackUserId)!,
    updatedById: remapUserId(sourceLead.updatedById, userMap, fallbackUserId)!,
  }

  await target.$transaction(
    async (tx) => {
      await deleteTargetLeadBundle(tx, targetLeadId)

      await tx.lead.update({
        where: { id: targetLeadId },
        data: leadUpdate as Prisma.LeadUpdateInput,
      })

      // Legacy MySQL remarks (keyed by leadRef)
      const remarks = await source.leadRemark.findMany({ where: { leadRef } })
      if (remarks.length) {
        await tx.leadRemark.deleteMany({ where: { leadRef } })
        await tx.leadRemark.createMany({
          data: remarks.map(({ id: _id, ...r }) => r),
        })
      }

      const remarkEntries = await source.leadRemarkEntry.findMany({ where: { leadId: sourceLeadId } })
      if (remarkEntries.length) {
        await tx.leadRemarkEntry.createMany({
          data: remarkEntries.map(({ id, leadId: _l, createdById, ...r }) => ({
            id,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const callNotes = await source.callNote.findMany({ where: { leadId: sourceLeadId } })
      if (callNotes.length) {
        await tx.callNote.createMany({
          data: callNotes.map(({ id, leadId: _l, createdById, ...r }) => ({
            id,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const stageEvents = await source.leadStageEvent.findMany({ where: { leadId: sourceLeadId } })
      if (stageEvents.length) {
        await tx.leadStageEvent.createMany({
          data: stageEvents.map(({ id, leadId: _l, changedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            changedById: remapUserId(changedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const caseHistory = await source.caseStageHistory.findMany({ where: { leadId: sourceLeadId } })
      if (caseHistory.length) {
        await tx.caseStageHistory.createMany({
          data: caseHistory.map(({ id, leadId: _l, changedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            changedById: remapUserId(changedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const resetLogs = await source.workflowResetLog.findMany({ where: { leadId: sourceLeadId } })
      if (resetLogs.length) {
        await tx.workflowResetLog.createMany({
          data: resetLogs.map(({ id, leadId: _l, resetById, ...r }) => ({
            id,
            leadId: targetLeadId,
            resetById: remapUserId(resetById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const chatMessages = await source.caseChatMessage.findMany({ where: { leadId: sourceLeadId } })
      if (chatMessages.length) {
        await tx.caseChatMessage.createMany({
          data: chatMessages.map(({ id, leadId: _l, senderId, ...r }) => ({
            id,
            leadId: targetLeadId,
            senderId: remapUserId(senderId, userMap, fallbackUserId),
            ...r,
          })),
        })
      }

      const readReceipts = await source.chatReadReceipt.findMany({ where: { leadId: sourceLeadId } })
      if (readReceipts.length) {
        await tx.chatReadReceipt.createMany({
          data: readReceipts.map(({ id, leadId: _l, userId, ...r }) => ({
            id,
            leadId: targetLeadId,
            userId: remapUserId(userId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const kyp = await source.kYPSubmission.findUnique({
        where: { leadId: sourceLeadId },
        include: {
          preAuthData: {
            include: {
              suggestedHospitals: true,
              queries: true,
              pdfVersions: true,
            },
          },
        },
      })

      if (kyp) {
        const { preAuthData, leadId: _l, submittedById, ...kypRest } = kyp
        await tx.kYPSubmission.create({
          data: {
            ...kypRest,
            leadId: targetLeadId,
            submittedById: remapUserId(submittedById, userMap, fallbackUserId)!,
          },
        })

        if (preAuthData) {
          const {
            suggestedHospitals,
            queries,
            pdfVersions,
            kypSubmissionId: _k,
            preAuthRaisedById,
            handledById,
            heldById,
            ...preAuthRest
          } = preAuthData

          await tx.preAuthorization.create({
            data: {
              ...preAuthRest,
              preAuthRaisedById: remapUserId(preAuthRaisedById, userMap, fallbackUserId),
              handledById: remapUserId(handledById, userMap, fallbackUserId),
              heldById: remapUserId(heldById, userMap, fallbackUserId),
            },
          })

          if (suggestedHospitals.length) {
            await tx.hospitalSuggestion.createMany({ data: suggestedHospitals.map(({ id, preAuthId: _p, ...h }) => ({ id, preAuthId: preAuthData.id, ...h })) })
          }
          if (queries.length) {
            await tx.insuranceQuery.createMany({
              data: queries.map(({ id, preAuthorizationId: _p, raisedById, answeredById, ...q }) => ({
                id,
                preAuthorizationId: preAuthData.id,
                raisedById: remapUserId(raisedById, userMap, fallbackUserId)!,
                answeredById: remapUserId(answeredById, userMap, fallbackUserId),
                ...q,
              })),
            })
          }
          if (pdfVersions.length) {
            await tx.preAuthPDF.createMany({
              data: pdfVersions.map(({ id, preAuthorizationId: _p, createdById, ...p }) => ({
                id,
                preAuthorizationId: preAuthData.id,
                createdById: remapUserId(createdById, userMap, fallbackUserId)!,
                ...p,
              })),
            })
          }
        }
      }

      const insuranceCase = await source.insuranceCase.findUnique({ where: { leadId: sourceLeadId } })
      if (insuranceCase) {
        const { leadId: _l, handledById, ...rest } = insuranceCase
        await tx.insuranceCase.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            handledById: remapUserId(handledById, userMap, fallbackUserId),
          },
        })
      }

      const initiateForm = await source.insuranceInitiateForm.findUnique({ where: { leadId: sourceLeadId } })
      if (initiateForm) {
        const { leadId: _l, createdById, ...rest } = initiateForm
        await tx.insuranceInitiateForm.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId)!,
          },
        })
      }

      const admission = await source.admissionRecord.findUnique({
        where: { leadId: sourceLeadId },
        include: { implantUsages: true, prescriptionImages: true },
      })
      if (admission) {
        const { implantUsages, prescriptionImages, leadId: _l, initiatedById, ...rest } = admission
        await tx.admissionRecord.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            initiatedById: remapUserId(initiatedById, userMap, fallbackUserId)!,
          },
        })
        if (implantUsages.length) {
          await tx.admissionRecordImplantUsage.createMany({
            data: implantUsages.map(({ id, admissionRecordId: _a, ...u }) => ({ id, admissionRecordId: admission.id, ...u })),
          })
        }
        if (prescriptionImages.length) {
          await tx.admissionRecordPrescriptionImage.createMany({
            data: prescriptionImages.map(({ id, admissionRecordId: _a, ...u }) => ({ id, admissionRecordId: admission.id, ...u })),
          })
        }
      }

      const discharge = await source.dischargeSheet.findUnique({ where: { leadId: sourceLeadId } })
      if (discharge) {
        const { leadId: _l, ...rest } = discharge
        await tx.dischargeSheet.create({ data: { ...rest, leadId: targetLeadId } })
      }

      const pl = await source.pLRecord.findUnique({ where: { leadId: sourceLeadId } })
      if (pl) {
        const { leadId: _l, ...rest } = pl
        await tx.pLRecord.create({ data: { ...rest, leadId: targetLeadId } })
      }

      const outstanding = await source.outstandingCase.findUnique({ where: { leadId: sourceLeadId } })
      if (outstanding) {
        const { leadId: _l, ...rest } = outstanding
        await tx.outstandingCase.create({ data: { ...rest, leadId: targetLeadId } })
      }

      const compliance = await source.complianceCall.findUnique({ where: { leadId: sourceLeadId } })
      if (compliance) {
        const { leadId: _l, calledByUserId, ...rest } = compliance
        await tx.complianceCall.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            calledByUserId: remapUserId(calledByUserId, userMap, fallbackUserId),
          },
        })
      }

      const opdImages = await source.leadOpdPrescriptionImage.findMany({ where: { leadId: sourceLeadId } })
      if (opdImages.length) {
        await tx.leadOpdPrescriptionImage.createMany({
          data: opdImages.map(({ id, leadId: _l, ...r }) => ({ id, leadId: targetLeadId, ...r })),
        })
      }

      const opdApps = await source.leadOpdAppointment.findMany({
        where: { leadId: sourceLeadId },
        include: { prescriptionImages: true },
      })
      for (const app of opdApps) {
        const { prescriptionImages, leadId: _l, createdById, updatedById, ...rest } = app
        await tx.leadOpdAppointment.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            createdById: remapUserId(createdById, userMap, fallbackUserId),
            updatedById: remapUserId(updatedById, userMap, fallbackUserId),
          },
        })
        if (prescriptionImages.length) {
          await tx.leadOpdAppointmentPrescriptionImage.createMany({
            data: prescriptionImages.map(({ id, opdAppointmentId: _a, ...r }) => ({ id, opdAppointmentId: app.id, ...r })),
          })
        }
      }

      const installments = await source.paymentInstallment.findMany({ where: { leadId: sourceLeadId } })
      if (installments.length) {
        await tx.paymentInstallment.createMany({
          data: installments.map(({ id, leadId: _l, recordedById, ...r }) => ({
            id,
            leadId: targetLeadId,
            recordedById: remapUserId(recordedById, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const invoices = await source.invoiceRequest.findMany({
        where: { leadId: sourceLeadId },
        include: { activityLogs: true },
      })
      for (const inv of invoices) {
        const { activityLogs, leadId: _l, requestedById, reviewedById, ...rest } = inv
        await tx.invoiceRequest.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            requestedById: remapUserId(requestedById, userMap, fallbackUserId)!,
            reviewedById: remapUserId(reviewedById, userMap, fallbackUserId),
          },
        })
        if (activityLogs.length) {
          await tx.invoiceRequestActivity.createMany({
            data: activityLogs.map(({ id, requestId: _r, actorId, ...a }) => ({
              id,
              requestId: inv.id,
              actorId: remapUserId(actorId, userMap, fallbackUserId)!,
              ...a,
            })),
          })
        }
      }

      const payoffs = await source.doctorPayoffRequest.findMany({
        where: { leadId: sourceLeadId },
        include: { activityLogs: true },
      })
      for (const p of payoffs) {
        const { activityLogs, leadId: _l, requestedById, reviewedById, ...rest } = p
        await tx.doctorPayoffRequest.create({
          data: {
            ...rest,
            leadId: targetLeadId,
            requestedById: remapUserId(requestedById, userMap, fallbackUserId)!,
            reviewedById: remapUserId(reviewedById, userMap, fallbackUserId),
          },
        })
        if (activityLogs.length) {
          await tx.doctorPayoffRequestActivity.createMany({
            data: activityLogs.map(({ id, requestId: _r, actorId, ...a }) => ({
              id,
              requestId: p.id,
              actorId: remapUserId(actorId, userMap, fallbackUserId)!,
              ...a,
            })),
          })
        }
      }

      const qrLogs = await source.leadQrCallAuditLog.findMany({ where: { leadId: sourceLeadId } })
      if (qrLogs.length) {
        await tx.leadQrCallAuditLog.createMany({
          data: qrLogs.map(({ id, leadId: _l, userId, ...r }) => ({
            id,
            leadId: targetLeadId,
            userId: remapUserId(userId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const qrLinks = await source.leadQrPublicLink.findMany({ where: { leadId: sourceLeadId } })
      if (qrLinks.length) {
        await tx.leadQrPublicLink.createMany({
          data: qrLinks.map(({ id, leadId: _l, actorUserId, ...r }) => ({
            id,
            leadId: targetLeadId,
            actorUserId: remapUserId(actorUserId, userMap, fallbackUserId)!,
            ...r,
          })),
        })
      }

      const previewLogs = await source.crmAssignmentPreviewLog.findMany({ where: { leadId: sourceLeadId } })
      if (previewLogs.length) {
        await tx.crmAssignmentPreviewLog.createMany({
          data: previewLogs.map(({ id, leadId: _l, ...r }) => ({ id, leadId: targetLeadId, ...r })),
        })
      }
    },
    { timeout: 120_000 }
  )

  return 'synced'
}
