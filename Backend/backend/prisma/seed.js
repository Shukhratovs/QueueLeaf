import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      email: "staff@example.com",
      password: passwordHash,
      role: "staff",
    },
  });

  const queue = await prisma.queue.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Main Entrance Queue",
      isOpen: true,
      avgServiceSec: 300,
    },
  });

  console.log({ staff, queue });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
