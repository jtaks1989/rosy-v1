import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachBrowserSupabaseAuth } from "@/integrations/supabase/browser-auth-attacher";

// Some external hosts (e.g. Vercel projects configured with only the VITE_*
// public values) do not define the server-side names the generated Supabase
// server modules read. The project URL and publishable key are public values,
// so mirroring them is safe. The service-role key is never mirrored.
function normalizeServerSupabaseEnv() {
  try {
    const env = process.env as Record<string, string | undefined>;
    if (!env["SUPABASE_URL"] && env["VITE_SUPABASE_URL"]) {
      env["SUPABASE_URL"] = env["VITE_SUPABASE_URL"];
    }
    if (!env["SUPABASE_PUBLISHABLE_KEY"] && env["VITE_SUPABASE_PUBLISHABLE_KEY"]) {
      env["SUPABASE_PUBLISHABLE_KEY"] = env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    }
  } catch {
    // Read-only env in some runtimes: the server names are already provided there.
  }
}

normalizeServerSupabaseEnv();

const supabaseEnvMiddleware = createMiddleware().server(async ({ next }) => {
  normalizeServerSupabaseEnv();
  return await next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachBrowserSupabaseAuth],
  requestMiddleware: [supabaseEnvMiddleware, errorMiddleware, csrfMiddleware],
}));
