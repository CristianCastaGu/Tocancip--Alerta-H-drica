import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendTextMessage } from '@/lib/evolution/client';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const user = session.user as { role?: string };
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { number, text } = (await req.json()) as { number?: string; text?: string };
  if (!number || !text) {
    return NextResponse.json({ error: 'Número y mensaje son requeridos' }, { status: 400 });
  }

  const result = await sendTextMessage(number, text);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
