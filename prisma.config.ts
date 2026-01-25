/// <reference types="node" />
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations"
  },
  datasource: {
    // Tolerant for `prisma generate` when env isn't set.
    url: process.env.DATABASE_URL ?? ""
  }
});

