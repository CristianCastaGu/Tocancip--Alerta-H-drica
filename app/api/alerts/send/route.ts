import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sendWhatsAppAlert } from '@/lib/whatsapp';
import prisma from '@/lib/prisma';
import { AlertLevel, WeatherData } from '@/lib/types';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { name?: string; role?: string };
  if (!['ADMIN', 'OPERADOR'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos para activar alertas' }, { status: 403 });
  }

  const body = await req.json();
  const { level, message, weatherData } = body as {
    level: AlertLevel;
    message?: string;
    weatherData: Partial<WeatherData>;
  };

  if (!level) return NextResponse.json({ error: 'Nivel de alerta requerido' }, { status: 400 });

  const waResult = await sendWhatsAppAlert(level, message ?? '', weatherData);

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });

  const alert = await prisma.alert.create({
    data: {
      level: level as 'INFORMATIVO' | 'PREVENTIVO' | 'ALERTA' | 'EMERGENCIA',
      triggeredBy: 'manual',
      userId: dbUser?.id,
      message: message ?? null,
      waStatus: waResult.success ? 'sent' : 'failed',
      waMessageId: waResult.messageId ?? null,
      weatherData: weatherData as object,
    },
  });

  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'ALERT_MANUAL',
        detail: `Nivel ${level} activado manualmente. WhatsApp: ${waResult.success ? 'OK' : 'FALLÓ'}`,
      },
    });
  }

  return NextResponse.json({ alert, whatsapp: waResult });
}
