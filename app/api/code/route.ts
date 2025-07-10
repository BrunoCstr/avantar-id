import { NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

export async function GET(request: any) {
  const secret = "H2CQVH2GYT4DJLRDKOM5PGZHIJ5GV62M"; // use variável de ambiente

  // Gera o token baseado no tempo atual
  const token = speakeasy.totp({
    secret: secret,
    encoding: 'base32',
  });

  // Verifica se o token é válido para o tempo atual
  const isValid = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 1, // tolerância de 1 intervalo
  });

  const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

  console.log(isValid);
  console.log(token);
  console.log(remaining);
  console.log(secret);
  console.log(new Date().toISOString());

  return NextResponse.json({ token, remaining, isValid });
}
