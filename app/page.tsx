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

// Usuários pré-cadastrados para demonstração
const DEMO_USERS = [
  { email: "admin@avantar.com", password: "admin123", role: "admin" },
  { email: "franqueado@avantar.com", password: "franq123", role: "user" },
]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Verificar se já está logado
    const user = localStorage.getItem("currentUser")
    if (user) {
      router.push("/dashboard")
    }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    // Simular delay de autenticação
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const user = DEMO_USERS.find((u) => u.email === email && u.password === password)

    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user))
      router.push("/dashboard")
    } else {
      setError("Email ou senha incorretos")
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="flex justify-center">
            <Image
              src="/avantar_logo_completa.svg"
              alt="Avantar Logo"
              width={200}
              height={60}
              className="h-14 w-auto"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3 text-[#6600CC]">
              <div className="w-10 h-10 rounded-2xl bg-[#6600CC]/10 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <CardTitle className="text-2xl font-light">Sistema de Autenticação</CardTitle>
            </div>
            <CardDescription className="text-gray-500 text-base">
              Acesso seguro para códigos 2FA das seguradoras parceiras
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

            <Button type="submit" className="w-full bg-[#6600CC] hover:bg-[#5500AA] text-white" disabled={loading}>
              {loading ? "Autenticando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-8 p-6 bg-gradient-to-r from-gray-50 to-white rounded-2xl border border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-3">Credenciais de demonstração:</p>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="font-medium">Administrador:</span>
                <span className="font-mono text-xs">admin@avantar.com / admin123</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-white rounded-lg">
                <span className="font-medium">Franqueado:</span>
                <span className="font-mono text-xs">franqueado@avantar.com / franq123</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
