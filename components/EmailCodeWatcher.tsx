'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, RefreshCw, Mail, Clock, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface EmailCode {
  id: string;
  code: string;
  from: string;
  subject: string;
  timestamp: string;
  emailAccount: string;
  used?: boolean;
  usedAt?: string;
}

interface WatcherStatus {
  emailAccount: string;
  isConnected: boolean;
  isWatching: boolean;
}

export default function EmailCodeWatcher() {
  const [codes, setCodes] = useState<EmailCode[]>([]);
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string>('all');
  const [filter, setFilter] = useState<'all' | 'recent' | 'unused'>('all');

  // Buscar códigos
  const fetchCodes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEmail !== 'all') {
        params.append('emailAccount', selectedEmail);
      }
      if (filter === 'recent') {
        params.append('recent', 'true');
      }
      params.append('limit', '50');

      const response = await fetch(`/api/email-codes?${params}`);
      const data = await response.json();

      if (data.success) {
        setCodes(data.data);
      } else {
        toast.error('Erro ao buscar códigos');
      }
    } catch (error) {
      console.error('Erro ao buscar códigos:', error);
      toast.error('Erro ao buscar códigos');
    } finally {
      setLoading(false);
    }
  };

  // Buscar status dos watchers
  const fetchWatcherStatus = async () => {
    try {
      const response = await fetch('/api/email-watcher/status');
      const data = await response.json();

      if (data.success) {
        setWatcherStatus(data.data);
      }
    } catch (error) {
      console.error('Erro ao buscar status dos watchers:', error);
    }
  };

  // Marcar código como usado
  const markAsUsed = async (codeId: string) => {
    try {
      const response = await fetch('/api/email-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ codeId, used: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Código marcado como usado');
        fetchCodes(); // Recarregar lista
      } else {
        toast.error('Erro ao marcar código como usado');
      }
    } catch (error) {
      console.error('Erro ao marcar código como usado:', error);
      toast.error('Erro ao marcar código como usado');
    }
  };

  // Deletar código
  const deleteCode = async (codeId: string) => {
    try {
      const response = await fetch(`/api/email-codes?id=${codeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Código deletado');
        fetchCodes(); // Recarregar lista
      } else {
        toast.error('Erro ao deletar código');
      }
    } catch (error) {
      console.error('Erro ao deletar código:', error);
      toast.error('Erro ao deletar código');
    }
  };

  // Copiar código para clipboard
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado!');
  };

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR');
  };

  // Filtrar códigos
  const filteredCodes = codes.filter(code => {
    if (filter === 'unused') {
      return !code.used;
    }
    return true;
  });

  // Buscar dados iniciais
  useEffect(() => {
    fetchCodes();
    fetchWatcherStatus();
  }, [selectedEmail, filter]);

  // Atualizar a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCodes();
      fetchWatcherStatus();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Status dos Watchers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Status dos Monitores de E-mail
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watcherStatus.map((status, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    status.isConnected && status.isWatching ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium truncate">
                    {status.emailAccount}
                  </span>
                </div>
                <Badge variant={status.isConnected && status.isWatching ? 'default' : 'destructive'}>
                  {status.isConnected && status.isWatching ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Controles */}
      <Card>
        <CardHeader>
          <CardTitle>Códigos de E-mail</CardTitle>
          <CardDescription>
            Códigos recebidos automaticamente dos e-mails monitorados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={selectedEmail} onValueChange={setSelectedEmail}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Selecionar e-mail" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os e-mails</SelectItem>
                {watcherStatus.map((status, index) => (
                  <SelectItem key={index} value={status.emailAccount}>
                    {status.emailAccount}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filter} onValueChange={(value: 'all' | 'recent' | 'unused') => setFilter(value)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="recent">Últimas 24h</SelectItem>
                <SelectItem value="unused">Não utilizados</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={fetchCodes} disabled={loading} className="w-full sm:w-auto">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Lista de Códigos */}
          <div className="space-y-3">
            {filteredCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {loading ? 'Carregando...' : 'Nenhum código encontrado'}
              </div>
            ) : (
              filteredCodes.map((code) => (
                <div
                  key={code.id}
                  className={`p-4 border rounded-lg ${
                    code.used ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl font-mono font-bold tracking-wider">
                        {code.code}
                      </div>
                      <div className="flex items-center gap-2">
                        {code.used && (
                          <Badge variant="secondary">Usado</Badge>
                        )}
                        <Badge variant="outline">
                          {code.emailAccount}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(code.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      
                      {!code.used && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsUsed(code.id)}
                        >
                          Marcar como usado
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteCode(code.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {code.from}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(code.timestamp)}
                      </div>
                    </div>
                    <div className="mt-1 truncate">
                      {code.subject}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 