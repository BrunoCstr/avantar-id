"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { 
  User, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

interface UserData {
  uid: string
  email: string
  name?: string
  role: 'admin' | 'user'
  createdAt: string
  status: 'active' | 'inactive'
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name?: string, role?: 'admin' | 'user') => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateUserRole: (uid: string, role: 'admin' | 'user') => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const router = useRouter()

  // Verificar se estamos no cliente e configurar Firebase Auth
  useEffect(() => {
    setIsClient(true)
    
    // Configurar persistência do Firebase Auth no início
    if (typeof window !== 'undefined') {
      setPersistence(auth, browserLocalPersistence).catch(error => {
        console.error('Erro ao configurar persistência:', error)
      })
    }
  }, [])

  // Função para limpar completamente o estado de autenticação
  const clearAuthState = async () => {
    try {
      
      // Limpar estado local
      setUser(null)
      setUserData(null)
      
      // Tentar fazer signOut (mesmo se não houver usuário)
      try {
        await signOut(auth)
      } catch (signOutError) {
      }
      
      // Limpar session cookies no servidor
      try {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: null }),
        })
      } catch (deleteError) {
          console.error('Erro ao deletar session cookie (pode ser normal):', deleteError)
      }
      
      // Limpar localStorage relacionado ao Firebase (se houver)
      if (typeof window !== 'undefined') {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('firebase:') || key.includes('firebase')) {
            localStorage.removeItem(key)
          }
        })
      }
    } catch (error) {
      console.error('Erro ao limpar estado de autenticação:', error)
    }
  }

  // Listener para mudanças no estado de autenticação
  useEffect(() => {
    if (!isClient) return

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      
      if (firebaseUser) {
        try {
          // Verificar se o token do usuário está válido
          await firebaseUser.getIdToken(true) // Forçar refresh do token
          
          setUser(firebaseUser)
          
          // Buscar dados do usuário no Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData)
          } else {
            setUserData(null)
          }
        } catch (error: any) {
          console.error('Erro ao verificar token do usuário:', error)
          
          // Se houver erro de token, limpar estado
          if (error.code === 'auth/user-token-expired' || error.code === 'auth/user-disabled') {
            await clearAuthState()
            return
          }
          
          setUserData(null)
        }
      } else {
        setUser(null)
        setUserData(null)
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [isClient])

  const login = async (email: string, password: string) => {
    try {
      // Primeiro, limpar qualquer estado anterior e garantir logout completo
      await clearAuthState()
      
      // Configurar persistência antes do login
      await setPersistence(auth, browserLocalPersistence)
      
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Forçar um token fresco
      const idToken = await user.getIdToken(true) // true força refresh do token
      
      // Criar session cookie no servidor
      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }),
      })
      
      if (!sessionResponse.ok) {
        throw new Error('Erro ao criar sessão no servidor')
      }
      
    } catch (error: any) {
      console.error('Erro no login:', error)
      
      // Se houver erro relacionado a token expirado, tentar limpar e tentar novamente
      if (error.code === 'auth/user-token-expired') {
        await clearAuthState()
        
        try {
          await setPersistence(auth, browserLocalPersistence)
          const retryCredential = await signInWithEmailAndPassword(auth, email, password)
          const retryUser = retryCredential.user
          const retryToken = await retryUser.getIdToken(true)
          
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ idToken: retryToken }),
          })
          
          return
        } catch (retryError: any) {
          console.error('Erro na segunda tentativa:', retryError)
          throw new Error(retryError.message || 'Erro ao fazer login após retry')
        }
      }
      
      throw new Error(error.message || 'Erro ao fazer login')
    }
  }

  const logout = async () => {
    try {
      
      // Usar a função de limpeza completa
      await clearAuthState()
      
      // Redirecionar para página inicial
      router.push('/')
      
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      
      // Mesmo se houver erro, tentar redirecionar
      router.push('/')
    }
  }

  const register = async (
    email: string, 
    password: string, 
    name?: string, 
    role: 'admin' | 'user' = 'user'
  ) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      
      // Atualizar perfil do usuário
      if (name) {
        await updateProfile(user, { displayName: name })
      }
      
      // Criar documento do usuário no Firestore
      const userData: UserData = {
        uid: user.uid,
        email: user.email!,
        name: name || user.displayName || undefined,
        role,
        createdAt: new Date().toISOString(),
        status: 'active'
      }
      
      await setDoc(doc(db, 'users', user.uid), userData)
      
    } catch (error: any) {
      console.error('Erro no registro:', error)
      throw new Error(error.message || 'Erro ao registrar usuário')
    }
  }

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email)
    } catch (error: any) {
      console.error('Erro ao enviar email de reset:', error)
      throw new Error(error.message || 'Erro ao enviar email de reset')
    }
  }

  const updateUserRole = async (uid: string, role: 'admin' | 'user') => {
    try {
      await setDoc(doc(db, 'users', uid), { role }, { merge: true })
    } catch (error: any) {
      console.error('Erro ao atualizar role:', error)
      throw new Error(error.message || 'Erro ao atualizar role do usuário')
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      userData,
      loading,
      login,
      logout,
      register,
      resetPassword,
      updateUserRole
    }}>
      {children}
    </AuthContext.Provider>
  )
} 