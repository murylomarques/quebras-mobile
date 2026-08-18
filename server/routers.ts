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
        })
      )
      .mutation(async ({ input }) => {
        const existingAudit = await db.getBreakAuditByServiceAppointmentId(input.serviceAppointmentId);
        if (existingAudit) {
          throw new Error("Esta SA já foi concluída e possui uma auditoria registrada.");
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

        const auditId = await db.createBreakAudit({
          serviceAppointmentId: input.serviceAppointmentId,
          technicianCsso: input.technicianCsso,
          reason: input.reason,
          evidenceUrl: storedEvidence.url,
          evidenceKey: storedEvidence.key,
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          capturedAt: input.capturedAt || new Date().toISOString(),
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
