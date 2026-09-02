const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting NER database seeding...');

  // ==========================================
  // CLEAN EXISTING DEMO DATA
  // ==========================================

  await prisma.road.deleteMany();
  await prisma.alertLog.deleteMany();
  await prisma.sosReport.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.hotspot.deleteMany();

  console.log('🧹 Previous demo data cleared.');

  // ==========================================
  // NER LANDSLIDE HOTSPOTS
  // ==========================================

  const hotspots = [
    {
      name: 'Aizawl',
      state: 'Mizoram',
      lat: 23.7271,
      lng: 92.7176,
      baseRainfall: 142,
      slope: 43,
      soilStability: 'High',
      elevation: 1132
    },
    {
      name: 'Gangtok',
      state: 'Sikkim',
      lat: 27.3389,
      lng: 88.6065,
      baseRainfall: 118,
      slope: 39,
      soilStability: 'High',
      elevation: 1650
    },
    {
      name: 'Itanagar',
      state: 'Arunachal Pradesh',
      lat: 27.0844,
      lng: 93.6053,
      baseRainfall: 104,
      slope: 36,
      soilStability: 'Moderate',
      elevation: 750
    },
    {
      name: 'Shillong Ridge',
      state: 'Meghalaya',
      lat: 25.5788,
      lng: 91.8933,
      baseRainfall: 96,
      slope: 31,
      soilStability: 'Moderate',
      elevation: 1496
    },
    {
      name: 'Kohima Bypass',
      state: 'Nagaland',
      lat: 25.6751,
      lng: 94.1086,
      baseRainfall: 82,
      slope: 27,
      soilStability: 'Moderate',
      elevation: 1261
    },
    {
      name: 'Tawang Pass',
      state: 'Arunachal Pradesh',
      lat: 27.5861,
      lng: 91.8594,
      baseRainfall: 125,
      slope: 48,
      soilStability: 'Low',
      elevation: 3048
    },
    {
      name: 'Guwahati Hills',
      state: 'Assam',
      lat: 26.1445,
      lng: 91.7362,
      baseRainfall: 73,
      slope: 18,
      soilStability: 'Low',
      elevation: 55
    }
  ];

  for (const item of hotspots) {
    await prisma.hotspot.create({
      data: item
    });
  }

  console.log(`📍 ${hotspots.length} NER hotspots added.`);

  // ==========================================
  // SAFE SHELTERS
  // ==========================================

  const shelters = [
    {
      name: 'Aizawl Govt. Higher Secondary School',
      state: 'Mizoram',
      type: 'School',
      lat: 23.7367,
      lng: 92.7205,
      capacity: 400,
      contact: 'DC Office Aizawl'
    },
    {
      name: 'Zemabawk Community Hall',
      state: 'Mizoram',
      type: 'Community Hall',
      lat: 23.7601,
      lng: 92.7530,
      capacity: 250,
      contact: 'Local SDMA Unit'
    },
    {
      name: 'Gangtok District Administrative Centre',
      state: 'Sikkim',
      type: 'Govt Building',
      lat: 27.3314,
      lng: 88.6138,
      capacity: 350,
      contact: 'SDMA Sikkim'
    },
    {
      name: 'Tadong Relief Camp (SMIT Grounds)',
      state: 'Sikkim',
      type: 'Relief Camp',
      lat: 27.2967,
      lng: 88.5993,
      capacity: 500,
      contact: 'NDRF 12th Bn'
    },
    {
      name: 'Itanagar Govt. Secondary School',
      state: 'Arunachal Pradesh',
      type: 'School',
      lat: 27.0940,
      lng: 93.6180,
      capacity: 300,
      contact: 'DC Office Papum Pare'
    },
    {
      name: 'Tawang Monastery Relief Ground',
      state: 'Arunachal Pradesh',
      type: 'Relief Camp',
      lat: 27.5880,
      lng: 91.8580,
      capacity: 200,
      contact: 'SDRF Tawang'
    },
    {
      name: 'Shillong Civil Hospital Grounds',
      state: 'Meghalaya',
      type: 'Govt Building',
      lat: 25.5744,
      lng: 91.8825,
      capacity: 350,
      contact: 'SDMA Meghalaya'
    },
    {
      name: 'Kohima Town Hall',
      state: 'Nagaland',
      type: 'Community Hall',
      lat: 25.6701,
      lng: 94.1077,
      capacity: 280,
      contact: 'DDMA Kohima'
    },
    {
      name: 'Guwahati Sports Complex',
      state: 'Assam',
      type: 'Relief Camp',
      lat: 26.1520,
      lng: 91.7458,
      capacity: 600,
      contact: 'ASDMA Guwahati'
    }
  ];

  for (const item of shelters) {
    await prisma.shelter.create({
      data: item
    });
  }

  console.log(`🏠 ${shelters.length} safe shelters added.`);

  // ==========================================
  // NER ROAD CONNECTIVITY DATA
  // ==========================================

  const roads = [
    {
      name: 'NH-306',
      state: 'Mizoram',
      startPoint: 'Silchar',
      endPoint: 'Aizawl',
      status: 'RESTRICTED',
      riskLevel: 'HIGH',
      description:
        'Important connectivity corridor. Landslide-prone sections require continuous monitoring during heavy rainfall.',
      lat: 23.845,
      lng: 92.725
    },
    {
      name: 'Aizawl-Lunglei Road',
      state: 'Mizoram',
      startPoint: 'Aizawl',
      endPoint: 'Lunglei',
      status: 'OPEN',
      riskLevel: 'MODERATE',
      description:
        'Open for traffic with precautionary monitoring at vulnerable hill sections.',
      lat: 23.15,
      lng: 92.73
    },
    {
      name: 'NH-10',
      state: 'Sikkim',
      startPoint: 'Siliguri',
      endPoint: 'Gangtok',
      status: 'RESTRICTED',
      riskLevel: 'HIGH',
      description:
        'Major access route to Gangtok. Traffic restrictions may be imposed during intense rainfall.',
      lat: 27.10,
      lng: 88.45
    },
    {
      name: 'Gangtok-Nathula Road',
      state: 'Sikkim',
      startPoint: 'Gangtok',
      endPoint: 'Nathula',
      status: 'OPEN',
      riskLevel: 'MODERATE',
      description:
        'High-altitude route under continuous weather and slope monitoring.',
      lat: 27.35,
      lng: 88.78
    },
    {
      name: 'NH-13',
      state: 'Arunachal Pradesh',
      startPoint: 'Itanagar',
      endPoint: 'Tawang',
      status: 'RESTRICTED',
      riskLevel: 'HIGH',
      description:
        'Multiple landslide-sensitive stretches. Emergency response teams remain on standby.',
      lat: 27.35,
      lng: 92.60
    },
    {
      name: 'Tawang-Bomdila Road',
      state: 'Arunachal Pradesh',
      startPoint: 'Tawang',
      endPoint: 'Bomdila',
      status: 'BLOCKED',
      riskLevel: 'CRITICAL',
      description:
        'Road blockage reported due to slope failure. Clearance and safety assessment required.',
      lat: 27.52,
      lng: 92.25
    },
    {
      name: 'NH-6',
      state: 'Meghalaya',
      startPoint: 'Guwahati',
      endPoint: 'Shillong',
      status: 'OPEN',
      riskLevel: 'MODERATE',
      description:
        'Operational route with increased monitoring during heavy rainfall.',
      lat: 25.75,
      lng: 91.95
    },
    {
      name: 'Shillong-Cherrapunji Road',
      state: 'Meghalaya',
      startPoint: 'Shillong',
      endPoint: 'Sohra',
      status: 'RESTRICTED',
      riskLevel: 'HIGH',
      description:
        'Heavy rainfall zone with recurring slope instability and visibility issues.',
      lat: 25.40,
      lng: 91.73
    },
    {
      name: 'NH-2 Kohima-Dimapur Road',
      state: 'Nagaland',
      startPoint: 'Dimapur',
      endPoint: 'Kohima',
      status: 'OPEN',
      riskLevel: 'LOW',
      description:
        'Currently operational with routine landslide surveillance.',
      lat: 25.78,
      lng: 93.98
    },
    {
      name: 'Guwahati-North Guwahati Corridor',
      state: 'Assam',
      startPoint: 'Guwahati',
      endPoint: 'North Guwahati',
      status: 'OPEN',
      riskLevel: 'LOW',
      description:
        'Currently operational with normal traffic movement.',
      lat: 26.19,
      lng: 91.72
    }
  ];

  for (const item of roads) {
    await prisma.road.create({
      data: item
    });
  }

  console.log(`🛣️ ${roads.length} NER roads added.`);

  // ==========================================
  // SAMPLE ALERT
  // ==========================================

  await prisma.alertLog.create({
    data: {
      location: 'Aizawl, Mizoram',
      level: 'CRITICAL',
      score: 94,
      rainfall: 142,
      dispatchedTo: [
        'NDRF State Unit',
        'District Disaster Authority',
        'Automated SMS Gateway'
      ]
    }
  });

  console.log('🚨 Sample emergency alert added.');

  console.log('\n============================================');
  console.log('✅ NER DATABASE SEEDED SUCCESSFULLY!');
  console.log(`📍 Hotspots: ${hotspots.length}`);
  console.log(`🏠 Shelters: ${shelters.length}`);
  console.log(`🛣️ Roads: ${roads.length}`);
  console.log('============================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });