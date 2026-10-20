import { runtimeDatabaseUrl, assertRuntimeDatabase } from "./database-security";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = runtimeDatabaseUrl();

    super({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      await assertRuntimeDatabase(sql => this.$queryRawUnsafe(sql), process.env.RUNTIME_DATABASE_NAME!);
    } catch {
      await this.$disconnect();
      throw new Error("Runtime database startup acceptance failed; no privileged fallback is permitted.");
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
