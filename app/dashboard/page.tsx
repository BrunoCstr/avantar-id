"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LogOut,
  Copy,
  Settings,
  Shield,
  Edit3,
  Plus,
  Trash2,
  QrCode,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/ui/loading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Mail } from "lucide-react";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc as firestoreDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QRImporter } from "@/components/QRImporter";
import { logUserAccess, logAdminAction } from "@/lib/access-logs";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Função para normalizar secret key
function normalizeSecret(secret: string): string {
  if (!secret || secret.trim().length === 0) {
    throw new Error("Secret não pode estar vazio");
  }

  // Remover espaços e converter para uppercase
  let normalized = secret.trim().toUpperCase().replace(/[\s-]/g, "");

  // Se contém caracteres não Base32, pode ser hex - converter para Base32
  if (!/^[A-Z2-7=]+$/.test(normalized)) {
    // Tentar interpretar como hex e converter para base32
    if (/^[0-9A-F]+$/i.test(normalized)) {
      try {
        // Converter hex para buffer e depois para base32
        const buffer = Buffer.from(normalized, "hex");
        normalized = buffer
          .toString("base64")
          .replace(/=/g, "")
          .replace(/\+/g, "2")
          .replace(/\//g, "7");
      } catch (error: unknown) {
        throw new Error("Secret em formato inválido");
      }
    } else {
      throw new Error("Secret deve estar em formato Base32 ou Hex");
    }
  }

  // Validar tamanho mínimo
  if (normalized.length < 16) {
    throw new Error("Secret muito curto (mínimo 16 caracteres)");
  }

  return normalized;
}

// Função para gerar código TOTP usando a API
async function generateTOTP(secret: string): Promise<string> {
  try {
    // Verificar se o secret existe e não está vazio
    if (!secret || secret.trim().length === 0) {
      return "------";
    }

    // Chamar a API para gerar o token
    const response = await fetch(
      `/api/totp?secret=${encodeURIComponent(secret)}`
    );

    if (!response.ok) {
      console.error(`Erro na API TOTP: ${response.status}`);
      return "------";
    }

    const data = await response.json();

    if (data.error) {
      console.error(`Erro ao gerar TOTP: ${data.error}`);
      return "------";
    }

    return data.token || "------";
  } catch (error) {
    console.error(`Erro ao gerar TOTP para secret: ${secret}`, error);
    return "------";
  }
}

// Função para calcular tempo restante
function getTimeRemaining(): number {
  const now = Math.floor(Date.now() / 1000);
  return 30 - (now % 30);
}

export default function DashboardPage() {
  const [codes, setCodes] = useState<{ [key: string]: string }>({});
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [isClient, setIsClient] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [showQRImportModal, setShowQRImportModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [newSecret, setNewSecret] = useState("");
  const [newCompanyData, setNewCompanyData] = useState({
    name: "",
    fullName: "",
    secret: "",
    color: "#6600CC",
    authType: "totp" as "totp" | "email",
    email: "",
    receiverEmail: "",
    receiverEmailPassword: "",
    logoFile: null as File | null,
  });
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();
  const [editCompanyData, setEditCompanyData] = useState<any>(null);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);

  // 1. Adicionar estado para mostrar/ocultar senha
  const [showNewCompanyPassword, setShowNewCompanyPassword] = useState(false);
  const [showEditCompanyPassword, setShowEditCompanyPassword] = useState(false);

  // Verificar se estamos no cliente para evitar erros de hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sempre chamar useAuth() para manter a ordem dos hooks consistente
  const auth = useAuth();
  const { user, userData, logout } = auth;

  // Função para carregar companies do Firestore (dados compartilhados) - agora usando onSnapshot
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    // Listener em tempo real
    const unsubscribe = onSnapshot(
      collection(db, "companies"),
      (querySnapshot) => {
        const companiesList: any[] = [];
        querySnapshot.forEach((doc) => {
          companiesList.push({ id: doc.id, ...doc.data() });
        });
        // Ordenar companies por nome
        const companiesSorted = companiesList.sort((a: any, b: any) =>
          a.name.localeCompare(b.name)
        );
        setCompanies(companiesSorted);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar do Firestore:", error);
        setCompanies([]);
        setLoading(false);
      }
    );
    // Limpar listener ao desmontar
    return () => unsubscribe();
  }, [user]);

  // Estado para rastrear se o log de acesso já foi registrado nesta sessão
  const [accessLogged, setAccessLogged] = useState(false);
  const [lastLoggedUserId, setLastLoggedUserId] = useState<string | null>(null);

  // Carregar dados quando usuário e userData estiverem disponíveis
  useEffect(() => {
    if (user && userData) {
      // Verificar se o usuário mudou (diferente do último usuário logado)
      const currentUserId = user.uid;
      if (lastLoggedUserId !== currentUserId) {
        // Resetar estado de log para o novo usuário
        setAccessLogged(false);
        setLastLoggedUserId(currentUserId);
      }
      // Registrar log de acesso ao dashboard apenas uma vez por sessão por usuário
      if (!accessLogged) {
        logUserAccess(
          user.uid,
          userData.email || user.email || "",
          userData.role || "user",
          "access_dashboard"
        ).catch((error) => {
          console.error("Erro ao registrar log de acesso:", error);
        });
        setAccessLogged(true);
      }
    } else if (!auth.loading) {
      setLoading(false);
    }
  }, [user, userData, auth.loading, accessLogged, lastLoggedUserId]);

  useEffect(() => {
    // Só executar redirecionamento no cliente
    if (isClient && !loading && !user) {
      router.push("/");
    }
  }, [user, loading, router, isClient]);

  const updateCodes = async () => {
    const newCodes: { [key: string]: string } = {};

    // Gerar códigos para todas as companies
    for (const company of companies) {
      newCodes[company.name] = await generateTOTP(company.secret);
    }

    setCodes(newCodes);
    setTimeRemaining(getTimeRemaining());
  };

  useEffect(() => {
    if (!isClient) return;

    updateCodes();
    const interval = setInterval(updateCodes, 1000);
    return () => clearInterval(interval);
  }, [companies, isClient]);

  const handleLogout = async () => {
    try {
      // Revogar session cookie no servidor
      if (user) {
        await fetch("/api/auth/session", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uid: user.uid }),
        });
      }

      // Resetar estado de log de acesso
      setAccessLogged(false);

      // Fazer logout do Firebase Auth
      await logout();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      // Mesmo se houver erro, tentar fazer logout local
      await logout();
    }
  };

  const [checkingEmails, setCheckingEmails] = useState<{
    [key: string]: boolean;
  }>({});

  const handleUpdateEmailCodes = async (
    companyName: string,
    companyEmail: string,
    companyReceiverEmail: string,
    companyReceiverEmailPassword: string
  ) => {
    try {
      setCheckingEmails((prev) => ({ ...prev, [companyName]: true }));
      toast({
        title: "Verificando e-mails...",
        description: "Aguarde enquanto verificamos novos códigos.",
      });
      const response = await fetch("/api/check-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyEmail,
          companyReceiverEmail,
          companyReceiverEmailPassword,
          companyName,
        }),
      });
      if (!response.ok) {
        throw new Error(`Erro na requisição: ${response.status}`);
      }
      await response.json();
      toast({
        title: "Verificação concluída!",
        description: "O e-mail foi verificado com sucesso.",
      });
      await updateCodes();
      // Remover a função saveCompaniesToFirestore e todas as chamadas a ela
    } catch (error) {
      console.error("Erro ao verificar e-mails:", error);
      toast({
        title: "Erro na verificação",
        description: "Não foi possível verificar os e-mails. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCheckingEmails((prev) => ({ ...prev, [companyName]: false }));
    }
  };

  const copyToClipboard = (code: string, serviceName: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      toast({
        title: "Código copiado!",
        description: `Código do ${serviceName} copiado para a área de transferência`,
      });
    }
  };

  // Função para testar se um secret gera códigos válidos (validação básica)
  const testSecret = (secret: string): boolean => {
    try {
      if (!secret || secret.trim().length === 0) {
        return false;
      }

      // Normalizar o secret
      const cleanSecret = normalizeSecret(secret);

      // Verificar se o secret tem pelo menos 16 caracteres e formato válido
      return cleanSecret.length >= 16 && /^[A-Z2-7]+$/.test(cleanSecret);
    } catch (error) {
      return false;
    }
  };

  // Função para editar secret de uma seguradora
  const openEditModal = (company: any) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem editar seguradoras",
        variant: "destructive",
      });
      return;
    }
    setEditingCompany(company);
    setEditCompanyData({ ...company });
    setEditLogoFile(null);
    setShowSecretModal(true);
  };

  // Função para editar seguradora
  const saveEditCompany = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem editar seguradoras",
        variant: "destructive",
      });
      return;
    }
    const {
      id,
      name,
      fullName,
      secret,
      color,
      authType,
      email,
      receiverEmail,
      logo,
      receiverEmailPassword,
    } = editCompanyData;
    if (
      !name.trim() ||
      !fullName.trim() ||
      !color ||
      (editLogoFile === null && !logo)
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    if (authType === "totp" && !secret.trim()) {
      toast({
        title: "Erro",
        description: "O campo Secret 2FA é obrigatório.",
        variant: "destructive",
      });
      return;
    }
    if (
      authType === "email" &&
      (!email?.trim() ||
        !receiverEmail?.trim() ||
        !receiverEmailPassword?.trim())
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de e-mail e senha.",
        variant: "destructive",
      });
      return;
    }
    let cleanSecret = secret;
    if (authType === "totp") {
      try {
        cleanSecret = normalizeSecret(secret);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Formato inválido";
        toast({
          title: "Erro",
          description: `Secret inválido: ${errorMessage}`,
          variant: "destructive",
        });
        return;
      }
      if (!testSecret(cleanSecret)) {
        toast({
          title: "Erro",
          description:
            "Secret inválido. Verifique se está no formato correto e se gera um código 6 dígitos.",
          variant: "destructive",
        });
        return;
      }
    }
    let logoUrl = logo;
    if (editLogoFile) {
      try {
        const storageRef = ref(
          storage,
          `company-logos/${name.trim()}-${Date.now()}`
        );
        await uploadBytes(storageRef, editLogoFile);
        logoUrl = await getDownloadURL(storageRef);
      } catch (error) {
        toast({
          title: "Erro ao fazer upload da imagem",
          description: "A seguradora será atualizada com o logo anterior.",
          variant: "destructive",
        });
      }
    }
    const updatedData = {
      name: name.trim(),
      fullName: fullName.trim(),
      secret: authType === "totp" ? cleanSecret : "",
      color,
      logo: logoUrl,
      authType,
      email: authType === "email" ? email?.trim() : "",
      receiverEmail: authType === "email" ? receiverEmail?.trim() : "",
      receiverEmailPassword:
        authType === "email" ? receiverEmailPassword?.trim() : "",
    };
    await updateDoc(firestoreDoc(db, "companies", id), updatedData);
    // Remover a função saveCompaniesToFirestore e todas as chamadas a ela
    setShowSecretModal(false);
    setEditingCompany(null);
    setEditCompanyData(null);
    setEditLogoFile(null);
    toast({
      title: "Seguradora atualizada!",
      description: `${name} foi atualizada com sucesso`,
    });
  };
  const closeEditModal = () => {
    setShowSecretModal(false);
    setEditingCompany(null);
    setEditCompanyData(null);
    setEditLogoFile(null);
  };

  // Função para resetar secrets aos padrões
  const resetToDefaults = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem resetar secrets",
        variant: "destructive",
      });
      return;
    }

    setCompanies([]);
    // Remover a função saveCompaniesToFirestore e todas as chamadas a ela
    toast({
      title: "Secrets resetados!",
      description: "Todos os secrets foram restaurados aos valores padrão",
    });
  };

  // Função para adicionar nova seguradora
  const openAddCompanyModal = () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem adicionar seguradoras",
        variant: "destructive",
      });
      return;
    }

    setNewCompanyData({
      name: "",
      fullName: "",
      secret: "",
      color: "#6600CC",
      authType: "totp" as "totp" | "email",
      email: "",
      receiverEmail: "",
      receiverEmailPassword: "",
      logoFile: null,
    });
    setShowAddCompanyModal(true);
  };

  // Função para salvar nova seguradora
  const saveNewCompany = async () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem adicionar seguradoras",
        variant: "destructive",
      });
      return;
    }
    const {
      name,
      fullName,
      secret,
      color,
      email,
      receiverEmail,
      logoFile,
      authType,
      receiverEmailPassword,
    } = newCompanyData;

    // Validação obrigatória para todos os campos
    if (!name.trim() || !fullName.trim() || !color || !logoFile) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (authType === "totp" && !secret.trim()) {
      toast({
        title: "Erro",
        description: "O campo Secret 2FA é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (
      authType === "email" &&
      (!email.trim() || !receiverEmail.trim() || !receiverEmailPassword?.trim())
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de e-mail e senha.",
        variant: "destructive",
      });
      return;
    }

    // Verificar se já existe uma seguradora com o mesmo nome
    if (
      companies.some(
        (company) => company.name.toLowerCase() === name.trim().toLowerCase()
      )
    ) {
      toast({
        title: "Erro",
        description: "Já existe uma seguradora com este nome",
        variant: "destructive",
      });
      return;
    }

    let cleanSecret;
    if (authType === "totp") {
      try {
        cleanSecret = normalizeSecret(secret);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Formato inválido";
        toast({
          title: "Erro",
          description: `Secret inválido: ${errorMessage}`,
          variant: "destructive",
        });
        return;
      }
      // Testar se o secret gera um código válido
      if (!testSecret(cleanSecret)) {
        toast({
          title: "Erro",
          description:
            "Secret inválido. Verifique se está no formato correto e se gera um código 6 dígitos.",
          variant: "destructive",
        });
        return;
      }
    }

    let logoUrl = "";
    if (logoFile) {
      try {
        const storageRef = ref(
          storage,
          `company-logos/${name.trim()}-${Date.now()}`
        );
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      } catch (error) {
        toast({
          title: "Erro ao fazer upload da imagem",
          description: "A seguradora será criada sem logo.",
          variant: "destructive",
        });
      }
    }

    const newCompany = {
      name: name.trim(),
      fullName: fullName.trim(),
      secret: authType === "totp" ? cleanSecret : "",
      color: color,
      logo: logoUrl,
      authType: newCompanyData.authType as "totp" | "email",
      email: authType === "email" ? email.trim() : "",
      receiverEmail: authType === "email" ? receiverEmail.trim() : "",
      receiverEmailPassword: authType === "email" ? receiverEmailPassword : "",
    };
    await addDoc(collection(db, "companies"), newCompany);
    // Remover a função saveCompaniesToFirestore e todas as chamadas a ela
    setShowAddCompanyModal(false);
    setNewCompanyData({
      name: "",
      fullName: "",
      secret: "",
      color: "#6600CC",
      authType: "totp" as "totp" | "email",
      email: "",
      receiverEmail: "",
      receiverEmailPassword: "",
      logoFile: null,
    });
    toast({
      title: "Seguradora adicionada!",
      description: `${name} foi adicionada com sucesso`,
    });
  };

  // Função para fechar modal de nova seguradora
  const closeAddCompanyModal = () => {
    setShowAddCompanyModal(false);
    setNewCompanyData({
      name: "",
      fullName: "",
      secret: "",
      color: "#6600CC",
      authType: "totp" as "totp" | "email",
      email: "",
      receiverEmail: "",
      receiverEmailPassword: "",
      logoFile: null,
    });
  };

  // Função para remover seguradora
  const removeCompany = async (companyId: string) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem remover seguradoras",
        variant: "destructive",
      });
      return;
    }

    // Não permitir remover se restarem menos de 1 seguradora
    if (companies.length <= 1) {
      toast({
        title: "Erro",
        description: "Deve haver pelo menos uma seguradora no sistema",
        variant: "destructive",
      });
      return;
    }

    await deleteDoc(firestoreDoc(db, "companies", companyId));
    // Remover a função saveCompaniesToFirestore e todas as chamadas a ela
    toast({
      title: "Seguradora removida!",
      description: `A seguradora foi removida do sistema`,
    });
  };

  // Função para abrir modal de importação QR
  const openQRImportModal = () => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem importar QR codes",
        variant: "destructive",
      });
      return;
    }

    setShowQRImportModal(true);
  };

  // Função para processar secrets importados do QR code
  const handleQRImport = async (
    importedSecrets: Array<{
      name: string;
      fullName: string;
      secret: string;
      color: string;
    }>
  ) => {
    if (!userData || userData.role !== "admin") {
      toast({
        title: "Acesso Negado",
        description: "Apenas administradores podem importar seguradoras",
        variant: "destructive",
      });
      return;
    }

    try {
      // Verificar quais nomes já existem
      const existingNames = companies.map((c) => c.name.toLowerCase());
      const newSecrets = importedSecrets.filter(
        (secret) => !existingNames.includes(secret.name.toLowerCase())
      );

      if (newSecrets.length === 0) {
        toast({
          title: "Nenhum secret importado",
          description: "Todas as seguradoras já existem no sistema",
          variant: "destructive",
        });
        return;
      }

      // Adicionar as novas seguradoras
      const updatedCompanies = [
        ...companies,
        ...newSecrets.map((secret) => ({
          name: secret.name,
          fullName: secret.fullName,
          secret: secret.secret,
          color: secret.color,
          logo: "/placeholder-logo.png",
          authType: "totp" as const, // Por padrão, seguradoras importadas são TOTP
        })),
      ];

      setCompanies(updatedCompanies);
      // Remover a função saveCompaniesToFirestore e todas as chamadas a ela

      toast({
        title: "Importação concluída!",
        description: `${newSecrets.length} seguradora(s) importada(s) com sucesso`,
      });

      // Mostrar quais foram ignoradas se houver
      const ignoredCount = importedSecrets.length - newSecrets.length;
      if (ignoredCount > 0) {
        setTimeout(() => {
          toast({
            title: "Algumas seguradoras foram ignoradas",
            description: `${ignoredCount} seguradora(s) já existiam no sistema`,
          });
        }, 2000);
      }
    } catch (error) {
      console.error("Erro ao importar QR code:", error);
      toast({
        title: "Erro na importação",
        description: "Ocorreu um erro ao importar as seguradoras",
        variant: "destructive",
      });
    }
  };

  // Renderizar loading durante hidration ou se não está no cliente
  if (!isClient || auth.loading || loading) {
    return (
      <LoadingScreen
        title="Carregando..."
        subtitle="Verificando suas permissões"
        size="lg"
      />
    );
  }

  // Se não há usuário, não renderizar nada (redirecionamento em andamento)
  if (!user || !userData) {
    return (
      <LoadingScreen
        title="Redirecionando..."
        subtitle="Você será redirecionado para o login"
        size="lg"
      />
    );
  }

  // Verificar se é admin
  const isAdmin = userData.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Image
                src="/appLogo.svg"
                alt="App Logo"
                width={60}
                height={60}
                className="h-13 w-13"
              />
              <div>
                <h1 className="text-xl font-bold text-[#6600CC]">
                  Avantar ID
                </h1>
                <p className="text-sm text-gray-500">
                  Sistema de autenticação de dois fatores
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className="text-[#6600CC] border-[#6600CC]"
              >
                {userData.role === "admin" ? "Administrador" : "Franqueado"}
              </Badge>
              <span className="text-sm text-gray-600">{userData.email}</span>
              {userData.role === "admin" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push("/admin")}
                    className="border-[#6600CC] text-[#6600CC] hover:bg-[#6600CC] hover:text-white"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Admin
                  </Button>
                </>
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
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              Códigos de Autenticação
            </h2>
            <p className="text-gray-500 text-lg">
              Códigos de autenticação para sistemas das seguradoras
            </p>
          </div>

          {/* Timer - More elegant design */}
          <div className="max-w-md mx-auto mb-12">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-600">
                  Renovação automática (TOTP MFA)
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-2xl font-light text-[#6600CC] tabular-nums">
                    {timeRemaining}s
                  </span>
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
                    const testResults = companies
                      .map((company) => {
                        if (!company.secret) return null;
                        const code = generateTOTP(company.secret);
                        const timestamp = Math.floor(Date.now() / 1000);
                        const step = Math.floor(timestamp / 30);
                        return `${company.name}: ${code} (step: ${step})`;
                      })
                      .filter(Boolean)
                      .join("\n");

                    toast({
                      title: "Debug TOTP",
                      description:
                        "Resultados exibidos no console do navegador",
                    });
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
                <h3 className="text-xl font-semibold text-gray-900 mb-1">
                  {company.name}
                </h3>
                <p className="text-sm text-gray-500 mb-3">{company.fullName}</p>

                {/* Badge de tipo de autenticação */}
                <div className="flex justify-center mb-4">
                  {company.authType === "totp" ? (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200">
                      TOTP MFA
                    </Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200">
                      E-mail
                    </Badge>
                  )}
                </div>
              </div>

              {/* 2FA Code */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center">
                  <span className="font-mono text-3xl font-bold text-[#6600CC] tracking-wider bg-gray-50 px-4 py-2 rounded-xl">
                    {company.authType === "totp"
                      ? codes[company.name] || "------"
                      : company.code || "------"}
                  </span>
                </div>
                {company.authType === "email" && company.receivedAt && (
                  <div className="mt-2 text-xs text-gray-500">
                    {(() => {
                      let dateObj;
                      if (company.receivedAt.seconds) {
                        // Firestore Timestamp
                        dateObj = new Date(company.receivedAt.seconds * 1000);
                      } else {
                        // ISO string ou Date
                        dateObj = new Date(company.receivedAt);
                      }
                      const dataFormatada = dateObj.toLocaleDateString("pt-BR");
                      const horaFormatada = dateObj.toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" }
                      );
                      return `Atualizado em: ${dataFormatada} ${horaFormatada}`;
                    })()}
                  </div>
                )}
                {isAdmin && company.secret && (
                  <div className="mt-2 text-xs text-gray-500">
                    <div>Secret: {company.secret.substring(0, 8)}...</div>
                    <div>Timestamp: {Math.floor(Date.now() / 1000)}</div>
                    <div>
                      Step: {Math.floor(Math.floor(Date.now() / 1000) / 30)}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      company.authType === "totp"
                        ? codes[company.name] || ""
                        : company.code || "",
                      company.name
                    )
                  }
                  className="border-[#6600CC]/20 text-[#6600CC] hover:bg-[#6600CC] hover:text-white hover:border-[#6600CC] rounded-full px-4 transition-all duration-200"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
                {company.authType !== "totp" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      handleUpdateEmailCodes(
                        company.name,
                        company.email,
                        company.receiverEmail,
                        company.receiverEmailPassword
                      )
                    }
                    className="border-green-600 rounded-full text-green-600 hover:bg-green-600 hover:text-white"
                  >
                    {checkingEmails[company.name] ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Atualizar E-mail
                  </Button>
                )}

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
                      onClick={() => removeCompany(company.id)}
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
      <Dialog open={showSecretModal} onOpenChange={closeEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Seguradora</DialogTitle>
            <DialogDescription>
              Edite os dados da seguradora selecionada.
            </DialogDescription>
          </DialogHeader>
          {editCompanyData && (
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="editAuthType" className="font-medium">
                  Tipo de Autenticação:
                </Label>
                <select
                  id="editAuthType"
                  value={editCompanyData.authType}
                  onChange={(e) =>
                    setEditCompanyData({
                      ...editCompanyData,
                      authType: e.target.value,
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
                    value={editCompanyData.name}
                    onChange={(e) =>
                      setEditCompanyData({
                        ...editCompanyData,
                        name: e.target.value,
                      })
                    }
                    placeholder="Ex: AIG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editFullName" className="font-medium">
                    Nome Completo:
                  </Label>
                  <Input
                    id="editFullName"
                    value={editCompanyData.fullName}
                    onChange={(e) =>
                      setEditCompanyData({
                        ...editCompanyData,
                        fullName: e.target.value,
                      })
                    }
                    placeholder="Ex: American International Group"
                  />
                </div>
                {editCompanyData.authType === "totp" && (
                  <div className="space-y-2">
                    <Label htmlFor="editSecret" className="font-medium">
                      Secret 2FA:
                    </Label>
                    <Input
                      id="editSecret"
                      value={editCompanyData.secret}
                      onChange={(e) =>
                        setEditCompanyData({
                          ...editCompanyData,
                          secret: e.target.value,
                        })
                      }
                      placeholder="Ex: JBSWY3DPEHPK3PXP"
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500">
                      Formato: Base32 (A-Z, 2-7), mínimo 16 caracteres
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="editColor" className="font-medium">
                    Cor do tema:
                  </Label>
                  <Input
                    type="color"
                    id="editColor"
                    value={editCompanyData.color}
                    onChange={(e) =>
                      setEditCompanyData({
                        ...editCompanyData,
                        color: e.target.value,
                      })
                    }
                  />
                </div>
                {editCompanyData.authType === "email" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="editEmail" className="font-medium">
                        E-mail da Seguradora:
                      </Label>
                      <Input
                        id="editEmail"
                        type="email"
                        value={editCompanyData.email}
                        onChange={(e) =>
                          setEditCompanyData({
                            ...editCompanyData,
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
                        value={editCompanyData.receiverEmail}
                        onChange={(e) =>
                          setEditCompanyData({
                            ...editCompanyData,
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
                          type={showEditCompanyPassword ? "text" : "password"}
                          value={editCompanyData.receiverEmailPassword || ""}
                          onChange={(e) =>
                            setEditCompanyData({
                              ...editCompanyData,
                              receiverEmailPassword: e.target.value,
                            })
                          }
                          placeholder="Digite a senha do e-mail"
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          tabIndex={-1}
                          onClick={() => setShowEditCompanyPassword((v) => !v)}
                        >
                          {showEditCompanyPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="editLogo" className="font-medium">
                    Logo da Seguradora:
                  </Label>
                  <Input
                    id="editLogo"
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEditLogoFile(e.target.files?.[0] || null)
                    }
                  />
                  {editCompanyData.logo && (
                    <div className="mt-2">
                      <img
                        src={editCompanyData.logo}
                        alt="Logo atual"
                        className="h-12"
                      />
                    </div>
                  )}
                </div>
              </div>
              {editCompanyData.authType === "totp" && (
                <div className="text-sm">
                  {testSecret(
                    editCompanyData.secret
                      ?.trim()
                      ?.toUpperCase()
                      ?.replace(/\s/g, "")
                  ) ? (
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
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>
              Cancelar
            </Button>
            <Button
              onClick={saveEditCompany}
              disabled={
                !editCompanyData?.name?.trim() ||
                !editCompanyData?.fullName?.trim() ||
                !editCompanyData?.color ||
                (!editLogoFile && !editCompanyData?.logo) ||
                (editCompanyData?.authType === "totp" &&
                  (!editCompanyData?.secret?.trim() ||
                    !testSecret(
                      editCompanyData.secret
                        .trim()
                        .toUpperCase()
                        .replace(/\s/g, "")
                    ))) ||
                (editCompanyData?.authType === "email" &&
                  (!editCompanyData?.email?.trim() ||
                    !editCompanyData?.receiverEmail?.trim() ||
                    !editCompanyData?.receiverEmailPassword?.trim()))
              }
            >
              Salvar Alterações
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
              <h4 className="font-semibold text-blue-900 mb-2">
                Como obter um secret real:
              </h4>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>
                  Entre em contato com a seguradora e peça o reset secret 2FA ou
                  vá para as configurações de segurança se for o caso.
                </li>

                <li>
                  O sistema mostrará um QR code e um código de backup (secret
                  key).
                </li>
                <li>
                  Copie o código de backup (secret key) - geralmente 16+
                  caracteres em Base32.
                </li>
                <li>
                  Cole aqui e teste no Google Auth ou algum app de autenticação
                  se os códigos são iguais antes de salvar, este teste é
                  necessário, caso queira entender melhor porquê,{" "}
                  <a
                    className="text-[#E06400] hover:text-[#E06400]  font-bold"
                    href="https://github.com/BrunoCstr/2fa-app-avantar/blob/main/README-DEV.md"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    clique aqui
                  </a>{" "}
                  para ler a documentação da aplicação.
                </li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newCompanyAuthType" className="font-medium">
                Tipo de Autenticação:
              </Label>
              <select
                id="newCompanyAuthType"
                value={newCompanyData.authType}
                onChange={(e) =>
                  setNewCompanyData({
                    ...newCompanyData,
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
                <Label htmlFor="newCompanyName" className="font-medium">
                  Nome da Seguradora:
                </Label>
                <Input
                  id="newCompanyName"
                  value={newCompanyData.name}
                  onChange={(e) =>
                    setNewCompanyData({
                      ...newCompanyData,
                      name: e.target.value,
                    })
                  }
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
                  onChange={(e) =>
                    setNewCompanyData({
                      ...newCompanyData,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="Ex: American International Group"
                />
              </div>
              {newCompanyData.authType === "totp" && (
                <div className="space-y-2">
                  <Label htmlFor="newCompanySecret" className="font-medium">
                    Secret 2FA:
                  </Label>
                  <Input
                    id="newCompanySecret"
                    value={newCompanyData.secret}
                    onChange={(e) =>
                      setNewCompanyData({
                        ...newCompanyData,
                        secret: e.target.value,
                      })
                    }
                    placeholder="Ex: JBSWY3DPEHPK3PXP"
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500">
                    Formato: Base32 (A-Z, 2-7), mínimo 16 caracteres
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newCompanyColor" className="font-medium">
                  Cor do tema:
                </Label>
                <Input
                  type="color"
                  id="newCompanyColor"
                  value={newCompanyData.color}
                  onChange={(e) =>
                    setNewCompanyData({
                      ...newCompanyData,
                      color: e.target.value,
                    })
                  }
                />
              </div>
              {newCompanyData.authType === "email" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="newCompanyEmail" className="font-medium">
                      E-mail da Seguradora:
                    </Label>
                    <Input
                      id="newCompanyEmail"
                      type="email"
                      value={newCompanyData.email}
                      onChange={(e) =>
                        setNewCompanyData({
                          ...newCompanyData,
                          email: e.target.value,
                        })
                      }
                      placeholder="Ex: noreply@seguradora.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="newCompanyReceiverEmail"
                      className="font-medium"
                    >
                      E-mail que receberá o código:
                    </Label>
                    <Input
                      id="newCompanyReceiverEmail"
                      type="email"
                      value={newCompanyData.receiverEmail}
                      onChange={(e) =>
                        setNewCompanyData({
                          ...newCompanyData,
                          receiverEmail: e.target.value,
                        })
                      }
                      placeholder="Ex: contato@avantar.com.br"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="newCompanyReceiverEmailPassword"
                      className="font-medium"
                    >
                      Senha do e-mail que receberá o código:
                    </Label>
                    <div className="relative">
                      <Input
                        id="newCompanyReceiverEmailPassword"
                        type={showNewCompanyPassword ? "text" : "password"}
                        value={newCompanyData.receiverEmailPassword}
                        onChange={(e) =>
                          setNewCompanyData({
                            ...newCompanyData,
                            receiverEmailPassword: e.target.value,
                          })
                        }
                        placeholder="Digite a senha do e-mail"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                        onClick={() => setShowNewCompanyPassword((v) => !v)}
                      >
                        {showNewCompanyPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="newCompanyLogo" className="font-medium">
                  Logo da Seguradora:
                </Label>
                <Input
                  id="newCompanyLogo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setNewCompanyData({
                      ...newCompanyData,
                      logoFile: file,
                    });
                  }}
                />
              </div>
            </div>
            <div className="text-sm">
              {newCompanyData.authType === "totp" &&
                (testSecret(
                  newCompanyData.secret.trim().toUpperCase().replace(/\s/g, "")
                ) ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Secret válido - gerará códigos reais</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Secret inválido - verifique o formato</span>
                  </div>
                ))}
            </div>
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
                !newCompanyData.color ||
                !newCompanyData.logoFile ||
                (newCompanyData.authType === "totp" &&
                  (!newCompanyData.secret.trim() ||
                    !testSecret(
                      newCompanyData.secret
                        .trim()
                        .toUpperCase()
                        .replace(/\s/g, "")
                    ))) ||
                (newCompanyData.authType === "email" &&
                  (!newCompanyData.email.trim() ||
                    !newCompanyData.receiverEmail.trim() ||
                    !newCompanyData.receiverEmailPassword?.trim()))
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
  );
}
