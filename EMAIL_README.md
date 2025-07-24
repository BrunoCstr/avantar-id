# Configuração do Sistema de Monitoramento de E-mails

## Visão Geral

Este sistema monitora automaticamente caixas de e-mail para capturar códigos de verificação de 6 dígitos enviados por seguradoras e outros serviços.

LEMBRETE IMPORTANTE, SE A SENHA DO E-MAIL FOR ALTERADA VOCÊ PRECISA ALTERAR NO SISTEMA.

## Configuração do Dreamhost

### Configurações IMAP:
- **Host:** `imap.dreamhost.com`
- **Porta:** `993`
- **Segurança:** `SSL/TLS`
- **Autenticação:** `Senha normal`

### Habilitar IMAP:
1. Acesse o painel do Dreamhost
2. Vá em "Email" > "Manage Email"
3. Selecione o domínio
4. Clique em "Configure" para o e-mail
5. Habilite "IMAP Access"

## Como Funciona

1. **Monitoramento Automático**: O sistema conecta-se aos e-mails configurados via IMAP
2. **Detecção de Códigos**: Quando um novo e-mail chega, o sistema procura por códigos de 6 dígitos
3. **Armazenamento**: Os códigos são salvos no Firestore com metadados
4. **Interface Web**: Os códigos aparecem em tempo real na página `/email-codes`

## Funcionalidades

### Página de Códigos (`/email-codes`)
- ✅ Visualizar todos os códigos recebidos
- ✅ Filtrar por e-mail específico
- ✅ Filtrar por período (últimas 24h)
- ✅ Filtrar códigos não utilizados
- ✅ Copiar código para clipboard
- ✅ Marcar código como usado
- ✅ Deletar códigos
- ✅ Status em tempo real dos monitores

### APIs Disponíveis
- `GET /api/email-codes` - Buscar códigos
- `POST /api/email-codes` - Marcar código como usado
- `DELETE /api/email-codes` - Deletar código
- `GET /api/email-watcher/status` - Status dos monitores
- `POST /api/email-watcher/init` - Inicializar monitores

## Segurança

### Recomendações:
1. **E-mails Dedicados**: Use e-mails específicos para este sistema
2. **Senhas Fortes**: Use senhas complexas para os e-mails
3. **Acesso Limitado**: Configure o e-mail apenas para receber códigos
4. **Monitoramento**: Verifique regularmente os logs de acesso

### Variáveis de Ambiente:
- Nunca commite o arquivo `.env` no repositório
- Use diferentes e-mails para desenvolvimento e produção
- Considere usar variáveis de ambiente do servidor em produção

## Troubleshooting

### Problemas Comuns:

1. **Erro de Conexão IMAP**
   - Verifique se o IMAP está habilitado no Dreamhost
   - Confirme as credenciais no `.env`
   - Teste a conexão manualmente

2. **Códigos Não Aparecem**
   - Verifique se o e-mail está recebendo mensagens
   - Confirme se os códigos têm exatamente 6 dígitos
   - Verifique os logs do console

3. **Watcher Desconecta**
   - O sistema reconecta automaticamente a cada 30 segundos
   - Verifique a estabilidade da conexão de internet
   - Monitore os logs para erros específicos

### Logs Úteis:
```bash
# Conectado com sucesso
✅ Conectado ao e-mail: email@avantar.com

# Novo e-mail detectado
📧 1 novo(s) e-mail(s) encontrado(s) em email@avantar.com

# Código encontrado
🔐 Código encontrado: 123456 de Seguradora XYZ

# Código salvo
💾 Código salvo no Firestore: 123456

# Erro de conexão
❌ Erro na conexão com email@avantar.com: [erro específico]
```

## Personalização

### Modificar Regex de Códigos:
Edite a linha em `lib/email-watcher.ts`:
```typescript
const codeMatch = textContent.match(/\b\d{6}\b/);
```

## Suporte

Para dúvidas ou problemas:
1. Verifique os logs do console
2. Confirme as configurações do Dreamhost
3. Teste a conectividade IMAP manualmente
4. Verifique as permissões do Firestore 
5. Verifique se a senha do e-mail está correta