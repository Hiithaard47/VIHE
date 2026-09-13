import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PERMISSION_DEFINITIONS, DEFAULT_ROLES } from "../src/lib/permissions";
import {
  DEFAULT_SESSION_CATEGORY_MIN_PERCENT,
  DEFAULT_SESSION_CATEGORY_NAME,
} from "../src/lib/session-categories";

const prisma = new PrismaClient();

async function main() {
  for (const perm of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description },
      create: perm,
    });
  }

  for (const roleDef of DEFAULT_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description, isSystem: roleDef.isSystem },
      create: { name: roleDef.name, description: roleDef.description, isSystem: roleDef.isSystem },
    });

    const permissions = await prisma.permission.findMany({ where: { key: { in: roleDef.permissions } } });

    // Grant defaults that are missing. Never strip grants an admin added.
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  await prisma.sessionCategory.upsert({
    where: { name: DEFAULT_SESSION_CATEGORY_NAME },
    update: { isSystem: true, isActive: true },
    create: {
      name: DEFAULT_SESSION_CATEGORY_NAME,
      minAttendancePercent: DEFAULT_SESSION_CATEGORY_MIN_PERCENT,
      isSystem: true,
    },
  });

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "Admin" } });
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { name: "Admin", email: adminEmail, passwordHash },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });

    console.log(`Seeded admin user: ${adminEmail}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipped admin user creation.");
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
