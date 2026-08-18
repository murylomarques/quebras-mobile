import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "@/server/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        async fetch(url, options) {
          try {
            const response = await fetch(url, {
              ...options,
              credentials: "include",
            });

            const contentType = response.headers.get("content-type") ?? "";
            if (!response.ok || !contentType.includes("application/json")) {
              const rawBody = await response.clone().text().catch(() => "");
              let detail = rawBody.replace(/\s+/g, " ").trim().slice(0, 240);
              try {
                const parsed = JSON.parse(rawBody);
                detail = parsed?.[0]?.error?.json?.message ?? parsed?.error?.json?.message ?? detail;
              } catch {
                // Keep the compact response body when the server returned non-JSON.
              }
              throw new Error(
                `Servidor de auditoria indisponível (${response.status}). ${detail || "Verifique a conexão e tente novamente."}`,
              );
            }

            return response;
          } catch (error) {
            if (error instanceof Error) throw error;
            throw new Error("Não foi possível conectar ao servidor de auditoria.");
          }
        },
      }),
    ],
  });
}
