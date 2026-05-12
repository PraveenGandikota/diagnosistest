const requiredEnv = (name: string) => {
  const value = import.meta.env[name];

  if (!value || String(value).includes("YOUR_")) {
    throw new Error(
      `Missing ${name}. Add your Supabase project value in diagnosetest/.env and restart the dev server.`,
    );
  }

  return value as string;
};

export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";
export const SUPABASE_URL = requiredEnv("VITE_SUPABASE_URL");
export const SUPABASE_PUBLISHABLE_KEY = requiredEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
