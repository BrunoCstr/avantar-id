"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen, LoadingSpinner } from "@/components/ui/loading"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (error: any) {
      console.error('Erro ao enviar email de reset:', error)
      
      // Mensagens de erro mais amigáveis
      if (error.message.includes('user-not-found')) {
        setError("Não encontramos uma conta com este email.")
      } else if (error.message.includes('invalid-email')) {
        setError("Por favor, insira um email válido.")
      } else {
        setError(error.message || "Erro ao enviar email de recuperação. Tente novamente.")
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading && !success) {
    return <LoadingScreen title="Enviando email..." subtitle="Aguarde um momento" size="lg" />
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
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
            </div>
            <CardDescription className="text-gray-500 text-base">
              Digite seu email e enviaremos um link para redefinir sua senha.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Email enviado com sucesso! Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                </AlertDescription>
              </Alert>
              <div className="space-y-2 text-sm text-gray-600">
                <p>Não recebeu o email?</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Verifique sua pasta de spam</li>
                  <li>Certifique-se de que o email está correto</li>
                  <li>Aguarde alguns minutos e tente novamente</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 pt-4">
                <Button
                  onClick={() => router.push('/')}
                  className="w-full bg-[#6600CC] hover:bg-[#5500AA] text-white"
                >
                  Voltar para o login
                </Button>
                <Button
                  onClick={() => {
                    setSuccess(false)
                    setEmail("")
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Enviar novamente
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-600">{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full bg-[#6600CC] hover:bg-[#5500AA] text-white" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Enviando...
                  </div>
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>

              <div className="pt-4">
                <Link 
                  href="/"
                  className="flex items-center justify-center gap-2 text-sm text-[#6600CC] hover:text-[#5500AA] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
