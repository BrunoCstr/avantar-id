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
import { Plus, Trash2, X, Edit3, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/AuthContext"
import { LoadingScreen } from "@/components/ui/loading"
import { collection, getDocs, deleteDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase'
import { CompanyData, UserData } from '@/lib/types'

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<CompanyData[]>([])
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [showEditPassword, setShowEditPassword] = useState(false)
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const { userData } = useAuth()
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
      loadCompanies()
      loadUsers()
    }
  }, [userData, toast])

  // Filtrar companies baseado nos filtros
  useEffect(() => {
    let filtered = companies

    // Filtro por nome
    if (searchTerm) {
      filtered = filtered.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.fullName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por dono
    if (ownerFilter && ownerFilter !== 'all') {
      if (ownerFilter === 'system') {
        filtered = filtered.filter(company => !company.ownerId)
      } else if (ownerFilter === 'private') {
        filtered = filtered.filter(company => company.ownerId)
      } else {
        // Filtro por usuário específico
        filtered = filtered.filter(company => company.ownerId === ownerFilter)
      }
    }

    setFilteredCompanies(filtered)
  }, [companies, searchTerm, ownerFilter])

  const loadCompanies = async () => {
    // Verificar se o usuário é administrador
    if (!userData || userData.role !== 'admin') {
      console.error('Tentativa de acesso não autorizado ao gerenciamento de seguradoras')
      return
    }

    try {
      setLoading(true)
      // Listener em tempo real
      const unsubscribe = onSnapshot(
        collection(db, "companies"),
        (querySnapshot) => {
          const companiesList: CompanyData[] = []
          querySnapshot.forEach((doc) => {
            const data = doc.data()
            companiesList.push({ 
              id: doc.id, 
              ...data,
              tags: data.tags || [],
              isPrivate: data.isPrivate || false,
              ownerId: data.ownerId || null
            } as CompanyData)
          })
          // Ordenar companies por nome
          const companiesSorted = companiesList.sort((a: CompanyData, b: CompanyData) =>
            a.name.localeCompare(b.name)
          )
          setCompanies(companiesSorted)
          setFilteredCompanies(companiesSorted)
          setLoading(false)
        }
      )
      // Limpar listener ao desmontar
      return () => unsubscribe()
    } catch (error) {
      console.error('Erro ao carregar seguradoras:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar lista de seguradoras",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[]
      setUsers(usersData)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      toast({
        title: "Erro",
        description: "Erro ao carregar usuários",
        variant: "destructive"
      })
    }
  }

  const handleUpdateTags = async (companyId: string, newTags: string[]) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), { tags: newTags })
      toast({
        title: "Tags atualizadas",
        description: "As tags da seguradora foram atualizadas com sucesso",
      })
    } catch (error) {
      console.error('Erro ao atualizar tags:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar tags da seguradora",
        variant: "destructive"
      })
    }
  }

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    if (window.confirm(`Tem certeza que deseja excluir a seguradora ${companyName}?`)) {
      try {
        await deleteDoc(doc(db, 'companies', companyId))
        toast({
          title: "Seguradora removida",
          description: "A seguradora foi removida com sucesso",
        })
      } catch (error) {
        console.error('Erro ao remover seguradora:', error)
        toast({
          title: "Erro",
          description: "Erro ao remover seguradora",
          variant: "destructive"
        })
      }
    }
  }

  const handleEditCompany = (company: CompanyData) => {
    setEditingCompany(company)
    setIsDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editingCompany) return

    try {
      let logoUrl = editingCompany.logo

      // Upload do logo se um novo arquivo foi selecionado
      if (editLogoFile) {
        const logoRef = ref(storage, `company-logos/${editingCompany.id}-${Date.now()}`)
        const snapshot = await uploadBytes(logoRef, editLogoFile)
        logoUrl = await getDownloadURL(snapshot.ref)
      }

      await updateDoc(doc(db, 'companies', editingCompany.id!), {
        name: editingCompany.name,
        fullName: editingCompany.fullName,
        secret: editingCompany.secret,
        color: editingCompany.color,
        authType: editingCompany.authType,
        email: editingCompany.email || "",
        receiverEmail: editingCompany.receiverEmail || "",
        receiverEmailPassword: editingCompany.receiverEmailPassword || "",
        tags: editingCompany.tags || [],
        isPrivate: editingCompany.isPrivate || false,
        ownerId: editingCompany.ownerId || null,
        logo: logoUrl,
      })
      
      toast({
        title: "Seguradora atualizada",
        description: "A seguradora foi atualizada com sucesso",
      })
      
      setIsDialogOpen(false)
      setEditingCompany(null)
      setEditLogoFile(null)
    } catch (error) {
      console.error('Erro ao atualizar seguradora:', error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar seguradora",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <LoadingScreen title="Carregando seguradoras..." subtitle="Buscando dados do Firebase" size="md" fullScreen={false} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-900">Gerenciar Seguradoras</h2>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <Label htmlFor="search">Buscar por nome</Label>
          <Input
            id="search"
            placeholder="Digite o nome da seguradora..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-48">
          <Label htmlFor="ownerFilter">Filtrar por dono</Label>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
              <SelectItem value="private">Usuários</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.uid} value={user.uid}>
                  {user.name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabela de seguradoras */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Nome Completo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.fullName}</TableCell>
                <TableCell>
                  <Badge className={company.authType === 'totp' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                    {company.authType === 'totp' ? 'TOTP' : 'E-mail'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {company.tags && company.tags.length > 0 ? (
                      company.tags.map((tag) => (
                        <Badge 
                          key={tag}
                          variant="outline"
                          className={`text-xs flex items-center gap-1 ${
                            tag === 'Único' 
                              ? 'bg-purple-100 text-purple-800 border-purple-200' 
                              : tag === 'Treino'
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : tag === 'Individual'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}
                        >
                          {tag}
                          <button
                            onClick={() => {
                              const newTags = company.tags?.filter(t => t !== tag) || []
                              handleUpdateTags(company.id!, newTags)
                            }}
                            className="hover:bg-gray-200 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-gray-400 text-sm">Sem tags</span>
                    )}
                  </div>
                  <div className="mt-1">
                    <Select
                      value="add-tag"
                      onValueChange={(value) => {
                        if (value && value !== "add-tag" && !company.tags?.includes(value)) {
                          const newTags = [...(company.tags || []), value]
                          handleUpdateTags(company.id!, newTags)
                        }
                      }}
                    >
                      <SelectTrigger className="w-24 h-6 text-xs">
                        <SelectValue placeholder="+" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add-tag" disabled>+</SelectItem>
                        <SelectItem value="Único">Único</SelectItem>
                        <SelectItem value="Treino">Treino</SelectItem>
                        <SelectItem value="Individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TableCell>
                <TableCell>
                  {company.ownerId ? (
                    <span className="text-sm text-gray-600">
                      {users.find(u => u.uid === company.ownerId)?.name || 
                       users.find(u => u.uid === company.ownerId)?.email || 
                       'Usuário específico'}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Sistema</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditCompany(company)}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCompany(company.id!, company.name)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {companies.length === 0 ? 'Nenhuma seguradora encontrada' : 'Nenhuma seguradora corresponde aos filtros'}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Seguradora</DialogTitle>
            <DialogDescription>
              Edite os dados da seguradora selecionada.
            </DialogDescription>
          </DialogHeader>
          {editingCompany && (
            <div className="grid gap-6 py-4">
              {/* Tipo de Autenticação */}
              <div className="space-y-2">
                <Label htmlFor="editAuthType" className="font-medium">
                  Tipo de Autenticação:
                </Label>
                <select
                  id="editAuthType"
                  value={editingCompany.authType}
                  onChange={(e) =>
                    setEditingCompany({
                      ...editingCompany,
                      authType: e.target.value as "totp" | "email",
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6600CC] focus:border-transparent"
                >
                  <option value="totp">TOTP MFA</option>
                  <option value="email">E-mail</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName" className="font-medium">
                    Nome da Seguradora:
                  </Label>
                  <Input
                    id="editName"
                    value={editingCompany.name}
                    onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                    placeholder="Ex: AIG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editFullName" className="font-medium">
                    Nome Completo:
                  </Label>
                  <Input
                    id="editFullName"
                    value={editingCompany.fullName}
                    onChange={(e) => setEditingCompany({ ...editingCompany, fullName: e.target.value })}
                    placeholder="Ex: American International Group"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSecret" className="font-medium">
                    Secret 2FA:
                  </Label>
                  <Input
                    id="editSecret"
                    value={editingCompany.secret}
                    onChange={(e) => setEditingCompany({ ...editingCompany, secret: e.target.value })}
                    placeholder="Ex: JBSWY3DPEHPK3PXP"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editColor" className="font-medium">
                    Cor do tema:
                  </Label>
                  <Input
                    type="color"
                    id="editColor"
                    value={editingCompany.color}
                    onChange={(e) => setEditingCompany({ ...editingCompany, color: e.target.value })}
                  />
                </div>
              </div>

              {/* Campos específicos para email */}
              {editingCompany.authType === "email" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="editEmail" className="font-medium">
                      E-mail da Seguradora:
                    </Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editingCompany.email || ""}
                      onChange={(e) =>
                        setEditingCompany({
                          ...editingCompany,
                          email: e.target.value,
                        })
                      }
                      placeholder="Ex: noreply@seguradora.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="editReceiverEmail"
                      className="font-medium"
                    >
                      E-mail que receberá o código:
                    </Label>
                    <Input
                      id="editReceiverEmail"
                      type="email"
                      value={editingCompany.receiverEmail || ""}
                      onChange={(e) =>
                        setEditingCompany({
                          ...editingCompany,
                          receiverEmail: e.target.value,
                        })
                      }
                      placeholder="Ex: contato@avantar.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="editReceiverEmailPassword"
                      className="font-medium"
                    >
                      Senha do e-mail que receberá o código:
                    </Label>
                    <div className="relative">
                      <Input
                        id="editReceiverEmailPassword"
                        type={showEditPassword ? "text" : "password"}
                        value={editingCompany.receiverEmailPassword || ""}
                        onChange={(e) =>
                          setEditingCompany({
                            ...editingCompany,
                            receiverEmailPassword: e.target.value,
                          })
                        }
                        placeholder="Digite a senha do e-mail"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                        onClick={() => setShowEditPassword((v) => !v)}
                      >
                        {showEditPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Upload de Logo */}
              <div className="space-y-2">
                <Label htmlFor="editLogo" className="font-medium">
                  Logo da Seguradora:
                </Label>
                <Input
                  id="editLogo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditLogoFile(file);
                  }}
                />
                {editingCompany.logo && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-2">Logo atual:</p>
                    <img
                      src={editingCompany.logo}
                      alt={`Logo ${editingCompany.name}`}
                      className="w-16 h-16 object-contain border rounded"
                    />
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label className="font-medium">Tags da Seguradora:</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {editingCompany.tags && editingCompany.tags.length > 0 ? (
                    editingCompany.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className={`text-xs flex items-center gap-1 ${
                          tag === 'Único'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : tag === 'Treino'
                            ? 'bg-orange-100 text-orange-800 border-orange-200'
                            : 'bg-gray-100 text-gray-800 border-gray-200'
                        }`}
                      >
                        {tag}
                        <button
                          onClick={() => {
                            const newTags = editingCompany.tags?.filter(t => t !== tag) || []
                            setEditingCompany({ ...editingCompany, tags: newTags })
                          }}
                          className="hover:bg-gray-200 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-gray-400 text-sm">Sem tags</span>
                  )}
                </div>
                <Select
                  value="add-tag"
                  onValueChange={(value) => {
                    if (value && value !== "add-tag" && !editingCompany.tags?.includes(value)) {
                      const newTags = [...(editingCompany.tags || []), value]
                      setEditingCompany({ ...editingCompany, tags: newTags })
                    }
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Adicionar tag" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add-tag" disabled>Adicionar tag</SelectItem>
                    <SelectItem value="Único">Único</SelectItem>
                    <SelectItem value="Treino">Treino</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
