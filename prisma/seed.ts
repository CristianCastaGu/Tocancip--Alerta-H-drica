import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

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
      precipPreventivo: 10,
      precipAlerta: 25,
      precipEmergencia: 50,
      windPreventivo: 40,
      windAlerta: 60,
      windEmergencia: 80,
      humidityPreventivo: 85,
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
