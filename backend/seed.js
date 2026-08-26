const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hotspots = [
    { name: 'Aizawl', state: 'Mizoram', lat: 23.7271, lng: 92.7176, baseRainfall: 142, slope: 43, soilStability: 'High', elevation: 1132 },
    { name: 'Gangtok', state: 'Sikkim', lat: 27.3389, lng: 88.6065, baseRainfall: 118, slope: 39, soilStability: 'High', elevation: 1650 },
    { name: 'Itanagar', state: 'Arunachal Pradesh', lat: 27.0844, lng: 93.6053, baseRainfall: 104, slope: 36, soilStability: 'Moderate', elevation: 750 },
    { name: 'Shillong Ridge', state: 'Meghalaya', lat: 25.5788, lng: 91.8933, baseRainfall: 96, slope: 31, soilStability: 'Moderate', elevation: 1496 },
    { name: 'Kohima Bypass', state: 'Nagaland', lat: 25.6751, lng: 94.1086, baseRainfall: 82, slope: 27, soilStability: 'Moderate', elevation: 1261 },
    { name: 'Tawang Pass', state: 'Arunachal Pradesh', lat: 27.5861, lng: 91.8594, baseRainfall: 125, slope: 48, soilStability: 'Low', elevation: 3048 },
    { name: 'Guwahati Hills', state: 'Assam', lat: 26.1445, lng: 91.7362, baseRainfall: 73, slope: 18, soilStability: 'Low', elevation: 55 }
  ];

  for (const item of hotspots) {
    await prisma.hotspot.create({ data: item });
  }

  const shelters = [
    { name: 'Aizawl Govt. Higher Secondary School', state: 'Mizoram', type: 'School', lat: 23.7367, lng: 92.7205, capacity: 400, contact: 'DC Office Aizawl' },
    { name: 'Zemabawk Community Hall', state: 'Mizoram', type: 'Community Hall', lat: 23.7601, lng: 92.7530, capacity: 250, contact: 'Local SDMA Unit' },
    { name: 'Gangtok District Administrative Centre', state: 'Sikkim', type: 'Govt Building', lat: 27.3314, lng: 88.6138, capacity: 350, contact: 'SDMA Sikkim' },
    { name: 'Tadong Relief Camp (SMIT Grounds)', state: 'Sikkim', type: 'Relief Camp', lat: 27.2967, lng: 88.5993, capacity: 500, contact: 'NDRF 12th Bn' },
    { name: 'Itanagar Govt. Secondary School', state: 'Arunachal Pradesh', type: 'School', lat: 27.0940, lng: 93.6180, capacity: 300, contact: 'DC Office Papum Pare' },
    { name: 'Tawang Monastery Relief Ground', state: 'Arunachal Pradesh', type: 'Relief Camp', lat: 27.5880, lng: 91.8580, capacity: 200, contact: 'SDRF Tawang' },
    { name: 'Shillong Civil Hospital Grounds', state: 'Meghalaya', type: 'Govt Building', lat: 25.5744, lng: 91.8825, capacity: 350, contact: 'SDMA Meghalaya' },
    { name: 'Kohima Town Hall', state: 'Nagaland', type: 'Community Hall', lat: 25.6701, lng: 94.1077, capacity: 280, contact: 'DDMA Kohima' },
    { name: 'Guwahati Sports Complex', state: 'Assam', type: 'Relief Camp', lat: 26.1520, lng: 91.7458, capacity: 600, contact: 'ASDMA Guwahati' }
  ];

  for (const item of shelters) {
    await prisma.shelter.create({ data: item });
  }

  await prisma.alertLog.create({
    data: {
      location: 'Aizawl, Mizoram',
      level: 'CRITICAL',
      score: 94,
      rainfall: 142,
      dispatchedTo: ['NDRF State Unit', 'District Disaster Authority', 'Automated SMS Gateway']
    }
  });

  console.log('✅ PostgreSQL Database seeded successfully!');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());