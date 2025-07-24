const Imap = require('imap');
const { simpleParser } = require('mailparser');

// Configurações do e-mail (substitua pelos seus dados)
const emailConfig = {
  user: process.env.EMAIL_USER_1 || 'seu-email@seudominio.com',
  password: process.env.EMAIL_PASSWORD_1 || 'sua-senha',
  host: 'imap.dreamhost.com',
  port: 993,
  tls: true,
  tlsOptions: { rejectUnauthorized: false },
  connTimeout: 60000,
  authTimeout: 5000,
};

console.log('🔗 Testando conexão IMAP com Dreamhost...');
console.log(`📧 E-mail: ${emailConfig.user}`);
console.log(`🌐 Host: ${emailConfig.host}:${emailConfig.port}`);

const imap = new Imap(emailConfig);

imap.once('ready', () => {
  console.log('✅ Conexão estabelecida com sucesso!');
  
  imap.openBox('INBOX', false, (err, box) => {
    if (err) {
      console.error('❌ Erro ao abrir caixa de entrada:', err);
      imap.end();
      return;
    }
    
    console.log('📬 Caixa de entrada aberta com sucesso!');
    console.log(`📊 Total de mensagens: ${box.messages.total}`);
    console.log(`📥 Mensagens não lidas: ${box.messages.unseen}`);
    
    // Buscar e-mails não lidos
    imap.search(['UNSEEN'], (err, results) => {
      if (err) {
        console.error('❌ Erro ao buscar e-mails:', err);
        imap.end();
        return;
      }
      
      if (!results || results.length === 0) {
        console.log('📭 Nenhum e-mail não lido encontrado.');
        imap.end();
        return;
      }
      
      console.log(`📧 ${results.length} e-mail(s) não lido(s) encontrado(s).`);
      
      // Buscar o conteúdo dos e-mails
      const fetch = imap.fetch(results, { bodies: '' });
      
      fetch.on('message', (msg, seqno) => {
        console.log(`\n📨 Processando e-mail #${seqno}...`);
        
        msg.on('body', (stream) => {
          simpleParser(stream, (err, parsed) => {
            if (err) {
              console.error('❌ Erro ao processar e-mail:', err);
              return;
            }
            
            console.log(`📧 De: ${parsed.from?.text || 'Remetente desconhecido'}`);
            console.log(`📋 Assunto: ${parsed.subject || 'Sem assunto'}`);
            console.log(`📅 Data: ${parsed.date || 'Data desconhecida'}`);
            
            // Extrair código de 6 dígitos
            const textContent = parsed.text || parsed.html || '';
            const codeMatch = textContent.match(/\b\d{6}\b/);
            
            if (codeMatch) {
              console.log(`🔐 Código encontrado: ${codeMatch[0]}`);
            } else {
              console.log('❌ Nenhum código de 6 dígitos encontrado');
            }
            
            console.log('---');
          });
        });
      });
      
      fetch.once('error', (err) => {
        console.error('❌ Erro ao buscar e-mails:', err);
      });
      
      fetch.once('end', () => {
        console.log('✅ Processamento concluído.');
        imap.end();
      });
    });
  });
});

imap.once('error', (err) => {
  console.error('❌ Erro na conexão:', err.message);
  
  if (err.code === 'ECONNREFUSED') {
    console.log('💡 Dica: Verifique se o IMAP está habilitado no painel do Dreamhost');
  } else if (err.code === 'EAUTH') {
    console.log('💡 Dica: Verifique se o usuário e senha estão corretos');
  } else if (err.code === 'ENOTFOUND') {
    console.log('💡 Dica: Verifique se o host está correto');
  }
});

imap.once('end', () => {
  console.log('🔌 Conexão encerrada.');
});

// Conectar
imap.connect();

// Timeout de segurança
setTimeout(() => {
  console.log('⏰ Timeout - encerrando conexão...');
  imap.end();
}, 30000); 