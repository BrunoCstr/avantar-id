import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

// Função para converter hex para base32
function hexToBase32(hex: string): string {
  // Converter hex para buffer
  const buffer = Buffer.from(hex, 'hex');
  
  // Converter para base32 usando uma implementação mais robusta
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let result = '';
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    
    while (bits >= 5) {
      result += base32Chars[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  // Adicionar padding se necessário
  if (bits > 0) {
    result += base32Chars[(value << (5 - bits)) & 31];
  }
  
  // Adicionar padding '=' para completar grupos de 8 caracteres
  while (result.length % 8 !== 0) {
    result += '=';
  }
  
  return result;
}

// Função para normalizar secret key
function normalizeSecret(secret: string): string {
  if (!secret || secret.trim().length === 0) {
    throw new Error('Secret não pode estar vazio')
  }
  
  // Remover espaços e converter para uppercase
  let normalized = secret.trim().toUpperCase().replace(/[\s-]/g, '')
  
  // Se contém caracteres não Base32, pode ser hex - converter para Base32
  if (!/^[A-Z2-7=]+$/.test(normalized)) {
    // Tentar interpretar como hex e converter para base32
    if (/^[0-9A-F]+$/i.test(normalized)) {
      try {
        // Converter hex para base32 usando função própria
        normalized = hexToBase32(normalized);
      } catch (error: unknown) {
        throw new Error('Secret em formato inválido')
      }
    } else {
      throw new Error('Secret deve estar em formato Base32 ou Hex')
    }
  }
  
  // Validar tamanho mínimo
  if (normalized.length < 16) {
    throw new Error('Secret muito curto (mínimo 16 caracteres)')
  }
  
  return normalized
}

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    if (!secret) {
      return NextResponse.json({ error: 'Secret não fornecido' }, { status: 400 });
    }

    // Normalizar o secret
    const cleanSecret = normalizeSecret(secret);

    // Validar se o secret é válido para TOTP
    if (!/^[A-Z2-7=]+$/.test(cleanSecret)) {
      console.error('Secret normalizado inválido:', cleanSecret);
      return NextResponse.json({ error: 'Secret em formato inválido após normalização' }, { status: 400 });
    }

    // Gerar token usando speakeasy
    const token = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      digits: 6,
      algorithm: 'sha1'
    });

    // Verificar se o token foi gerado corretamente
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      console.error('Token inválido gerado:', token);
      return NextResponse.json({ error: 'Token inválido gerado' }, { status: 500 });
    }

    // Calcular tempo restante
    const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

    const response = { 
      token: token.padStart(6, '0'), 
      remaining 
    };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao gerar TOTP:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    if (!secret) {
      return NextResponse.json({ error: 'Secret não fornecido' }, { status: 400 });
    }

    // Normalizar o secret
    const cleanSecret = normalizeSecret(secret);

    // Validar se o secret é válido para TOTP
    if (!/^[A-Z2-7=]+$/.test(cleanSecret)) {
      console.error('Secret normalizado inválido (GET):', cleanSecret);
      return NextResponse.json({ error: 'Secret em formato inválido após normalização' }, { status: 400 });
    }

    // Gerar token usando speakeasy
    const token = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      digits: 6,
      algorithm: 'sha1'
    });

    // Verificar se o token foi gerado corretamente
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      console.error('Token inválido gerado (GET):', token);
      return NextResponse.json({ error: 'Token inválido gerado' }, { status: 500 });
    }

    // Calcular tempo restante
    const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

    const response = { 
      token: token.padStart(6, '0'), 
      remaining 
    };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro ao gerar TOTP (GET):', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }, { status: 500 });
  }
} 