function readEnv(name, fallback = "") {
  return import.meta.env[name] ?? fallback;
}

export const appConfig = {
  environment: readEnv("MODE", "development"),
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  apiBasePath: readEnv("VITE_NETLIFY_FUNCTIONS_BASE", "/.netlify/functions"),
  supabase: {
    url: readEnv("VITE_SUPABASE_URL"),
    anonKey: readEnv("VITE_SUPABASE_ANON_KEY"),
  },
};

export function validateClientConfig() {
  const missing = [];

  if (!appConfig.supabase.url) missing.push("VITE_SUPABASE_URL");
  if (!appConfig.supabase.anonKey) missing.push("VITE_SUPABASE_ANON_KEY");

  return {
    success: missing.length === 0,
    missing,
  };
}
