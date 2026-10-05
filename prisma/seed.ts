import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_THRESHOLDS } from '../lib/riskEngine';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 12);
  const operadorPassword = await bcrypt.hash('operador123', 12);

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: adminPassword, role: Role.ADMIN },
  });

  await prisma.user.upsert({
    where: { username: 'operador' },
    update: {},
    create: { username: 'operador', password: operadorPassword, role: Role.OPERADOR },
  });

  await prisma.threshold.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      ...DEFAULT_THRESHOLDS,
      evalIntervalMinutes: 15,
      autoEnabled: false,
      updatedBy: 'seed',
    },
  });

  console.log('Seed completado: admin / operador creados, umbrales inicializados');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
