import { NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

export async function GET(request: any) {
  const secret = "MVFMEBKIIDN73UX5BTDWBI2DC66GUYIK"; // use variável de ambiente

  const token = speakeasy.totp({
    secret: secret,
    encoding: 'base32',
  });

  const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

  return NextResponse.json({ token, remaining });
}
