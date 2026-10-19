import { defineConfig } from "drizzle-kit";

/** Read by `bun run migrations`, which writes a new migration into `drizzle/`. */
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
