"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LogOut, Copy, Settings, Shield, Edit3, Plus, Trash2, QrCode } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen } from "@/components/ui/loading"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"

import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { QRImporter } from "@/components/QRImporter"
import { logUserAccess, logAdminAction } from "@/lib/access-logs"

// Seguradoras com códigos 2FA - estrutura inicial sem secrets (para serem preenchidos com secrets reais)
const INSURANCE_COMPANIES = [
  {
    name: "AIG",
    fullName: "American International Group",
    logo: "/logos/aig.png",
    secret: "JBSWY3DPEHPK3PXP", // Secret de exemplo para teste - substitua por secret real
    color: "#1e3a8a",
  },
  {
    name: "Justos",
    fullName: "Justos Seguros",
    logo: "/logos/justos.jpeg",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#eab308",
  },
  {
    name: "BMG",
    fullName: "BMG Seguros",
    logo: "/logos/bmg.jpeg",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#1e40af",
  },
  {
    name: "Swiss Re",
    fullName: "Swiss Re Group",
    logo: "/logos/swissre.png",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#059669",
  },
  {
    name: "Amil",
    fullName: "Amil Assistência Médica",
    logo: "/logos/amil.png",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#7c3aed",
  },
  {
    name: "BTG",
    fullName: "BTG Pactual Seguros",
    logo: "/logos/btg.png",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#1e40af",
  },
  {
    name: "Bradesco",
    fullName: "Bradesco Consórcios",
    logo: "/logos/bradesco.png",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#dc2626",
  },
  {
    name: "Qualicorp",
    fullName: "Qualicorp Administradora",
    logo: "/logos/qualicorp.png",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#1e40af",
  },
  {
    name: "Prudential",
    fullName: "Prudential do Brasil",
    logo: "/logos/prudential.jpeg",
    secret: "", // Secret real deve ser inserido pelo admin
    color: "#0369a1",
  },
]

// Configurações do speakeasy para máxima compatibilidade com Google Authenticator e outros apps 2FA
const SPEAKEASY_OPTIONS = {
  step: 30,        // 30 segundos (padrão RFC 6238)
  window: 2,       // Janela de tolerância aumentada para 2 períodos
  digits: 6,       // 6 dígitos
  encoding: 'base32' as const
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

// Função para gerar código TOTP usando a API
async function generateTOTP(secret: string): Promise<string> {
  try {
    // Verificar se o secret existe e não está vazio
    if (!secret || secret.trim().length === 0) {
      return "------"
    }
    
    // Chamar a API para gerar o token
    const response = await fetch(`/api/totp?secret=${encodeURIComponent(secret)}`)
    
    if (!response.ok) {
      console.error(`Erro na API TOTP: ${response.status}`)
      return "------"
    }
    
    const data = await response.json()
    
    if (data.error) {
      console.error(`Erro ao gerar TOTP: ${data.error}`)
      return "------"
    }
    
    return data.token || "------"
    
  } catch (error) {
    console.error(`Erro ao gerar TOTP para secret: ${secret}`, error)
    return "------"
  }
}

// Função para validar token com múltiplas tentativas de tempo
async function validateTOTP(secret: string, userToken: string): Promise<boolean> {
  try {
    // Para validação, vamos gerar o token atual e comparar
    const currentToken = await generateTOTP(secret)
    return currentToken === userToken
  } catch (error) {
    console.error('Erro na validação TOTP:', error)
    return false
  }
}

// Função para calcular tempo restante
function getTimeRemaining(): number {
  const now = Math.floor(Date.now() / 1000)
  return 30 - (now % 30)
}

export default function DashboardPage() {
  const [codes, setCodes] = useState<{ [key: string]: string }>({})
  const [timeRemaining, setTimeRemaining] = useState(30)
  const [isClient, setIsClient] = useState(false)
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false)
  const [showQRImportModal, setShowQRImportModal] = useState(false)
  const [editingCompany, setEditingCompany] = useState<typeof INSURANCE_COMPANIES[0] | null>(null)
  const [newSecret, setNewSecret] = useState("")
  const [newCompanyData, setNewCompanyData] = useState({
    name: "",
    fullName: "",
    secret: "",
    color: "#6600CC"
  })
  const [companies, setCompanies] = useState(INSURANCE_COMPANIES)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { toast } = useToast()
  
  // Verificar se estamos no cliente para evitar erros de hydration
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Sempre chamar useAuth() para manter a ordem dos hooks consistente
  const auth = useAuth()
  const { user, userData, logout } = auth

  // Função para salvar companies no Firestore (dados compartilhados)
  const saveCompaniesToFirestore = async (companiesData: typeof INSURANCE_COMPANIES) => {
    if (!user) return
    
    // Verificar se o usuário é admin antes de salvar
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem modificar as seguradoras",
        variant: "destructive"
      })
      return
    }
    
    try {
      await setDoc(doc(db, 'global-companies', 'data'), {
        companies: companiesData,
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid
      })
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error)
      toast({
        title: "Erro",
        description: "Erro ao salvar dados no servidor",
        variant: "destructive"
      })
    }
  }

  // Função para carregar companies do Firestore (dados compartilhados)
  const loadCompaniesFromFirestore = async () => {
    if (!user) return
    
    try {
      const docRef = doc(db, 'global-companies', 'data')
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        setCompanies(data.companies || INSURANCE_COMPANIES)
      } else {
        // Se não existe documento, usar dados padrão
        // Apenas admin pode criar o documento inicial
        setCompanies(INSURANCE_COMPANIES)
        if (userData?.role === "admin") {
          await saveCompaniesToFirestore(INSURANCE_COMPANIES)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar do Firestore:', error)
      setCompanies(INSURANCE_COMPANIES)
    } finally {
      setLoading(false)
    }
  }

  // Estado para rastrear se o log de acesso já foi registrado nesta sessão
  const [accessLogged, setAccessLogged] = useState(false)
  const [lastLoggedUserId, setLastLoggedUserId] = useState<string | null>(null)

  // Carregar dados quando usuário e userData estiverem disponíveis
  useEffect(() => {
    if (user && userData) {
      loadCompaniesFromFirestore()
      
      // Verificar se o usuário mudou (diferente do último usuário logado)
      const currentUserId = user.uid
      if (lastLoggedUserId !== currentUserId) {
        // Resetar estado de log para o novo usuário
        setAccessLogged(false)
        setLastLoggedUserId(currentUserId)
      }
      
      // Registrar log de acesso ao dashboard apenas uma vez por sessão por usuário
      if (!accessLogged) {
        logUserAccess(
          user.uid,
          userData.email || user.email || '',
          userData.role || 'user',
          'access_dashboard'
        ).catch(error => {
          console.error('Erro ao registrar log de acesso:', error)
        })
        setAccessLogged(true)
      }
    } else if (!auth.loading) {
      setLoading(false)
    }
  }, [user, userData, auth.loading, accessLogged, lastLoggedUserId])

  useEffect(() => {
    // Só executar redirecionamento no cliente
    if (isClient && !loading && !user) {
      router.push("/")
    }
  }, [user, loading, router, isClient])

  useEffect(() => {
    if (!isClient) return
    
    const updateCodes = async () => {
      const newCodes: { [key: string]: string } = {}
      
      // Gerar códigos para todas as companies
      for (const company of companies) {
        newCodes[company.name] = await generateTOTP(company.secret)
      }
      
      setCodes(newCodes)
      setTimeRemaining(getTimeRemaining())
    }

    updateCodes()
    const interval = setInterval(updateCodes, 1000)
    return () => clearInterval(interval)
  }, [companies, isClient])

  // useEffect para debug de códigos
  useEffect(() => {
    const fetchCode = async () => {
      const res = await fetch('/api/code');
      const data = await res.json();
      console.log("Token: ", data.token);
      console.log("Remaining: ", data.remaining);
    };

    fetchCode();
    const interval = setInterval(fetchCode, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      // Revogar session cookie no servidor
      if (user) {
        await fetch('/api/auth/session', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ uid: user.uid }),
        })
      }
      
      // Resetar estado de log de acesso
      setAccessLogged(false)
      
      // Fazer logout do Firebase Auth
      await logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      // Mesmo se houver erro, tentar fazer logout local
      await logout()
    }
  }

  const copyToClipboard = (code: string, serviceName: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code)
      toast({
        title: "Código copiado!",
        description: `Código do ${serviceName} copiado para a área de transferência`,
      })
    }
  }



  // Função para validar se o secret está em formato válido
  const isValidBase32 = (secret: string): boolean => {
    try {
      normalizeSecret(secret)
      return true
    } catch (error) {
      return false
    }
  }

  // Função para testar se um secret gera códigos válidos (validação básica)
  const testSecret = (secret: string): boolean => {
    try {
      if (!secret || secret.trim().length === 0) {
        return false
      }
      
      // Normalizar o secret
      const cleanSecret = normalizeSecret(secret)
      
      // Verificar se o secret tem pelo menos 16 caracteres e formato válido
      return cleanSecret.length >= 16 && /^[A-Z2-7]+$/.test(cleanSecret)
    } catch (error) {
      return false
    }
  }

  // Função para formatar secret (adicionar espaços a cada 4 caracteres para legibilidade)
  const formatSecret = (secret: string): string => {
    const clean = secret.replace(/\s/g, '').toUpperCase()
    return clean.replace(/(.{4})/g, '$1 ').trim()
  }

  // Função para editar secret de uma seguradora
  const openEditModal = (company: typeof INSURANCE_COMPANIES[0]) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem editar secrets",
        variant: "destructive"
      })
      return
    }

    setEditingCompany(company)
    setNewSecret(company.secret)
    setShowSecretModal(true)
  }

  // Função para salvar novo secret
  const saveSecret = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem editar secrets",
        variant: "destructive"
      })
      return
    }

    if (!editingCompany || !newSecret.trim()) {
      toast({
        title: "Erro",
        description: "Secret não pode estar vazio",
        variant: "destructive"
      })
      return
    }

    let cleanSecret
    try {
      cleanSecret = normalizeSecret(newSecret)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Formato inválido'
      toast({
        title: "Erro",
        description: `Secret inválido: ${errorMessage}`,
        variant: "destructive"
      })
      return
    }

    // Testar se o secret gera um código válido
    if (!testSecret(cleanSecret)) {
      toast({
        title: "Erro",
        description: "Secret inválido. Verifique se está no formato correto e se gera um código 6 dígitos.",
        variant: "destructive"
      })
      return
    }

    // Atualizar a lista de companies
    const updatedCompanies = companies.map(company => 
      company.name === editingCompany.name 
        ? { ...company, secret: cleanSecret }
        : company
    )
    
    setCompanies(updatedCompanies)
    await saveCompaniesToFirestore(updatedCompanies)
    
    // Registrar ação de admin
    if (user && userData) {
      await logAdminAction(
        user.uid,
        userData.email || user.email || '',
        'update_company_secret',
        editingCompany.name
      )
    }
    
    setShowSecretModal(false)
    setEditingCompany(null)
    setNewSecret("")
    
    toast({
      title: "Secret atualizado!",
      description: `Secret da ${editingCompany.name} foi atualizado com sucesso`,
    })
  }

  // Função para fechar modal
  const closeModal = () => {
    setShowSecretModal(false)
    setEditingCompany(null)
    setNewSecret("")
  }

  // Função para resetar secrets aos padrões
  const resetToDefaults = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem resetar secrets",
        variant: "destructive"
      })
      return
    }

    setCompanies(INSURANCE_COMPANIES)
    await saveCompaniesToFirestore(INSURANCE_COMPANIES)
    toast({
      title: "Secrets resetados!",
      description: "Todos os secrets foram restaurados aos valores padrão",
    })
  }

  // Função para adicionar nova seguradora
  const openAddCompanyModal = () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem adicionar seguradoras",
        variant: "destructive"
      })
      return
    }

    setNewCompanyData({
      name: "",
      fullName: "",
      secret: "",
      color: "#6600CC"
    })
    setShowAddCompanyModal(true)
  }

  // Função para salvar nova seguradora
  const saveNewCompany = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem adicionar seguradoras",
        variant: "destructive"
      })
      return
    }

    const { name, fullName, secret, color } = newCompanyData
    
    if (!name.trim() || !fullName.trim() || !secret.trim()) {
      toast({
        title: "Erro",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      })
      return
    }

    // Verificar se já existe uma seguradora com o mesmo nome
    if (companies.some(company => company.name.toLowerCase() === name.trim().toLowerCase())) {
      toast({
        title: "Erro",
        description: "Já existe uma seguradora com este nome",
        variant: "destructive"
      })
      return
    }

    let cleanSecret
    try {
      cleanSecret = normalizeSecret(secret)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Formato inválido'
      toast({
        title: "Erro",
        description: `Secret inválido: ${errorMessage}`,
        variant: "destructive"
      })
      return
    }

    // Testar se o secret gera um código válido
    if (!testSecret(cleanSecret)) {
      toast({
        title: "Erro",
        description: "Secret inválido. Verifique se está no formato correto e se gera um código 6 dígitos.",
        variant: "destructive"
      })
      return
    }

    const newCompany = {
      name: name.trim(),
      fullName: fullName.trim(),
      secret: cleanSecret,
      color: color,
      logo: "/placeholder-logo.png" // Logo padrão
    }

    const updatedCompanies = [...companies, newCompany]
    setCompanies(updatedCompanies)
    await saveCompaniesToFirestore(updatedCompanies)
    
    // Registrar ação de admin
    if (user && userData) {
      await logAdminAction(
        user.uid,
        userData.email || user.email || '',
        'add_company',
        newCompany.name
      )
    }
    
    setShowAddCompanyModal(false)
    
    toast({
      title: "Seguradora adicionada!",
      description: `${newCompany.name} foi adicionada com sucesso`,
    })
  }

  // Função para fechar modal de nova seguradora
  const closeAddCompanyModal = () => {
    setShowAddCompanyModal(false)
    setNewCompanyData({
      name: "",
      fullName: "",
      secret: "",
      color: "#6600CC"
    })
  }

  // Função para remover seguradora
  const removeCompany = async (companyName: string) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem remover seguradoras",
        variant: "destructive"
      })
      return
    }

    // Não permitir remover se restarem menos de 1 seguradora
    if (companies.length <= 1) {
      toast({
        title: "Erro",
        description: "Deve haver pelo menos uma seguradora no sistema",
        variant: "destructive"
      })
      return
    }

    const updatedCompanies = companies.filter(company => company.name !== companyName)
    setCompanies(updatedCompanies)
    await saveCompaniesToFirestore(updatedCompanies)
    
    // Registrar ação de admin
    if (user && userData) {
      await logAdminAction(
        user.uid,
        userData.email || user.email || '',
        'remove_company',
        companyName
      )
    }
    
    toast({
      title: "Seguradora removida!",
      description: `${companyName} foi removida do sistema`,
    })
  }



  // Função para abrir modal de importação QR
  const openQRImportModal = () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem importar QR codes",
        variant: "destructive"
      })
      return
    }

    setShowQRImportModal(true)
  }

  // Função para processar secrets importados do QR code
  const handleQRImport = async (importedSecrets: Array<{ name: string; fullName: string; secret: string; color: string }>) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem importar seguradoras",
        variant: "destructive"
      })
      return
    }

    try {
      // Verificar quais nomes já existem
      const existingNames = companies.map(c => c.name.toLowerCase())
      const newSecrets = importedSecrets.filter(secret => 
        !existingNames.includes(secret.name.toLowerCase())
      )

      if (newSecrets.length === 0) {
        toast({
          title: "Nenhum secret importado",
          description: "Todas as seguradoras já existem no sistema",
          variant: "destructive"
        })
        return
      }

      // Adicionar as novas seguradoras
      const updatedCompanies = [...companies, ...newSecrets.map(secret => ({
        name: secret.name,
        fullName: secret.fullName,
        secret: secret.secret,
        color: secret.color,
        logo: "/placeholder-logo.png"
      }))]

      setCompanies(updatedCompanies)
      await saveCompaniesToFirestore(updatedCompanies)

      toast({
        title: "Importação concluída!",
        description: `${newSecrets.length} seguradora(s) importada(s) com sucesso`,
      })

      // Mostrar quais foram ignoradas se houver
      const ignoredCount = importedSecrets.length - newSecrets.length
      if (ignoredCount > 0) {
        setTimeout(() => {
          toast({
            title: "Algumas seguradoras foram ignoradas",
            description: `${ignoredCount} seguradora(s) já existiam no sistema`,
          })
        }, 2000)
      }
    } catch (error) {
      console.error('Erro ao importar QR code:', error)
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar as seguradoras",
        variant: "destructive"
      })
    }
  }

  // Renderizar loading durante hidration ou se não está no cliente
  if (!isClient || auth.loading || loading) {
    return <LoadingScreen title="Carregando..." subtitle="Verificando suas permissões" size="lg" />
  }

  // Se não há usuário, não renderizar nada (redirecionamento em andamento)
  if (!user || !userData) {
    return <LoadingScreen title="Redirecionando..." subtitle="Você será redirecionado para o login" size="lg" />
  }

  // Verificar se é admin
  const isAdmin = userData.role === "admin"

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Image src="/appLogo.svg" alt="App Logo" width={60} height={60} className="h-13 w-13" />
              <div>
                <h1 className="text-xl font-bold text-[#6600CC]">Avantar Authenticator</h1>
                <p className="text-sm text-gray-500">Sistema de autenticação 2FA</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-[#6600CC] border-[#6600CC]">
                {userData.role === "admin" ? "Administrador" : "Franqueado"}
              </Badge>
              <span className="text-sm text-gray-600">{userData.email}</span>
              {userData.role === "admin" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin")}
                  className="border-[#6600CC] text-[#6600CC] hover:bg-[#6600CC] hover:text-white"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Códigos de Autenticação</h2>
            <p className="text-gray-500 text-lg">Códigos 2FA para sistemas das seguradoras</p>
          </div>

          {/* Timer - More elegant design */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600">Renovação automática</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-2xl font-light text-[#6600CC] tabular-nums">{timeRemaining}s</span>
                </div>
              </div>
              <Progress value={(timeRemaining / 30) * 100} className="h-1.5" />
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-8">
            {isAdmin && (
              <>
                <Button
                  onClick={openAddCompanyModal}
                  variant="outline"
                  className="border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 bg-white/50 backdrop-blur-sm rounded-full px-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Seguradora
                </Button>
                <Button
                  onClick={resetToDefaults}
                  variant="outline"
                  className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 bg-white/50 backdrop-blur-sm rounded-full px-6"
                >
                  Resetar Secrets
                </Button>
                <Button
                  onClick={openQRImportModal}
                  variant="outline"
                  className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 bg-white/50 backdrop-blur-sm rounded-full px-6"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Importar QR
                </Button>
                <Button
                  onClick={() => {
                    const testResults = companies.map(company => {
                      if (!company.secret) return null
                      const code = generateTOTP(company.secret)
                      const timestamp = Math.floor(Date.now() / 1000)
                      const step = Math.floor(timestamp / 30)
                      return `${company.name}: ${code} (step: ${step})`
                    }).filter(Boolean).join('\n')
                    
                    console.log('Debug TOTP:', testResults)
                    toast({
                      title: "Debug TOTP",
                      description: "Resultados exibidos no console do navegador",
                    })
                  }}
                  variant="outline"
                  className="border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 bg-white/50 backdrop-blur-sm rounded-full px-6"
                >
                  Debug TOTP
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Insurance Companies Grid - Modern minimalist design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {companies.map((company) => (
            <div
              key={company.name}
              className="group relative bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-[#6600CC]/20"
            >
              {/* Company Logo */}
              <div className="flex items-center justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center p-2">
                  <Image
                    src={company.logo || "/placeholder.svg"}
                    alt={`${company.name} Logo`}
                    width={48}
                    height={48}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              {/* Company Info */}
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-1">{company.name}</h3>
                <p className="text-sm text-gray-500">{company.fullName}</p>
              </div>

              {/* 2FA Code */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center">
                  <span className="font-mono text-3xl font-bold text-[#6600CC] tracking-wider bg-gray-50 px-4 py-2 rounded-xl">
                    {codes[company.name] || "------"}
                  </span>
                </div>
                {isAdmin && company.secret && (
                  <div className="mt-2 text-xs text-gray-500">
                    <div>Secret: {company.secret.substring(0, 8)}...</div>
                    <div>Timestamp: {Math.floor(Date.now() / 1000)}</div>
                    <div>Step: {Math.floor(Math.floor(Date.now() / 1000) / 30)}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(codes[company.name] || "", company.name)}
                  className="border-[#6600CC]/20 text-[#6600CC] hover:bg-[#6600CC] hover:text-white hover:border-[#6600CC] rounded-full px-4 transition-all duration-200"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                {isAdmin && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(company)}
                      className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 rounded-full px-4 transition-all duration-200"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeCompany(company.name)}
                      className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-full px-4 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>

              {/* Subtle accent line */}
              <div
                className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full opacity-20"
                style={{ backgroundColor: company.color }}
              ></div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal para editar secret */}
      <Dialog open={showSecretModal} onOpenChange={setShowSecretModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Secret da {editingCompany?.name}</DialogTitle>
            <DialogDescription>
              Configure o secret 2FA real para a seguradora {editingCompany?.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Como obter um secret real:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse o sistema da seguradora e vá para configurações de segurança</li>
                <li>Procure por "Autenticação de dois fatores" ou "2FA"</li>
                <li>Escolha a opção "Configurar com aplicativo autenticador"</li>
                <li>O sistema mostrará um QR code e um código de backup (secret)</li>
                <li>Copie o código de backup (secret) - geralmente 16+ caracteres em Base32</li>
                <li>Cole aqui e teste antes de salvar</li>
              </ol>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="secret" className="text-right font-medium">
                  Secret:
                </Label>
                <div className="col-span-3 space-y-2">
                  <Input
                    id="secret"
                    value={newSecret}
                    onChange={(e) => setNewSecret(e.target.value)}
                    placeholder="Ex: JBSWY3DPEHPK3PXP"
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Formato: Base32 (A-Z, 2-7), mínimo 16 caracteres
                  </p>
                </div>
              </div>
              
              {newSecret.trim() && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Teste do Secret:</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cleanSecret = newSecret.trim().toUpperCase().replace(/\s/g, '')
                        if (testSecret(cleanSecret)) {
                          const testCode = generateTOTP(cleanSecret)
                          toast({
                            title: "Secret válido! ✅",
                            description: `Código gerado: ${testCode}`,
                          })
                        } else {
                          toast({
                            title: "Secret inválido ❌",
                            description: "Verifique o formato e tente novamente",
                            variant: "destructive"
                          })
                        }
                      }}
                    >
                      Testar Secret
                    </Button>
                  </div>
                  <div className="text-sm">
                    {testSecret(newSecret.trim().toUpperCase().replace(/\s/g, '')) ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Secret válido - gerará códigos reais</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-red-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Secret inválido - verifique o formato</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button 
              onClick={saveSecret}
              disabled={!newSecret.trim() || !testSecret(newSecret.trim().toUpperCase().replace(/\s/g, ''))}
            >
              Salvar Secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal para adicionar nova seguradora */}
      <Dialog open={showAddCompanyModal} onOpenChange={setShowAddCompanyModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Nova Seguradora</DialogTitle>
            <DialogDescription>
              Configure uma nova seguradora com seu secret 2FA real.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-2">Como obter um secret real:</h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Acesse o sistema da seguradora e vá para configurações de segurança</li>
                <li>Procure por "Autenticação de dois fatores" ou "2FA"</li>
                <li>Escolha a opção "Configurar com aplicativo autenticador"</li>
                <li>O sistema mostrará um QR code e um código de backup (secret)</li>
                <li>Copie o código de backup (secret) - geralmente 16+ caracteres em Base32</li>
                <li>Preencha os dados abaixo e teste antes de salvar</li>
              </ol>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newCompanyName" className="font-medium">
                  Nome da Seguradora:
                </Label>
                <Input
                  id="newCompanyName"
                  value={newCompanyData.name}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, name: e.target.value })}
                  placeholder="Ex: AIG"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newCompanyFullName" className="font-medium">
                  Nome Completo:
                </Label>
                <Input
                  id="newCompanyFullName"
                  value={newCompanyData.fullName}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, fullName: e.target.value })}
                  placeholder="Ex: American International Group"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newCompanySecret" className="font-medium">
                  Secret 2FA:
                </Label>
                <Input
                  id="newCompanySecret"
                  value={newCompanyData.secret}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, secret: e.target.value })}
                  placeholder="Ex: JBSWY3DPEHPK3PXP"
                  className="font-mono"
                />
                <p className="text-xs text-gray-500">
                  Formato: Base32 (A-Z, 2-7), mínimo 16 caracteres
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newCompanyColor" className="font-medium">
                  Cor do tema:
                </Label>
                <Input
                  type="color"
                  id="newCompanyColor"
                  value={newCompanyData.color}
                  onChange={(e) => setNewCompanyData({ ...newCompanyData, color: e.target.value })}
                />
              </div>
            </div>
            
            {newCompanyData.secret.trim() && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Teste do Secret:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cleanSecret = newCompanyData.secret.trim().toUpperCase().replace(/\s/g, '')
                      if (testSecret(cleanSecret)) {
                        const testCode = generateTOTP(cleanSecret)
                        toast({
                          title: "Secret válido! ✅",
                          description: `Código gerado: ${testCode}`,
                        })
                      } else {
                        toast({
                          title: "Secret inválido ❌",
                          description: "Verifique o formato e tente novamente",
                          variant: "destructive"
                        })
                      }
                    }}
                  >
                    Testar Secret
                  </Button>
                </div>
                <div className="text-sm">
                  {testSecret(newCompanyData.secret.trim().toUpperCase().replace(/\s/g, '')) ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Secret válido - gerará códigos reais</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span>Secret inválido - verifique o formato</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAddCompanyModal}>
              Cancelar
            </Button>
            <Button 
              onClick={saveNewCompany}
              disabled={
                !newCompanyData.name.trim() || 
                !newCompanyData.fullName.trim() || 
                !newCompanyData.secret.trim() || 
                !testSecret(newCompanyData.secret.trim().toUpperCase().replace(/\s/g, ''))
              }
            >
              Adicionar Seguradora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

             {/* Modal para importar QR code */}
       <QRImporter 
         isOpen={showQRImportModal}
         onClose={() => setShowQRImportModal(false)}
         onImport={handleQRImport}
       />
    </div>
  )
}
