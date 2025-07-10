import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { sessionCookie, checkAdmin } = await request.json()

    if (!sessionCookie) {
      return NextResponse.json({ valid: false, error: 'Session cookie não fornecido' }, { status: 400 })
    }

    // Import dinâmico para Firebase Admin
    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase-admin')
    const adminAuth = await getAdminAuth()

    if (!adminAuth) {
      return NextResponse.json({ valid: false, error: 'Firebase Admin não disponível' }, { status: 500 })
    }

    // Verificar session cookie
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true)

    if (!decodedToken) {
      return NextResponse.json({ valid: false, error: 'Token inválido' }, { status: 401 })
    }

    let isAdmin = false

    // Se precisa verificar se é admin
    if (checkAdmin) {
      const adminDb = await getAdminDb()
      
      if (adminDb) {
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get()
        const userData = userDoc.data()
        isAdmin = userData?.role === 'admin'
      }
    }

    return NextResponse.json({ 
      valid: true, 
      uid: decodedToken.uid,
      email: decodedToken.email,
      isAdmin 
    })

  } catch (error) {
    console.error('Erro ao verificar token:', error)
    return NextResponse.json({ valid: false, error: 'Erro interno do servidor' }, { status: 500 })
  }
} 