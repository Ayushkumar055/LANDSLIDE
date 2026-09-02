const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function cleanup() {
  try {
    console.log("Deleting old database data...");

    await prisma.alertLog.deleteMany();
    console.log("✓ Old alerts deleted");

    await prisma.sosReport.deleteMany();
    console.log("✓ Old SOS reports deleted");

    await prisma.shelter.deleteMany();
    console.log("✓ Old shelters deleted");

    await prisma.hotspot.deleteMany();
    console.log("✓ Old hotspots deleted");

    console.log("\nDatabase cleaned successfully!");
  } catch (error) {
    console.error("Cleanup error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();