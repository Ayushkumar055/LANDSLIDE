// backend/cleanup.js
require('dotenv').config();
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function cleanup() {
  const count = await prisma.hotspot.count();
  console.log(`Before cleanup: ${count} hotspots`);

  await prisma.hotspot.deleteMany({});

  const after = await prisma.hotspot.count();
  console.log(`After cleanup: ${after} hotspots`);
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect());