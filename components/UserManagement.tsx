"use client"

import React, { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
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
import { Plus, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen } from "@/components/ui/loading"
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { deleteUser } from 'firebase/auth'
import { db } from '@/lib/firebase'

interface UserData {
  uid: string
  email: string
  name?: string
  role: 'admin' | 'user'
  createdAt: string
  status: 'active' | 'inactive'
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "user" as "admin" | "user",
  })
  const [error, setError] = useState("")
  const { register, updateUserRole, userData } = useAuth()
  const { toast } = useToast()

  // Verificar se o usuário é administrador
  useEffect(() => {
    if (userData && userData.role !== 'admin') {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem acessar esta funcionalidade",
        variant: "destructive"
      })
      return
    }
    
    if (userData?.role === 'admin') {
      loadUsers()
    }
  }, [userData, toast])

  const loadUsers = async () => {
    // Verificar se o usuário é administrador
    if (!userData || userData.role !== 'admin') {
      console.error('Tentativa de acesso não autorizado ao gerenciamento de usuários')
      return
    }

    try {
      setLoading(true)
      const usersCollection = collection(db, 'users')
      const usersSnapshot = await getDocs(usersCollection)
      const usersData = usersSnapshot.docs.map(doc => ({
        ...doc.data(),
        uid: doc.id
      })) as UserData[]
      
      setUsers(usersData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de usuários",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!newUser.email || !newUser.password) {
      setError("Email e senha são obrigatórios")
      return
    }

    if (users.some((user) => user.email === newUser.email)) {
      setError("Este email já está cadastrado")
      return
    }

    try {
      // Criar usuário via API admin
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao criar usuário')
      }
      toast({
        title: "Usuário criado!",
        description: `${newUser.email} foi cadastrado com sucesso`,
      })
      setNewUser({ email: "", password: "", name: "", role: "user" })
      setIsDialogOpen(false)
      await loadUsers() // Recarregar lista de usuários
    } catch (error: any) {
      setError(error.message || "Erro ao criar usuário")
    }
  }

  const handleDeleteUser = async (uid: string, email: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${email}?`)) {
      try {
        // Remover documento do Firestore
        await deleteDoc(doc(db, 'users', uid))
        
        // Remover do Auth via API
        await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid })
        })
        
        toast({
          title: "Usuário removido",
          description: "O usuário foi removido com sucesso",
        })
        
        await loadUsers() // Recarregar lista
      } catch (error) {
        console.error('Erro ao remover usuário:', error)
        toast({
          title: "Erro",
          description: "Erro ao remover usuário",
          variant: "destructive"
        })
      }
    }
  }

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(uid, newRole)
      toast({
        title: "Role atualizada",
        description: "A função do usuário foi atualizada com sucesso",
      })
      await loadUsers() // Recarregar lista
    } catch (error) {
      console.error('Erro ao atualizar role:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar função do usuário",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <LoadingScreen title="Carregando usuários..." subtitle="Buscando dados do Firebase" size="md" fullScreen={false} />
  }

  return (
    <div className="space-y-6">
      {/* Header com botão de criar usuário */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Gerenciar Usuários</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#6600CC] hover:bg-[#5500AA] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
              <DialogDescription>
                Adicione um novo usuário ao sistema. Uma conta será criada no Firebase Auth.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="usuario@exemplo.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="name">Nome (opcional)</Label>
                <Input
                  id="name"
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Função</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: "admin" | "user") => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
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

              <div className="flex gap-2">
                <Button type="submit" className="bg-[#6600CC] hover:bg-[#5500AA] text-white">
                  Criar Usuário
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setError("")
                    setNewUser({ email: "", password: "", name: "", role: "user" })
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabela de usuários */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.uid}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>{user.name || '-'}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(value: 'admin' | 'user') => handleUpdateRole(user.uid, value)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Franqueado</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                    {user.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(user.uid, user.email)}
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum usuário encontrado
          </div>
        )}
      </div>
    </div>
  )
} 