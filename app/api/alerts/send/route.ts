import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendWhatsAppAlert } from '@/lib/whatsapp';
import prisma from '@/lib/prisma';
import { AlertLevel, Thresholds, WeatherData } from '@/lib/types';
import { collectWeather } from '@/lib/weather/collect';
import { buildSnapshot } from '@/lib/alertSnapshot';
import { DEFAULT_THRESHOLDS, LEVEL_ORDER } from '@/lib/riskEngine';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { name?: string; role?: string };
  if (!['ADMIN', 'OPERADOR'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos para activar alertas' }, { status: 403 });
  }

  const body = await req.json();
  const { level, message, weatherData, includeImage } = body as {
    level: AlertLevel;
    message?: string;
    weatherData: Partial<WeatherData>;
    includeImage?: boolean;
  };

  if (!level || !(level in LEVEL_ORDER)) {
    return NextResponse.json({ error: 'Nivel de alerta requerido' }, { status: 400 });
  }

  /* Fotografía completa de las condiciones (fuentes, IRI, umbrales vigentes) para el
     historial. Se toma en el servidor; si falla, se guarda lo que envió el cliente. */
  const snapshot = await (async () => {
    try {
      const [weather, threshold] = await Promise.all([
        collectWeather(),
        prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } }),
      ]);
      return buildSnapshot(weather, (threshold as Thresholds | null) ?? DEFAULT_THRESHOLDS);
    } catch {
      return null;
    }
  })();

  const waResult = await sendWhatsAppAlert(level, message ?? '', weatherData, {
    includeImage: includeImage !== false,
  });

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });

  const alert = await prisma.alert.create({
    data: {
      level: level as 'INFORMATIVO' | 'PREVENTIVO' | 'ALERTA' | 'EMERGENCIA',
      triggeredBy: 'manual',
      userId: dbUser?.id,
      message: message ?? null,
      waStatus: waResult.success ? 'sent' : 'failed',
      waMessageId: waResult.messageId ?? null,
      weatherData: {
        ...(snapshot ?? weatherData),
        ...(waResult.success ? {} : { waError: waResult.error ?? 'Error desconocido' }),
      } as object,
    },
  });

  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'ALERT_MANUAL',
        detail: `Nivel ${level} activado manualmente. WhatsApp: ${waResult.success ? 'OK' : `FALLÓ (${waResult.error ?? 'sin detalle'})`}`,
      },
    });
  }

  return NextResponse.json({ alert, whatsapp: waResult });
}
