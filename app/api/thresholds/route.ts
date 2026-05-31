import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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

  const body = await req.json();
  const existing = await prisma.threshold.findFirst({ orderBy: { updatedAt: 'desc' } });

  const threshold = existing
    ? await prisma.threshold.update({
        where: { id: existing.id },
        data: { ...body, updatedBy: user.name ?? 'admin' },
      })
    : await prisma.threshold.create({
        data: { ...body, updatedBy: user.name ?? 'admin' },
      });

  const dbUser = await prisma.user.findUnique({ where: { username: user.name ?? '' } });
  if (dbUser) {
    await prisma.auditLog.create({
      data: {
        userId: dbUser.id,
        action: 'THRESHOLD_UPDATE',
        detail: JSON.stringify(body),
      },
    });
  }

  return NextResponse.json(threshold);
}
