import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations should use the session/direct connection (port 5432).
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
