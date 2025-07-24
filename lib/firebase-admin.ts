// Verificar se estamos no ambiente servidor
const isServer = typeof window === 'undefined'

let adminAuth: any = null
let adminDb: any = null

// Inicialização do Firebase Admin apenas no servidor
async function initializeFirebaseAdmin() {
  if (!isServer) {
    console.warn('Firebase Admin não pode ser inicializado no cliente')
    return { adminAuth: null, adminDb: null }
  }

  try {
    // Import dinâmico para evitar bundling no cliente
    const admin = await import('firebase-admin')
    
    // Verificar se já existe uma instância
    if (admin.default.apps.length === 0) {
      const serviceAccount = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      };

      admin.default.initializeApp({
        credential: admin.default.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    }

    return {
      adminAuth: admin.default.auth(),
      adminDb: admin.default.firestore()
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error)
    return { adminAuth: null, adminDb: null }
  }
}

// Função para obter instância do Firebase Admin Auth
export async function getAdminAuth() {
  if (!adminAuth) {
    const { adminAuth: auth } = await initializeFirebaseAdmin()
    adminAuth = auth
  }
  return adminAuth
}

// Função para obter instância do Firebase Admin Firestore
export async function getAdminDb() {
  if (!adminDb) {
    const { adminDb: db } = await initializeFirebaseAdmin()
    adminDb = db
  }
  return adminDb
} 

// Função para deletar usuário do Auth
export async function deleteUserFromAuth(uid: string) {
  const adminAuth = await getAdminAuth()
  if (!adminAuth) throw new Error('Firebase Admin Auth não disponível')
  return adminAuth.deleteUser(uid)
} 