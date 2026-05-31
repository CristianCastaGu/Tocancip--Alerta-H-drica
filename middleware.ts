export { default } from 'next-auth/middleware';

export const config = {
  matcher: ['/dashboard/:path*', '/historial/:path*', '/configuracion/:path*', '/auditoria/:path*'],
};
