import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import Imap from "node-imap";
import { simpleParser } from "mailparser";

admin.initializeApp();

// Refactored: checkEmails now receives callbacks to finish immediately
export function checkEmails(
  onSuccess: (msg: string) => void,
  onError: (err: any) => void,
  companyEmail: string,
  companyReceiverEmail: string,
  companyReceiverEmailPassword: string,
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
            ["UNSEEN", ["SINCE", todayString], ["FROM", sender]],
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

              const f = imap.fetch(results, { bodies: "" });
              f.on("message", function (msg: any) {
                msg.on("body", function (stream: any) {
                  simpleParser(stream)
                    .then(async (parsed: any) => {
                      const senderEmail = parsed.from?.value?.[0]?.address;
                      if (!allowedSenders.includes(senderEmail)) {
                        console.log("Email ignored from:", senderEmail);
                        return;
                      }
                      const { text } = parsed;
                      const code = text?.match(/\b\d{6}\b/);
                      if (code) {
                        const snapshot = await admin
                          .firestore()
                          .collection("email-codes")
                          .where("sender", "==", senderEmail)
                          .get();
                        if (snapshot.empty) {
                          await admin
                            .firestore()
                            .collection("email-codes")
                            .add({
                              name: "Justos",
                              code: code[0],
                              sender: senderEmail,
                              receivedAt:
                                admin.firestore.FieldValue.serverTimestamp(),
                            });
                          console.log(
                            "Code saved:",
                            code[0],
                            "from:",
                            senderEmail
                          );
                          finish("Code saved successfully.");
                          resolveSearch();
                          return;
                        } else {
                          const doc = snapshot.docs[0];
                          const data = doc.data();
                          if (data.code !== code[0]) {
                            await doc.ref.update({
                              code: code[0],
                              receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                            console.log(
                              "Code updated:",
                              code[0],
                              "from:",
                              senderEmail
                            );
                            finish("Code updated successfully.");
                            resolveSearch();
                            return;
                          } else {
                            console.log(
                              "Code already exists and is the same:",
                              code[0],
                              "from:",
                              senderEmail
                            );
                            finish("Code already exists.");
                            resolveSearch();
                            return;
                          }
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
              f.once("end", () => resolveSearch());
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
    console.log(err);
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
      checkEmails( onSuccess, onError, req.body.companyEmail, req.body.companyReceiverEmail, req.body.companyReceiverEmailPassword);
    } catch (error) {
      onError(error);
    }
  }
);
