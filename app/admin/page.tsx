"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Users, Shield } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen } from "@/components/ui/loading"
import UserManagement from "@/components/UserManagement"
import CompanyManagement from "@/components/CompanyManagement"
import Image from "next/image"

export default function AdminPage() {
  const router = useRouter()
  const { user, userData, loading } = useAuth()

  useEffect(() => {
    // Se não está carregando e não há usuário, redirecionar para login
    if (!loading && !user) {
      router.push("/")
      return
    }

    // Se usuário não é admin, redirecionar para dashboard
    if (!loading && userData && userData.role !== "admin") {
      router.push("/dashboard")
      return
    }
  }, [user, userData, loading, router])

  if (loading) {
    return <LoadingScreen title="Carregando Administração..." subtitle="Verificando permissões de administrador" size="lg" />
  }

  if (!user || !userData || userData.role !== "admin") return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push("/dashboard")}
                className="text-[#6600CC] hover:bg-[#6600CC]/10 rounded-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="w-10 h-10 rounded-2xl bg-[#6600CC]/10 flex items-center justify-center">
                <Image src="/appLogo.svg" alt="App Logo" width={24} height={24} />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#6600CC]">Administração</h1>
                <p className="text-sm text-gray-500">Gerenciamento de Usuários do Sistema</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="text-[#6600CC] border-[#6600CC]">
                Administrador
              </Badge>
              <span className="text-sm text-gray-600">{userData.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/60 backdrop-blur-sm border border-gray-200 rounded-xl p-1 shadow-lg">
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-2 data-[state=active]:bg-[#6600CC] data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <Users className="h-4 w-4" />
              Gerenciar Usuários
            </TabsTrigger>
            <TabsTrigger 
              value="companies" 
              className="flex items-center gap-2 data-[state=active]:bg-[#6600CC] data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg transition-all duration-200"
            >
              <Shield className="h-4 w-4" />
              Gerenciar Seguradoras
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-8">
            <UserManagement />
          </TabsContent>
          
          <TabsContent value="companies" className="mt-8">
            <CompanyManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
