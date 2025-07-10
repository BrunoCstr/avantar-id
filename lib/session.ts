import { getAdminAuth } from './firebase-admin'
import { auth } from './firebase'

export async function createSessionCookie(idToken: string): Promise<string> {
  try {
    const adminAuth = await getAdminAuth()
    
    if (!adminAuth) {
      throw new Error('Firebase Admin Auth não disponível')
    }
    
    // Criar session cookie que expira em 5 dias
    const expiresIn = 60 * 60 * 24 * 5 * 1000 // 5 dias
    
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    })
    
    return sessionCookie
  } catch (error) {
    console.error('Erro ao criar session cookie:', error)
    throw error
  }
}

export async function verifySessionCookie(sessionCookie: string) {
  try {
    const adminAuth = await getAdminAuth()
    
    if (!adminAuth) {
      console.error('Firebase Admin Auth não disponível')
      return null
    }
    
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true)
    return decodedToken
  } catch (error) {
    console.error('Erro ao verificar session cookie:', error)
    return null
  }
}

export async function revokeAllSessions(uid: string) {
  try {
    const adminAuth = await getAdminAuth()
    
    if (!adminAuth) {
      throw new Error('Firebase Admin Auth não disponível')
    }
    
    await adminAuth.revokeRefreshTokens(uid)
  } catch (error) {
    console.error('Erro ao revogar sessões:', error)
    throw error
  }
}

// Função para ser usada no cliente para obter o ID token
export async function getCurrentUserIdToken(): Promise<string | null> {
  try {
    const user = auth.currentUser
    if (user) {
      return await user.getIdToken()
    }
    return null
  } catch (error) {
    console.error('Erro ao obter ID token:', error)
    return null
  }
} 