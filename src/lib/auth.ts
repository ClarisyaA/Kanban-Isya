import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/**
 * On Vercel production, always use the project's production domain so the OAuth flow starts
 * and ends on the same origin (a mismatch loses the state cookie → "state_mismatch").
 * Elsewhere fall back to BETTER_AUTH_URL.
 */
export const productionHost =
  process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : undefined;

export const auth = betterAuth({
  baseURL: productionHost ? `https://${productionHost}` : process.env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  // Signing in with Google using an email that already registered with a password
  // links both methods to the same account instead of failing.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  plugins: [nextCookies()],
});
