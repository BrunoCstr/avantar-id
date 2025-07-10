import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json(
        { error: 'ID token é obrigatório' },
        { status: 400 }
      )
    }

    // Import dinâmico para session utils
    const { createSessionCookie } = await import('@/lib/session')
    
    // Criar session cookie
    const sessionCookie = await createSessionCookie(idToken)

    // Configurar cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('__session', sessionCookie, {
      maxAge: 60 * 60 * 24 * 5, // 5 dias
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    })

    return response
  } catch (error) {
    console.error('Erro ao criar sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { uid } = await request.json()

    if (uid) {
      // Import dinâmico para session utils
      const { revokeAllSessions } = await import('@/lib/session')
      
      // Revogar todas as sessões do usuário
      await revokeAllSessions(uid)
    }

    // Remover session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.delete('__session')

    return response
  } catch (error) {
    console.error('Erro ao fazer logout:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
} 