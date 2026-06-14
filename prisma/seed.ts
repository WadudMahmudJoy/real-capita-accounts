import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";

const ACCOUNTANT_ROLE_CODE = "ACCOUNTANT";
const ACCOUNTANT_EMAIL = "accountant@realcapita.local";
const DEVELOPMENT_PASSWORD = "ChangeMe123!";

const SYSTEM_ACCOUNT_CLASSES = [
  { code: "ASSET" as const, name: "Asset", normalBalance: "DEBIT" as const },
  { code: "LIABILITY" as const, name: "Liability", normalBalance: "CREDIT" as const },
  { code: "EQUITY" as const, name: "Equity", normalBalance: "CREDIT" as const },
  { code: "INCOME" as const, name: "Income", normalBalance: "CREDIT" as const },
  { code: "EXPENSE" as const, name: "Expense", normalBalance: "DEBIT" as const },
];

async function seedAccountClasses(prisma: PrismaClient) {
  let created = 0;

  for (const acc of SYSTEM_ACCOUNT_CLASSES) {
    await prisma.accountClass.upsert({
      create: {
        code: acc.code,
        name: acc.name,
        normalBalance: acc.normalBalance,
      },
      update: {
        name: acc.name,
        normalBalance: acc.normalBalance,
      },
      where: { code: acc.code },
    });
    created++;
  }

  console.log(`Seeded ${created} system AccountClass records.`);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run development seed in production.");
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the seed.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const unconfirmedRoles = await prisma.role.findMany({
      select: { code: true },
      where: {
        code: {
          not: ACCOUNTANT_ROLE_CODE,
        },
      },
    });

    if (unconfirmedRoles.length > 0) {
      const codes = unconfirmedRoles.map((role) => role.code).join(", ");
      throw new Error(
        `Unconfirmed roles already exist in the database: ${codes}. Resolve this before seeding Phase 1A.`,
      );
    }

    const role = await prisma.role.upsert({
      create: {
        code: ACCOUNTANT_ROLE_CODE,
        name: "Accountant",
        description:
          "Development-only Accountant role for the confirmed Phase 1A operator.",
      },
      update: {
        name: "Accountant",
        description:
          "Development-only Accountant role for the confirmed Phase 1A operator.",
      },
      where: { code: ACCOUNTANT_ROLE_CODE },
    });

    const passwordHash = await hash(DEVELOPMENT_PASSWORD, 12);

    const user = await prisma.user.upsert({
      create: {
        email: ACCOUNTANT_EMAIL,
        fullName: "Accountant User",
        passwordHash,
        isActive: true,
      },
      update: {
        fullName: "Accountant User",
        passwordHash,
        isActive: true,
      },
      where: { email: ACCOUNTANT_EMAIL },
    });

    await prisma.userRole.upsert({
      create: {
        userId: user.id,
        roleId: role.id,
      },
      update: {},
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    // Phase 2A: Seed fixed AccountClass system reference data.
    await seedAccountClasses(prisma);

    console.log("Development seed complete.");
    console.log(`Seeded role: ${ACCOUNTANT_ROLE_CODE}`);
    console.log(`Seeded user: ${ACCOUNTANT_EMAIL}`);
    console.log("Seed password: ChangeMe123! (development only)");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
