import { NextRequest, NextResponse } from 'next/server';
import speakeasy from 'speakeasy';

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
        // Converter hex para buffer e depois para base32
        const buffer = Buffer.from(normalized, 'hex')
        normalized = buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '2').replace(/\//g, '7')
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

    // Gerar token usando speakeasy
    const token = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      digits: 6,
    });

    // Verificar se o token foi gerado corretamente
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: 'Token inválido gerado' }, { status: 500 });
    }

    // Calcular tempo restante
    const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

    return NextResponse.json({ 
      token: token.padStart(6, '0'), 
      remaining 
    });

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

    // Gerar token usando speakeasy
    const token = speakeasy.totp({
      secret: cleanSecret,
      encoding: 'base32',
      step: 30,
      digits: 6,
    });

    // Verificar se o token foi gerado corretamente
    if (!token || token.length !== 6 || !/^\d{6}$/.test(token)) {
      return NextResponse.json({ error: 'Token inválido gerado' }, { status: 500 });
    }

    // Calcular tempo restante
    const remaining = 30 - Math.floor((Date.now() / 1000) % 30);

    return NextResponse.json({ 
      token: token.padStart(6, '0'), 
      remaining 
    });

  } catch (error) {
    console.error('Erro ao gerar TOTP:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    }, { status: 500 });
  }
} 