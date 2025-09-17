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

  imap.once("ready", function () {
    openInbox(function (err: any, box: any) {
      if (err) return finish(undefined, err);

      const searchBySender = allowedSenders.map((sender) => {
        return new Promise<void>((resolveSearch, rejectSearch) => {
          imap.search(
            [
              ["SINCE", todayString],
              ["FROM", sender],
            ],
            function (err: any, results: any) {
              if (err) {
                console.error(`IMAP search error for ${sender}:`, err);
                rejectSearch(err);
                return finish(undefined, err);
              }
              if (!results || !results.length) {
                resolveSearch();
                return;
              }

              // Ordena os resultados para pegar o e-mail mais recente
              const sortedResults = results.sort(
                (a: number, b: number) => b - a
              );
              const latestResult = sortedResults[0];

              const f = imap.fetch([latestResult], { bodies: "" });
              f.on("message", function (msg: any) {
                msg.on("body", function (stream: any) {
                  simpleParser(stream)
                    .then(async (parsed: any) => {
                      const senderEmail = parsed.from?.value?.[0]?.address;
                      if (!allowedSenders.includes(senderEmail)) {
                        return;
                      }
                      const { text, html } = parsed;
                      // Primeiro tenta capturar códigos com hífen e espaços (ex: 020 - 055)
                      let code = text?.match(/\b\d{3}\s*-\s*\d{3}\b/);
                      // Se não encontrar, busca códigos simples de 4-8 dígitos (evita números muito longos)
                      if (!code) {
                        code = text?.match(/\b\d{4,8}\b/);
                      }

                      if (!code && html) {
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
                        // Primeiro tenta capturar códigos com hífen e espaços no HTML limpo
                        code = htmlClean.match(/\b\d{3}\s*-\s*\d{3}\b/);
                        // Se não encontrar, busca códigos simples de 4-8 dígitos
                        if (!code) {
                          code = htmlClean.match(/\b\d{4,8}\b/);
                        }
                      }
                      if (code) {
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
                      console.error("Error processing email:", err);
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
          if (!finished) finish("No code found today.");
        })
        .catch((err) => {
          if (!finished) finish(undefined, err);
        });
    });
  });

  imap.once("error", function (err: any) {
    console.log("IMAP error:", err);
    finish(undefined, err);
  });

  imap.once("end", function () {
    console.log("IMAP connection closed");
  });

  imap.connect();
}

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
