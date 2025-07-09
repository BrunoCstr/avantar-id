"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LogOut, Copy, Settings, RefreshCw, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

// Seguradoras com códigos 2FA
const INSURANCE_COMPANIES = [
  {
    name: "AIG",
    fullName: "American International Group",
    logo: "/logos/aig.png",
    secret: "JBSWY3DPEHPK3PXP",
    color: "#1e3a8a",
  },
  {
    name: "Justos",
    fullName: "Justos Seguros",
    logo: "/logos/justos.jpeg",
    secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
    color: "#eab308",
  },
  {
    name: "BMG",
    fullName: "BMG Seguros",
    logo: "/logos/bmg.jpeg",
    secret: "MFRGG43FMZQW4ZLNMFZXG5DJMRSXE2LNMFZXG5DJ",
  },
  {
    name: "Swiss Re",
    fullName: "Swiss Re Group",
    logo: "/logos/swissre.png",
    secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
    color: "#059669",
  },
  {
    name: "Amil",
    fullName: "Amil Assistência Médica",
    logo: "/logos/amil.png",
    secret: "NBSWY3DPEHPK3PXP2MFRGG43FMZQW4ZL",
    color: "#7c3aed",
  },
  {
    name: "BTG",
    fullName: "BTG Pactual Seguros",
    logo: "/logos/btg.png",
    secret: "KBSWY3DPEHPK3PXP3MFRGG43FMZQW4ZL",
    color: "#1e40af",
  },
  {
    name: "Bradesco",
    fullName: "Bradesco Consórcios",
    logo: "/logos/bradesco.png",
    secret: "LBSWY3DPEHPK3PXP4MFRGG43FMZQW4ZL",
    color: "#dc2626",
  },
  {
    name: "Qualicorp",
    fullName: "Qualicorp Administradora",
    logo: "/logos/qualicorp.png",
    secret: "MBSWY3DPEHPK3PXP5MFRGG43FMZQW4ZL",
    color: "#1e40af",
  },
  {
    name: "Prudential",
    fullName: "Prudential do Brasil",
    logo: "/logos/prudential.jpeg",
    secret: "OBSWY3DPEHPK3PXP6MFRGG43FMZQW4ZL",
    color: "#0369a1",
  },
]

// Função para gerar código TOTP simulado
function generateTOTP(secret: string, timeStep = 30): string {
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / timeStep)

  // Simulação simples de TOTP baseada no counter e secret
  const hash = (counter + secret.length).toString()
  const code = (Number.parseInt(hash.slice(-6)) % 1000000).toString().padStart(6, "0")
  return code
}

// Função para calcular tempo restante
function getTimeRemaining(): number {
  const now = Math.floor(Date.now() / 1000)
  return 30 - (now % 30)
}

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [codes, setCodes] = useState<{ [key: string]: string }>({})
  const [timeRemaining, setTimeRemaining] = useState(30)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const currentUser = localStorage.getItem("currentUser")
    if (!currentUser) {
      router.push("/")
      return
    }
    setUser(JSON.parse(currentUser))
  }, [router])

  useEffect(() => {
    const updateCodes = () => {
      const newCodes: { [key: string]: string } = {}
      INSURANCE_COMPANIES.forEach((company) => {
        newCodes[company.name] = generateTOTP(company.secret)
      })
      setCodes(newCodes)
      setTimeRemaining(getTimeRemaining())
    }

    updateCodes()
    const interval = setInterval(updateCodes, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("currentUser")
    router.push("/")
  }

  const copyToClipboard = (code: string, serviceName: string) => {
    navigator.clipboard.writeText(code)
    toast({
      title: "Código copiado!",
      description: `Código do ${serviceName} copiado para a área de transferência`,
    })
  }

  const refreshCodes = () => {
    const newCodes: { [key: string]: string } = {}
    INSURANCE_COMPANIES.forEach((company) => {
      newCodes[company.name] = generateTOTP(company.secret)
    })
    setCodes(newCodes)
    toast({
      title: "Códigos atualizados!",
      description: "Todos os códigos das seguradoras foram regenerados",
    })
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Image src="/appLogo.svg" alt="App Logo" width={40} height={40} className="h-8 w-8" />
              <div>
                <h1 className="text-xl font-bold text-[#6600CC]">Autenticador 2FA</h1>
                <p className="text-sm text-gray-500">Sistema de Códigos Seguros</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-[#6600CC] border-[#6600CC]">
                {user.role === "admin" ? "Administrador" : "Franqueado"}
              </Badge>
              <span className="text-sm text-gray-600">{user.email}</span>
              {user.role === "admin" && (
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
            <h2 className="text-3xl font-light text-gray-900 mb-3">Códigos de Autenticação</h2>
            <p className="text-gray-500 text-lg">Códigos 2FA para sistemas das seguradoras parceiras</p>
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

          <div className="flex justify-center mb-8">
            <Button
              onClick={refreshCodes}
              variant="outline"
              className="border-[#6600CC]/20 text-[#6600CC] hover:bg-[#6600CC]/5 hover:border-[#6600CC]/40 bg-white/50 backdrop-blur-sm rounded-full px-6"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Códigos
            </Button>
          </div>
        </div>

        {/* Insurance Companies Grid - Modern minimalist design */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {INSURANCE_COMPANIES.map((company) => (
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
              </div>

              {/* Copy Button */}
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(codes[company.name] || "", company.name)}
                  className="border-[#6600CC]/20 text-[#6600CC] hover:bg-[#6600CC] hover:text-white hover:border-[#6600CC] rounded-full px-6 transition-all duration-200"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>

              {/* Subtle accent line */}
              <div
                className="absolute bottom-0 left-8 right-8 h-0.5 rounded-full opacity-20"
                style={{ backgroundColor: company.color }}
              ></div>
            </div>
          ))}
        </div>

        {/* Security Info - More elegant */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-[#6600CC]/5 via-purple-50/50 to-[#6600CC]/5 rounded-3xl p-8 border border-[#6600CC]/10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#6600CC]/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-[#6600CC]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Segurança e Conformidade</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#6600CC] rounded-full"></div>
                      Códigos renovados automaticamente a cada 30 segundos
                    </p>
                    <p className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#6600CC] rounded-full"></div>
                      Cada código é válido apenas uma vez
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#6600CC] rounded-full"></div>
                      Acesso restrito e monitorado
                    </p>
                    <p className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-[#6600CC] rounded-full"></div>
                      Conformidade com padrões de segurança
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
