import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";
import { brokeredPreviewStorage } from "./previewAuthStorage";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing required public build configuration: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set before building.",
  );
}

function isOpaquePublishableKey(value: string): boolean {
  return value.startsWith("sb_publishable_");
}

function createSupabaseFetch(publishableKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (
      isOpaquePublishableKey(publishableKey) &&
      headers.get("Authorization") === `Bearer ${publishableKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", publishableKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  global: {
    fetch: createSupabaseFetch(supabasePublishableKey),
  },
  auth: {
    storage: brokeredPreviewStorage(),
    persistSession: true,
    autoRefreshToken: true,
  },
});