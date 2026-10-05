import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const NUMERIC_FIELDS = [
  'precipPreventivo', 'precipAlerta', 'precipEmergencia',
  'windPreventivo', 'windAlerta', 'windEmergencia',
  'humidityPreventivo',
] as const;

type NumericField = (typeof NUMERIC_FIELDS)[number];

interface ThresholdInput extends Record<NumericField, number> {
  evalIntervalMinutes: number;
  autoEnabled: boolean;
}

/* Solo acepta los campos conocidos y verifica rangos y orden de los umbrales */
function parseThresholds(body: Record<string, unknown>): { data?: ThresholdInput; error?: string } {
  const data = {} as ThresholdInput;

  for (const field of NUMERIC_FIELDS) {
    const value = body[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      return { error: `El valor de ${field} debe ser un número mayor que 0` };
    }
    data[field] = value;
  }

  if (!(data.precipPreventivo < data.precipAlerta && data.precipAlerta < data.precipEmergencia)) {
    return { error: 'Precipitación: debe cumplirse Preventivo < Alerta < Emergencia' };
  }
  if (!(data.windPreventivo < data.windAlerta && data.windAlerta < data.windEmergencia)) {
    return { error: 'Viento: debe cumplirse Preventivo < Alerta < Emergencia' };
  }
  if (data.humidityPreventivo > 100) {
    return { error: 'La humedad no puede superar 100 %' };
  }

  const interval = body.evalIntervalMinutes;
  if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 1 || interval > 1440) {
    return { error: 'La frecuencia de evaluación debe estar entre 1 y 1440 minutos' };
  }
  data.evalIntervalMinutes = interval;
  data.autoEnabled = body.autoEnabled === true;

  return { data };
}

export async function GET() {
  const threshold = await prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(threshold);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { name?: string; role?: string };
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Solo administradores pueden modificar umbrales' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido' }, { status: 400 });
  }

  const { data, error } = parseThresholds(body as Record<string, unknown>);
  if (!data) return NextResponse.json({ error }, { status: 400 });

  const existing = await prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } });

  const threshold = existing
    ? await prisma.threshold.update({
        where: { id: existing.id },
        data: { ...data, updatedBy: user.name ?? 'admin' },
      })
    : await prisma.threshold.create({
        data: { ...data, updatedBy: user.name ?? 'admin' },
      });

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });
  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'THRESHOLD_UPDATE',
        detail: JSON.stringify(data),
      },
    });
  }

  return NextResponse.json(threshold);
}
