import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Seeding user-service database...');

  // Create organizations
  const acmeOrg = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
      description: 'A leading technology company',
      website: 'https://acme.example.com',
      plan: 'pro',
      maxMembers: 50,
      isActive: true,
    },
  });

  const startupOrg = await prisma.organization.upsert({
    where: { slug: 'startup-inc' },
    update: {},
    create: {
      name: 'Startup Inc',
      slug: 'startup-inc',
      description: 'An innovative startup',
      plan: 'free',
      maxMembers: 5,
      isActive: true,
    },
  });

  console.log(`Created organizations: ${acmeOrg.name}, ${startupOrg.name}`);

  // Create users
  const alice = await prisma.user.upsert({
    where: { email: 'alice@acme.example.com' },
    update: {},
    create: {
      email: 'alice@acme.example.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      displayName: 'Alice J.',
      bio: 'Senior Engineer at Acme Corp',
      timezone: 'America/New_York',
      language: 'en',
      isActive: true,
      organizationId: acmeOrg.id,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@acme.example.com' },
    update: {},
    create: {
      email: 'bob@acme.example.com',
      firstName: 'Bob',
      lastName: 'Smith',
      displayName: 'Bob S.',
      bio: 'Product Manager at Acme Corp',
      timezone: 'America/Los_Angeles',
      language: 'en',
      isActive: true,
      organizationId: acmeOrg.id,
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: 'carol@startup.example.com' },
    update: {},
    create: {
      email: 'carol@startup.example.com',
      firstName: 'Carol',
      lastName: 'Williams',
      displayName: 'Carol W.',
      bio: 'Founder of Startup Inc',
      timezone: 'Europe/London',
      language: 'en',
      isActive: true,
      organizationId: startupOrg.id,
    },
  });

  console.log(`Created users: ${alice.email}, ${bob.email}, ${carol.email}`);

  // Create user preferences
  await prisma.userPreference.upsert({
    where: { userId: alice.id },
    update: {},
    create: {
      userId: alice.id,
      emailNotifications: true,
      pushNotifications: true,
      theme: 'dark',
      editorFontSize: 14,
      editorTheme: 'monokai',
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: bob.id },
    update: {},
    create: {
      userId: bob.id,
      emailNotifications: true,
      pushNotifications: false,
      theme: 'light',
      editorFontSize: 16,
      editorTheme: 'default',
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: carol.id },
    update: {},
    create: {
      userId: carol.id,
      emailNotifications: true,
      pushNotifications: true,
      theme: 'system',
      editorFontSize: 14,
      editorTheme: 'github',
    },
  });

  console.log('Created user preferences');

  // Create teams
  const engineeringTeam = await prisma.team.upsert({
    where: { id: 'team-engineering-acme' },
    update: {},
    create: {
      id: 'team-engineering-acme',
      name: 'Engineering',
      description: 'Engineering team responsible for product development',
      organizationId: acmeOrg.id,
    },
  });

  const productTeam = await prisma.team.upsert({
    where: { id: 'team-product-acme' },
    update: {},
    create: {
      id: 'team-product-acme',
      name: 'Product',
      description: 'Product management and design team',
      organizationId: acmeOrg.id,
    },
  });

  console.log(`Created teams: ${engineeringTeam.name}, ${productTeam.name}`);

  // Add team members
  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: alice.id, teamId: engineeringTeam.id } },
    update: {},
    create: {
      userId: alice.id,
      teamId: engineeringTeam.id,
      role: 'lead',
    },
  });

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: bob.id, teamId: productTeam.id } },
    update: {},
    create: {
      userId: bob.id,
      teamId: productTeam.id,
      role: 'lead',
    },
  });

  await prisma.teamMember.upsert({
    where: { userId_teamId: { userId: bob.id, teamId: engineeringTeam.id } },
    update: {},
    create: {
      userId: bob.id,
      teamId: engineeringTeam.id,
      role: 'member',
    },
  });

  console.log('Added team members');
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
