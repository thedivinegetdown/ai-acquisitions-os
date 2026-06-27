import { createClient } from "@supabase/supabase-js";
import { appConfig, validateClientConfig } from "./services/config";
import { logger } from "./services/logging";

const configValidation = validateClientConfig();

if (!configValidation.success) {
  logger.error("[config] Missing required client environment variables", {
    missing: configValidation.missing,
  });
}

export const supabase = createClient(
  appConfig.supabase.url || "",
  appConfig.supabase.anonKey || "",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  }
);
