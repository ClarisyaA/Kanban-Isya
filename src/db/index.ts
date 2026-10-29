import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// prepare: false is required for Supabase's transaction pooler (port 6543), which is what
// serverless platforms like Vercel should connect through. One connection per instance is
// enough there; the pooler handles fan-out across instances.
const client =
  globalForDb.pgClient ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
