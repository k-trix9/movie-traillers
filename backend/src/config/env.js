import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_SSL: z.string().default("false"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must contain at least 32 characters"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:4000"),
  SESSION_COOKIE_NAME: z.string().default("filmora.sid"),
  FLW_SECRET_KEY: z.string().optional().default(""),
  FLW_WEBHOOK_SECRET: z.string().optional().default(""),
  FLW_REDIRECT_URL: z.string().url().optional().default("http://localhost:4000/api/billing/flutterwave/callback"),
  FLW_PAYMENT_OPTIONS: z.string().default("card"),
    TMDB_API_KEY: z.string().optional().default(""),
  CF_ACCOUNT_ID: z.string().optional().default(""),
  CF_API_TOKEN: z.string().optional().default(""),
  CF_CUSTOMER_CODE: z.string().optional().default(""),
  CF_ALLOWED_ORIGIN: z.string().optional().default(""),
  TRUST_CF_IP_COUNTRY: z.string().default("false"),
  DEFAULT_CURRENCY: z.string().length(3).default("USD"),
  ADMIN_EMAIL: z.string().email().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  DEV_PAYMENT_BYPASS: z.string().default("false")
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  DATABASE_SSL: parsed.data.DATABASE_SSL === "true",
  TRUST_CF_IP_COUNTRY: parsed.data.TRUST_CF_IP_COUNTRY === "true",
  // Local testing only: can never be enabled in production.
  DEV_PAYMENT_BYPASS: parsed.data.NODE_ENV === "development" && parsed.data.DEV_PAYMENT_BYPASS === "true"
};
