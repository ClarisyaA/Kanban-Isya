import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const googleEnabled = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
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
  // Allow Vercel preview deployments in addition to BETTER_AUTH_URL.
  trustedOrigins: process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [],
  plugins: [nextCookies()],
});
