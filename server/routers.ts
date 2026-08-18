import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  breaks: router({
    listByCsso: publicProcedure
      .input(z.object({ technicianCsso: z.string().min(1) }))
      .query(async ({ input }) => {
        const audits = await db.getBreakAuditsByCsso(input.technicianCsso);
        return audits.map((audit) => ({
          serviceAppointmentId: audit.serviceAppointmentId,
          auditId: audit.id,
          status: audit.status,
          reason: audit.reason,
          capturedAt: audit.capturedAt,
        }));
      }),
    submit: publicProcedure
      .input(
        z.object({
          serviceAppointmentId: z.string(),
          technicianCsso: z.string(),
          reason: z.string(),
          evidenceUrl: z.string().optional(),
          evidenceBase64: z.string().max(8_000_000).optional(),
          evidenceMimeType: z.string().default("image/jpeg"),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          capturedAt: z.string().optional(),
          imageWidth: z.number().optional(),
          imageHeight: z.number().optional(),
          imageOrientation: z.string().optional(),
          exifTimestamp: z.string().optional(),
          exifGpsLat: z.string().optional(),
          exifGpsLng: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const existingAudit = await db.getBreakAuditByServiceAppointmentId(input.serviceAppointmentId);
        if (existingAudit) {
          return {
            success: true,
            auditId: existingAudit.id,
            message: "Esta SA já estava concluída e auditada anteriormente.",
          };
        }

        if (!input.evidenceBase64 && !input.evidenceUrl) {
          throw new Error("Evidence image is required");
        }

        const storedEvidence = input.evidenceBase64
          ? await storagePut(
              `break-audits/${input.serviceAppointmentId}.jpg`,
              Buffer.from(input.evidenceBase64, "base64"),
              input.evidenceMimeType,
            )
          : { key: null, url: input.evidenceUrl as string };

        const generateUuidV7 = () => {
          const now = Date.now();
          const timeHex = now.toString(16).padStart(12, '0');
          const randHex1 = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
          const randHex2 = (Math.floor(Math.random() * 0x3fff) | 0x8000).toString(16).padStart(4, '0');
          const randHex3 = Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
          const randHex4 = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
          return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${randHex1.slice(1)}-${randHex2}-${randHex3}${randHex4}`;
        };

        const auditId = generateUuidV7();

        const auditIdResult = await db.createBreakAudit({
          id: auditId,
          serviceAppointmentId: input.serviceAppointmentId,
          technicianCsso: input.technicianCsso,
          reason: input.reason,
          evidenceUrl: storedEvidence.url,
          evidenceKey: storedEvidence.key,
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          capturedAt: input.capturedAt || new Date().toISOString(),
          imageWidth: input.imageWidth ?? null,
          imageHeight: input.imageHeight ?? null,
          imageOrientation: input.imageOrientation || null,
          exifTimestamp: input.exifTimestamp || null,
          exifGpsLat: input.exifGpsLat || null,
          exifGpsLng: input.exifGpsLng || null,
          status: "completed",
        });

        await notifyOwner({
          title: `Nova Quebra Registrada - SA ${input.serviceAppointmentId}`,
          content: `Técnico CSSO: ${input.technicianCsso}\nMotivo: ${input.reason}\nGPS: ${input.latitude || 'N/D'}, ${input.longitude || 'N/D'}\nStatus: Concluída e Auditada`,
        }).catch(() => {});

        return {
          success: true,
          auditId,
          message: "Quebra registrada e auditada com sucesso no backend da DESKTOP.",
        };
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
