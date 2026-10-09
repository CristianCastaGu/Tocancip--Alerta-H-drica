import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendWhatsAppAlert } from '@/lib/whatsapp';
import prisma from '@/lib/prisma';
import { WeatherData } from '@/lib/types';

/* Reintenta el envío por WhatsApp de una alerta cuyo envío falló */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { name?: string; role?: string };
  if (!['ADMIN', 'OPERADOR'].includes(user.role ?? '')) {
    return NextResponse.json({ error: 'Sin permisos para reenviar alertas' }, { status: 403 });
  }

  const { id } = await params;
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) return NextResponse.json({ error: 'Alerta no encontrada' }, { status: 404 });
  if (alert.waStatus === 'sent') {
    return NextResponse.json({ error: 'Esta alerta ya fue enviada' }, { status: 409 });
  }

  const weatherData = (alert.weatherData ?? {}) as Record<string, unknown>;
  /* En las automáticas "message" es la razón interna, no una nota para la comunidad */
  const note = alert.triggeredBy === 'manual' ? alert.message ?? '' : '';
  const waResult = await sendWhatsAppAlert(alert.level, note, weatherData as Partial<WeatherData>);

  const rest = { ...weatherData };
  delete rest.waError;
  const updated = await prisma.alert.update({
    where: { id },
    data: {
      waStatus: waResult.success ? 'sent' : 'failed',
      waMessageId: waResult.messageId ?? null,
      weatherData: {
        ...rest,
        ...(waResult.success ? {} : { waError: waResult.error ?? 'Error desconocido' }),
      } as object,
    },
    include: { user: { select: { username: true, role: true } } },
  });

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });
  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'ALERT_RESEND',
        detail: `Reenvío de alerta ${alert.level} del ${alert.createdAt.toISOString()}. WhatsApp: ${waResult.success ? 'OK' : `FALLÓ (${waResult.error ?? 'sin detalle'})`}`,
      },
    });
  }

  return NextResponse.json({ alert: updated, whatsapp: waResult });
}
