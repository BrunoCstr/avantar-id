import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // URL da Cloud Function (você precisará substituir pela URL real após o deploy)
    const functionUrl = process.env.FIREBASE_FUNCTION_URL;

    if (!functionUrl) {
      throw new Error("FIREBASE_FUNCTION_URL não está definida nas variáveis de ambiente.");
    }
    
    const body = await request.json();
    const companyEmail = body.companyEmail;
    const companyReceiverEmail = body.companyReceiverEmail;
    const companyReceiverEmailPassword = body.companyReceiverEmailPassword;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ companyEmail, companyReceiverEmail, companyReceiverEmailPassword }),
    });

    if (!response.ok) {
      throw new Error(`Cloud Function retornou erro: ${response.status}`);
    }

    const result = await response.text();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Verificação concluída com sucesso',
      result 
    });

  } catch (error) {
    console.error('Erro ao chamar Cloud Function:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao verificar e-mails',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
} 