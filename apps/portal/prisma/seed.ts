import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_EMAIL = "demo@kairos.dev";
const DEMO_USER_NAME = "Demo User";

async function main() {
  console.log("Seeding database...");

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: {
      email: DEMO_USER_EMAIL,
      name: DEMO_USER_NAME,
      emailVerified: true,
    },
  });
  console.log(`  User: ${user.id} (${user.email})`);

  const existingMember = await prisma.member.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  let orgId: string;

  if (existingMember) {
    orgId = existingMember.organizationId;
    console.log(`  Organization already exists: ${orgId}`);
  } else {
    const org = await prisma.organization.create({
      data: {
        name: "Demo Organization",
        slug: `demo-org-${Date.now()}`,
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
        projects: {
          create: {
            name: "Demo Project",
            slug: `demo-project-${Date.now()}`,
          },
        },
      },
      select: { id: true },
    });
    orgId = org.id;
    console.log(`  Organization created: ${orgId}`);
  }

  const project = await prisma.project.findFirst({
    where: { organizationId: orgId },
    select: { id: true, name: true },
  });

  if (project) {
    console.log(`  Project: ${project.id} (${project.name})`);
  } else {
    const created = await prisma.project.create({
      data: {
        name: "Demo Project",
        slug: `demo-project-${Date.now()}`,
        organizationId: orgId,
      },
      select: { id: true, name: true },
    });
    console.log(`  Project created: ${created.id} (${created.name})`);
  }

  console.log("Seeding complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Seeding failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
