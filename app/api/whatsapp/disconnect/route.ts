import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logoutInstance } from '@/lib/evolution/client';
import prisma from '@/lib/prisma';

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { name?: string; role?: string };
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const result = await logoutInstance();

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });
  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'WHATSAPP_DISCONNECT',
        detail: result.ok ? 'Sesión de WhatsApp cerrada' : `Error: ${result.error}`,
      },
    });
  }

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ success: true });
}
