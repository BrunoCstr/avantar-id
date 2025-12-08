import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Imap from "node-imap";
import { simpleParser } from "mailparser";

admin.initializeApp();

// Refactored: checkEmails now receives callbacks to finish immediately
export function checkEmails(
  onSuccess: (msg: string) => void,
  onError: (err: any) => void,
  companyName: string,
  companyEmail: string,
  companyReceiverEmail: string,
  companyReceiverEmailPassword: string
) {
  const allowedSenders = [companyEmail];

  const imap = new Imap({
    user: companyReceiverEmail,
    password: companyReceiverEmailPassword,
    host: "imap.dreamhost.com",
    port: 993,
    tls: true,
  });

  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = today.toLocaleString("en-US", { month: "short" });
  const year = today.getFullYear();
  const todayString = `${day}-${month}-${year}`;

  let finished = false;
  function finish(msg?: string, err?: any) {
    if (!finished) {
      finished = true;
      imap.end();
      if (err) onError(err);
      else onSuccess(msg || "Verification completed.");
    }
  }

  function openInbox(cb: any) {
    imap.openBox("INBOX", false, cb);
  }

  console.log("========== INICIANDO CHECK EMAILS ==========");
  console.log("Company Name:", companyName);
  console.log("Company Email:", companyEmail);
  console.log("Allowed Senders:", allowedSenders);
  console.log("Today String:", todayString);

  imap.once("ready", function () {
    console.log("✅ IMAP conectado com sucesso");
    openInbox(function (err: any, box: any) {
      if (err) {
        console.error("❌ Erro ao abrir inbox:", err);
        return finish(undefined, err);
      }
      console.log("✅ Inbox aberto com sucesso");

      const searchBySender = allowedSenders.map((sender) => {
        return new Promise<void>((resolveSearch, rejectSearch) => {
          console.log(`🔍 Buscando emails de: ${sender} desde ${todayString}`);
          imap.search(
            [
              ["SINCE", todayString],
              ["FROM", sender],
            ],
            function (err: any, results: any) {
              if (err) {
                console.error(`❌ IMAP search error for ${sender}:`, err);
                rejectSearch(err);
                return finish(undefined, err);
              }
              console.log(`📧 Resultados encontrados para ${sender}:`, results?.length || 0);
              if (!results || !results.length) {
                console.log(`⚠️ Nenhum email encontrado para ${sender} desde ${todayString}`);
                resolveSearch();
                return;
              }

              // Ordena os resultados para pegar o e-mail mais recente
              const sortedResults = results.sort(
                (a: number, b: number) => b - a
              );
              const latestResult = sortedResults[0];
              console.log(`📬 Processando email mais recente: ${latestResult}`);

              const f = imap.fetch([latestResult], { bodies: "" });
              f.on("message", function (msg: any) {
                console.log("📨 Mensagem recebida, processando...");
                msg.on("body", function (stream: any) {
                  console.log("📥 Stream do corpo do email recebido, parseando...");
                  simpleParser(stream)
                    .then(async (parsed: any) => {
                      console.log("✅ Email parseado com sucesso");
                      const senderEmail = parsed.from?.value?.[0]?.address;
                      console.log("📧 Email do remetente:", senderEmail);
                      console.log("✅ Remetentes permitidos:", allowedSenders);
                      if (!allowedSenders.includes(senderEmail)) {
                        console.log(`⚠️ Remetente ${senderEmail} não está na lista de permitidos. Ignorando...`);
                        return;
                      }
                      console.log("✅ Remetente autorizado, processando conteúdo...");
                      const { text, html } = parsed;
                      
                      // Logs detalhados do email recebido
                      console.log("========== EMAIL RECEBIDO ==========");
                      console.log("De:", senderEmail);
                      console.log("Assunto:", parsed.subject);
                      console.log("Data:", parsed.date);
                      console.log("--- TEXTO COMPLETO DO EMAIL ---");
                      console.log(text || "(sem texto)");
                      console.log("--- TEXTO COMPRIMENTO ---");
                      console.log("Tamanho do texto:", text?.length || 0);
                      console.log("--- HTML COMPLETO DO EMAIL ---");
                      console.log(html?.substring(0, 2000) || "(sem HTML)");
                      console.log("--- HTML COMPRIMENTO ---");
                      console.log("Tamanho do HTML:", html?.length || 0);
                      console.log("====================================");
                      
                      // Primeiro tenta capturar códigos com hífen e espaços (ex: 020 - 055)
                      let code = text?.match(/\b\d{3}\s*-\s*\d{3}\b/);
                      console.log("Tentativa 1 - Código com hífen:", code ? code[0] : "não encontrado");
                      
                      // Se não encontrar, busca códigos simples de 4-8 dígitos (evita números muito longos)
                      if (!code) {
                        code = text?.match(/\b\d{4,8}\b/);
                        console.log("Tentativa 2 - Código numérico 4-8 dígitos:", code ? code[0] : "não encontrado");
                      }
                      
                      // Se não encontrar, busca códigos alfanuméricos próximos a palavras-chave (ex: "login: YPDG")
                      if (!code) {
                        // Procura por padrões como "login:", "token:", "código:" seguido de código alfanumérico
                        // Melhorado para capturar "na tela de login: YPDG" ou "login: YPDG" (com ou sem pontuação após)
                        const keywordPattern = /(?:login|token|código|codigo|senha|password)[:\s]+([A-Z0-9]{3,6})[.\s,;]?/i;
                        const keywordMatch = text?.match(keywordPattern);
                        console.log("Tentativa 3 - Busca por palavra-chave:");
                        console.log("  Regex:", keywordPattern);
                        console.log("  Match completo:", keywordMatch);
                        if (keywordMatch) {
                          console.log("  Código encontrado via palavra-chave:", keywordMatch[1]);
                          code = [keywordMatch[1]];
                        } else {
                          console.log("  Não encontrado");
                        }
                      }
                      
                      // Se ainda não encontrar, busca códigos alfanuméricos de 4 caracteres (mais específico que 3-6)
                      if (!code) {
                        code = text?.match(/\b[A-Z0-9]{4}\b/);
                        console.log("Tentativa 4 - Código alfanumérico de 4 caracteres:", code ? code[0] : "não encontrado");
                        if (code) {
                          console.log("  Todos os matches de 4 caracteres:", text?.match(/\b[A-Z0-9]{4}\b/g));
                        }
                      }
                      
                      // Última tentativa: códigos alfanuméricos de 3-6 caracteres (genérico)
                      if (!code) {
                        code = text?.match(/\b[A-Z0-9]{3,6}\b/);
                        console.log("Tentativa 5 - Código alfanumérico genérico (3-6):", code ? code[0] : "não encontrado");
                        if (code) {
                          console.log("  Primeiros 10 matches:", text?.match(/\b[A-Z0-9]{3,6}\b/g)?.slice(0, 10));
                        }
                      }

                      if (!code && html) {
                        console.log("--- PROCESSANDO HTML ---");
                        // Remove todo o conteúdo das tags <style>, pq pode conter hexadecimais etc...
                        let htmlClean = html.replace(
                          /<style[^>]*>[\s\S]*?<\/style>/gi,
                          " "
                        );
                        // Remove tags HTML
                        htmlClean = htmlClean.replace(/<[^>]+>/g, " ");
                        // Remove qualquer atributo do tipo nome="..." ou nome='...' faço para isso para remover src, id, class, href etc...
                        htmlClean = htmlClean.replace(
                          /\b\w+=("|')[^"']*\1/gi,
                          " "
                        );
                        console.log("--- HTML LIMPO (primeiros 2000 caracteres) ---");
                        console.log(htmlClean.substring(0, 2000));
                        console.log("--- HTML LIMPO COMPRIMENTO ---");
                        console.log("Tamanho do HTML limpo:", htmlClean.length);
                        
                        // Primeiro tenta capturar códigos com hífen e espaços no HTML limpo
                        code = htmlClean.match(/\b\d{3}\s*-\s*\d{3}\b/);
                        console.log("HTML Tentativa 1 - Código com hífen:", code ? code[0] : "não encontrado");
                        
                        // Se não encontrar, busca códigos simples de 4-8 dígitos
                        if (!code) {
                          code = htmlClean.match(/\b\d{4,8}\b/);
                          console.log("HTML Tentativa 2 - Código numérico 4-8 dígitos:", code ? code[0] : "não encontrado");
                        }
                        
                        // Se não encontrar, busca códigos alfanuméricos próximos a palavras-chave (ex: "login: YPDG")
                        if (!code) {
                          // Procura por padrões como "login:", "token:", "código:" seguido de código alfanumérico
                          // Melhorado para capturar "na tela de login: YPDG" ou "login: YPDG" (com ou sem pontuação após)
                          const keywordPattern = /(?:login|token|código|codigo|senha|password)[:\s]+([A-Z0-9]{3,6})[.\s,;]?/i;
                          const keywordMatch = htmlClean.match(keywordPattern);
                          console.log("HTML Tentativa 3 - Busca por palavra-chave:");
                          console.log("  Regex:", keywordPattern);
                          console.log("  Match completo:", keywordMatch);
                          if (keywordMatch) {
                            console.log("  Código encontrado via palavra-chave (HTML):", keywordMatch[1]);
                            code = [keywordMatch[1]];
                          } else {
                            console.log("  Não encontrado");
                          }
                        }
                        
                        // Se ainda não encontrar, busca códigos alfanuméricos de 4 caracteres (mais específico que 3-6)
                        if (!code) {
                          code = htmlClean.match(/\b[A-Z0-9]{4}\b/);
                          console.log("HTML Tentativa 4 - Código alfanumérico de 4 caracteres:", code ? code[0] : "não encontrado");
                          if (code) {
                            console.log("  Todos os matches de 4 caracteres:", htmlClean.match(/\b[A-Z0-9]{4}\b/g)?.slice(0, 10));
                          }
                        }
                        
                        // Última tentativa: códigos alfanuméricos de 3-6 caracteres (genérico)
                        if (!code) {
                          code = htmlClean.match(/\b[A-Z0-9]{3,6}\b/);
                          console.log("HTML Tentativa 5 - Código alfanumérico genérico (3-6):", code ? code[0] : "não encontrado");
                          if (code) {
                            console.log("  Primeiros 10 matches:", htmlClean.match(/\b[A-Z0-9]{3,6}\b/g)?.slice(0, 10));
                          }
                        }
                      }
                      
                      console.log("========== RESULTADO FINAL ==========");
                      console.log("Código encontrado:", code ? code[0] : "NENHUM CÓDIGO ENCONTRADO");
                      console.log("====================================");
                      
                      if (!code) {
                        console.log("⚠️ NENHUM CÓDIGO FOI ENCONTRADO NO EMAIL");
                        console.log("Isso pode significar que:");
                        console.log("1. O código não está no formato esperado");
                        console.log("2. O email não contém o código");
                        console.log("3. O código está em um formato diferente");
                        resolveSearch();
                        return;
                      }
                      
                      if (code) {
                        console.log("✅ Código encontrado:", code[0]);
                        try {
                          // Buscar o documento da seguradora na coleção 'companies' (nova estrutura)
                          const companiesRef = admin
                            .firestore()
                            .collection("companies");
                          const querySnap = await companiesRef
                            .where("name", "==", companyName)
                            .get();
                          if (querySnap.empty) {
                            finish("Seguradora não encontrada");
                            resolveSearch();
                            return;
                          }
                          const companyDoc = querySnap.docs[0];
                          const company = companyDoc.data();

                          if (!companyDoc.exists) {
                            finish("Documento não encontrado");
                            resolveSearch();
                            return;
                          }

                          // Se não existir o campo code OU se o código for diferente, atualiza o documento individual
                          if (!company.code || company.code !== code[0]) {
                            try {
                              await companiesRef.doc(companyDoc.id).update({
                                code: code[0],
                                receivedAt:
                                  admin.firestore.FieldValue.serverTimestamp(),
                              });
                              finish("Code updated/criado successfully.");
                              resolveSearch();
                              return;
                            } catch (updateErr) {
                              console.error(
                                "Erro ao atualizar o código no Firestore:",
                                updateErr
                              );
                              finish(undefined, updateErr);
                              resolveSearch();
                              return;
                            }
                          } else {
                            finish("Code já existe.");
                            resolveSearch();
                            return;
                          }
                        } catch (queryErr) {
                          console.error(
                            "Erro na query do Firestore:",
                            queryErr
                          );
                          finish(undefined, queryErr);
                          resolveSearch();
                          return;
                        }
                      }
                    })
                    .catch((err: any) => {
                      console.error("❌ ERRO ao processar email:", err);
                      console.error("Stack trace:", err?.stack);
                      finish(undefined, err);
                      rejectSearch(err);
                    });
                });
              });
              f.once("end", () => {
                resolveSearch();
              });
            }
          );
        });
      });

      Promise.all(searchBySender)
        .then(() => {
          console.log("✅ Todas as buscas por remetente concluídas");
          if (!finished) {
            console.log("⚠️ Nenhum código encontrado hoje");
            finish("No code found today.");
          }
        })
        .catch((err) => {
          console.error("❌ Erro no Promise.all:", err);
          if (!finished) finish(undefined, err);
        });
    });
  });

  imap.once("error", function (err: any) {
    console.error("❌ ERRO na conexão IMAP:", err);
    console.error("Detalhes do erro:", err?.message);
    finish(undefined, err);
  });

  imap.once("end", function () {
    console.log("🔌 Conexão IMAP fechada");
  });
  
  console.log("🔌 Tentando conectar ao IMAP...");

  imap.connect();
}

// Cloud Function desabilitada - lógica movida para API route do Next.js (/app/api/check-emails/route.ts)
// Mantida como referência caso seja necessário reativar no futuro
/*
export const checkEmailsManual = onRequest(
  { region: "southamerica-east1" },
  async (req, res) => {
    let finished = false;
    function onSuccess(msg: string) {
      if (!finished) {
        finished = true;
        res.status(200).send(msg);
      }
    }
    function onError(err: any) {
      if (!finished) {
        finished = true;
        res.status(500).send("Error checking emails");
      }
    }
    try {
      checkEmails(
        onSuccess,
        onError,
        req.body.companyName,
        req.body.companyEmail,
        req.body.companyReceiverEmail,
        req.body.companyReceiverEmailPassword
      );
    } catch (error) {
      onError(error);
    }
  }
);
*/
