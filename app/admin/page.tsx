"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Users, Shield } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"

interface User {
  id: string
  email: string
  role: "admin" | "user"
  createdAt: string
  status: "active" | "inactive"
}

export default function AdminPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    role: "user" as "admin" | "user",
  })
  const [error, setError] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const user = localStorage.getItem("currentUser")
    if (!user) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(user)
    if (parsedUser.role !== "admin") {
      router.push("/dashboard")
      return
    }

    setCurrentUser(parsedUser)
    loadUsers()
  }, [router])

  const loadUsers = () => {
    const savedUsers = localStorage.getItem("registeredUsers")
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers))
    } else {
      // Usuários iniciais
      const initialUsers: User[] = [
        {
          id: "1",
          email: "admin@avantar.com",
          role: "admin",
          createdAt: new Date().toISOString(),
          status: "active",
        },
        {
          id: "2",
          email: "franqueado@avantar.com",
          role: "user",
          createdAt: new Date().toISOString(),
          status: "active",
        },
      ]
      setUsers(initialUsers)
      localStorage.setItem("registeredUsers", JSON.stringify(initialUsers))
    }
  }

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!newUser.email || !newUser.password) {
      setError("Todos os campos são obrigatórios")
      return
    }

    if (users.some((user) => user.email === newUser.email)) {
      setError("Este email já está cadastrado")
      return
    }

    const user: User = {
      id: Date.now().toString(),
      email: newUser.email,
      role: newUser.role,
      createdAt: new Date().toISOString(),
      status: "active",
    }

    const updatedUsers = [...users, user]
    setUsers(updatedUsers)
    localStorage.setItem("registeredUsers", JSON.stringify(updatedUsers))

    // Salvar credenciais para login (em produção, isso seria no backend)
    const loginUsers = JSON.parse(localStorage.getItem("loginUsers") || "[]")
    loginUsers.push({
      email: newUser.email,
      password: newUser.password,
      role: newUser.role,
    })
    localStorage.setItem("loginUsers", JSON.stringify(loginUsers))

    toast({
      title: "Usuário criado!",
      description: `${newUser.email} foi cadastrado com sucesso`,
    })

    setNewUser({ email: "", password: "", role: "user" })
    setIsDialogOpen(false)
  }

  const handleDeleteUser = (userId: string) => {
    const updatedUsers = users.filter((user) => user.id !== userId)
    setUsers(updatedUsers)
    localStorage.setItem("registeredUsers", JSON.stringify(updatedUsers))

    toast({
      title: "Usuário removido",
      description: "O usuário foi removido com sucesso",
    })
  }

  if (!currentUser) return null

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
              <span className="text-sm text-gray-600">{currentUser.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total de Usuários</p>
                <p className="text-3xl font-light text-[#6600CC]">{users.length}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#6600CC]/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#6600CC]" />
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Usuários Ativos</p>
                <p className="text-3xl font-light text-green-600">
                  {users.filter((u) => u.status === "active").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Administradores</p>
                <p className="text-3xl font-light text-blue-600">{users.filter((u) => u.role === "admin").length}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Users Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl text-gray-900">Usuários Cadastrados</CardTitle>
                <CardDescription>Gerencie os usuários com acesso ao sistema de autenticação</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#6600CC] hover:bg-[#5500AA] text-white">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
                    <DialogDescription>Adicione um novo usuário ao sistema de autenticação</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Função</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: "admin" | "user") => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a função" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Franqueado</SelectItem>
                          <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {error && (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertDescription className="text-red-600">{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1 bg-[#6600CC] hover:bg-[#5500AA] text-white">
                        Cadastrar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "secondary"}
                        className={user.role === "admin" ? "bg-[#6600CC] hover:bg-[#5500AA]" : ""}
                      >
                        {user.role === "admin" ? "Administrador" : "Franqueado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={user.status === "active" ? "default" : "secondary"}
                        className={user.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {user.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      {user.email !== currentUser.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
