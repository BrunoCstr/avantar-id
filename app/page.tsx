"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Shield } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen, LoadingSpinner } from "@/components/ui/loading"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { user, userData, sessionReady, login } = useAuth()

  useEffect(() => {
    // Redirecionar apenas quando existir usuário, dados e cookie de sessão pronto
    if (user && userData && sessionReady) {
      router.push("/dashboard")
    }
  }, [user, userData, sessionReady, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Fazer login com Firebase Auth
      await login(email, password)

      // Aguardar um pouco para que o contexto seja atualizado
      setTimeout(() => {
      router.push("/dashboard")
        setLoading(false)
      }, 500)
      
    } catch (error: any) {
      console.error('Erro no login:', error)
      setError(error.message || "Erro ao fazer login")
      setLoading(false)
    }
  }

  // Se já está autenticado, mostrar loader antes de redirecionar
  if (user && userData) {
    return <LoadingScreen title="Autenticando..." subtitle="Redirecionando para o dashboard" size="lg" />
  }

  // Se está fazendo login, mostrar loader
  if (loading) {
    return <LoadingScreen title="Fazendo login..." subtitle="Aguarde um momento" size="lg" />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <Image
              src="/avantar_logo_completa.jpg"
              alt="Avantar Logo"
              width={250}
              height={40}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 text-[#6600CC]">
              <div className="w-10 h-10 rounded-2xl bg-[#6600CC]/10 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle className="text-2xl font-bold">Sistema de Autenticação</CardTitle>
            </div>
            <CardDescription className="text-gray-500 text-base">
              Acesso seguro para códigos 2FA das seguradoras.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-gray-300 focus:border-[#6600CC] focus:ring-[#6600CC]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-gray-300 focus:border-[#6600CC] focus:ring-[#6600CC] pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-600">{error}</AlertDescription>
              </Alert>
            )}

            {/* Debug: mostrar se Firebase está configurado */}
            {!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-700">
                  ⚠️ Firebase não configurado. Configure as variáveis de ambiente em .env.local
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full bg-[#6600CC] hover:bg-[#5500AA] text-white" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner size="sm" />
                  Autenticando...
                </div>
              ) : (
                "Entrar"
              )}
            </Button>

            <div className="pt-2 text-center">
              <a 
                href="/forgot-password"
                className="text-sm text-[#6600CC] hover:text-[#5500AA] hover:underline transition-colors"
              >
                Esqueci minha senha
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
