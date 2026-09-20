// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";

function requirePublicSupabaseBuildEnv(): Plugin {
  return {
    name: "require-public-supabase-build-env",
    apply: "build",
    config(_, { mode }) {
      const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
      const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"].filter(
        (name) => !env[name]?.trim(),
      );

      if (missing.length > 0) {
        throw new Error(`Production build requires: ${missing.join(", ")}`);
      }

      return {
        define: {
          "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env["VITE_SUPABASE_URL"]),
          "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
            env["VITE_SUPABASE_PUBLISHABLE_KEY"],
          ),
        },
      };
    },
  };
}

export default defineConfig({
  plugins: [requirePublicSupabaseBuildEnv()],
  vite: {
    resolve: {
      alias: [
        {
          find: /^@\/integrations\/supabase\/client$/,
          replacement: path.resolve("src/integrations/supabase/browser-client.ts"),
        },
        {
          find: /^\.\.\/supabase\/client$/,
          replacement: path.resolve("src/integrations/supabase/browser-client.ts"),
        },
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
