import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(request: NextRequest) {
  try {
    const { uid } = await request.json()
    if (!uid) {
      return NextResponse.json({ error: 'UID é obrigatório' }, { status: 400 })
    }
    // Import dinâmico para evitar bundling no client
    const { deleteUserFromAuth } = await import('@/lib/firebase-admin')
    await deleteUserFromAuth(uid)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar usuário do Auth:', error)
    return NextResponse.json({ error: 'Erro ao deletar usuário do Auth' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }
    // Import dinâmico para evitar bundling no client
    const { getAdminAuth, getAdminDb } = await import('@/lib/firebase-admin')
    const adminAuth = await getAdminAuth()
    const adminDb = await getAdminDb()
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Firebase Admin não disponível' }, { status: 500 })
    }
    // Criar usuário no Auth
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: name || undefined,
      emailVerified: false,
      disabled: false
    })
    // Criar documento no Firestore
    const userData = {
      uid: userRecord.uid,
      email: userRecord.email,
      name: name || userRecord.displayName || undefined,
      role: role || 'user',
      createdAt: new Date().toISOString(),
      status: 'active'
    }
    await adminDb.collection('users').doc(userRecord.uid).set(userData)
    return NextResponse.json({ success: true, uid: userRecord.uid })
  } catch (error: any) {
    console.error('Erro ao criar usuário via Admin SDK:', error)
    return NextResponse.json({ error: error.message || 'Erro ao criar usuário' }, { status: 500 })
  }
} 