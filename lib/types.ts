// Tipos para o sistema de etiquetas

export interface UserData {
  uid: string
  email: string
  name?: string
  role: 'admin' | 'user'
  createdAt: string
  status: 'active' | 'inactive'
  tags?: string[] // Tags do usuário (ex: "Treino", "Premium", etc.)
}

export interface CompanyData {
  id?: string
  name: string
  fullName: string
  secret: string
  color: string
  logo: string
  authType: 'totp' | 'email'
  email?: string
  receiverEmail?: string
  receiverEmailPassword?: string
  code?: string
  receivedAt?: any
  // Sistema de tags
  tags?: string[] // Tags da seguradora (ex: "Único", "Treino", etc.)
  ownerId?: string | null // ID do usuário que criou (para seguradoras privadas)
  isPrivate?: boolean // Se é uma seguradora privada do usuário
}

// Tipos de acesso para seguradoras
export type CompanyAccessType = 'Único' | 'Treino' | 'private'

// Função para determinar se um usuário pode ver uma seguradora
export function canUserSeeCompany(
  company: CompanyData, 
  userData: UserData | null
): boolean {
  if (!userData) return false

  // Admin pode ver todas as seguradoras
  if (userData.role === 'admin') return true

  // Se a seguradora tem tag "Único", todos os usuários podem ver
  if (company.tags?.includes('Único')) return true

  // Se a seguradora é privada do usuário, ele pode ver
  if (company.isPrivate && company.ownerId === userData.uid) return true

  // Se a seguradora tem tags que o usuário possui
  if (company.tags && userData.tags) {
    const hasMatchingTag = company.tags.some(tag => 
      userData.tags!.includes(tag)
    )
    if (hasMatchingTag) return true
  }

  return false
}

// Função para obter seguradoras visíveis para um usuário
export function getVisibleCompanies(
  companies: CompanyData[], 
  userData: UserData | null
): CompanyData[] {
  if (!userData) return []
  
  return companies.filter(company => canUserSeeCompany(company, userData))
}
