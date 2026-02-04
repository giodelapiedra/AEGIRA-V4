// Database seeding script
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Create a demo company
  const company = await prisma.company.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      timezone: 'Asia/Manila',
    },
  });

  console.log('Created company:', company.name);

  // Create teams with different check-in schedules
  const teams = await Promise.all([
    // Operations: Early shift, Mon-Fri, 5:00 AM - 8:00 AM
    prisma.team.upsert({
      where: { company_id_name: { company_id: company.id, name: 'Operations' } },
      update: {
        check_in_start: '05:00',
        check_in_end: '08:00',
        work_days: '1,2,3,4,5', // Mon-Fri
      },
      create: {
        company_id: company.id,
        name: 'Operations',
        description: 'Operations team - Early morning shift',
        check_in_start: '05:00',
        check_in_end: '08:00',
        work_days: '1,2,3,4,5', // Mon-Fri
      },
    }),
    // Logistics: Regular shift, Mon-Sat, 6:00 AM - 10:00 AM
    prisma.team.upsert({
      where: { company_id_name: { company_id: company.id, name: 'Logistics' } },
      update: {
        check_in_start: '06:00',
        check_in_end: '10:00',
        work_days: '1,2,3,4,5,6', // Mon-Sat
      },
      create: {
        company_id: company.id,
        name: 'Logistics',
        description: 'Logistics and delivery team - includes Saturdays',
        check_in_start: '06:00',
        check_in_end: '10:00',
        work_days: '1,2,3,4,5,6', // Mon-Sat
      },
    }),
    // Maintenance: Flexible shift, Mon-Fri, 7:00 AM - 12:00 PM (wider window)
    prisma.team.upsert({
      where: { company_id_name: { company_id: company.id, name: 'Maintenance' } },
      update: {
        check_in_start: '07:00',
        check_in_end: '12:00',
        work_days: '1,2,3,4,5', // Mon-Fri
      },
      create: {
        company_id: company.id,
        name: 'Maintenance',
        description: 'Equipment maintenance team - Flexible morning schedule',
        check_in_start: '07:00',
        check_in_end: '12:00',
        work_days: '1,2,3,4,5', // Mon-Fri
      },
    }),
  ]);

  console.log('Created teams:', teams.map((t) => t.name).join(', '));

  // Create admin user
  const admin = await prisma.person.upsert({
    where: { company_id_email: { company_id: company.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      company_id: company.id,
      email: 'admin@demo.com',
      password_hash: await hashPassword('admin123'),
      first_name: 'Admin',
      last_name: 'User',
      role: 'ADMIN',
    },
  });

  console.log('Created admin:', admin.email);

  // Create supervisor
  const supervisor = await prisma.person.upsert({
    where: { company_id_email: { company_id: company.id, email: 'supervisor@demo.com' } },
    update: {},
    create: {
      company_id: company.id,
      email: 'supervisor@demo.com',
      password_hash: await hashPassword('super123'),
      first_name: 'Super',
      last_name: 'Visor',
      role: 'SUPERVISOR',
      team_id: teams[0]!.id,
    },
  });

  console.log('Created supervisor:', supervisor.email);

  // Create workers
  const workerData = [
    { firstName: 'Juan', lastName: 'DelaCruz', teamIndex: 0 },
    { firstName: 'Maria', lastName: 'Santos', teamIndex: 0 },
    { firstName: 'Pedro', lastName: 'Garcia', teamIndex: 1 },
    { firstName: 'Ana', lastName: 'Reyes', teamIndex: 1 },
    { firstName: 'Jose', lastName: 'Mendoza', teamIndex: 2 },
  ];

  // Set team_assigned_at to 7 days ago so workers are considered "established" in team
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  for (const worker of workerData) {
    const email = `${worker.firstName.toLowerCase()}${worker.lastName.toLowerCase()}@demo.com`;
    await prisma.person.upsert({
      where: { company_id_email: { company_id: company.id, email } },
      update: {
        team_id: teams[worker.teamIndex]!.id,
        team_assigned_at: sevenDaysAgo,
      },
      create: {
        company_id: company.id,
        email,
        password_hash: await hashPassword('worker123'),
        first_name: worker.firstName,
        last_name: worker.lastName,
        role: 'WORKER',
        team_id: teams[worker.teamIndex]!.id,
        team_assigned_at: sevenDaysAgo,
      },
    });
    console.log('Created worker:', email);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
