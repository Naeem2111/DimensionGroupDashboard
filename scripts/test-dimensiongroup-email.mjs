/**
 * One-off mail connectivity test for cPanel accounts.
 * Usage: SMTP_TEST_PASSWORD='...' node scripts/test-dimensiongroup-email.mjs
 * Optional: SMTP_TEST_TO=recipient@example.com (defaults to same as user)
 */

import tls from "node:tls";
import net from "node:net";

const USER = process.env.SMTP_TEST_USER || "test@dimensiongroupglobal.com";
const PASS = process.env.SMTP_TEST_PASSWORD || "";
const HOST = process.env.SMTP_TEST_HOST || "mail.dimensiongroupglobal.com";
const SMTP_PORT = Number(process.env.SMTP_TEST_PORT || 465);
const IMAP_PORT = Number(process.env.IMAP_TEST_PORT || 993);
const TO = process.env.SMTP_TEST_TO || USER;

if (!PASS) {
  console.error("Set SMTP_TEST_PASSWORD env var.");
  process.exit(1);
}

function tlsProbe(label, port) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = tls.connect(
      { host: HOST, port, servername: HOST, rejectUnauthorized: true },
      () => {
        socket.end();
        resolve({ label, port, ok: true, ms: Date.now() - started });
      }
    );
    socket.setTimeout(15000);
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ label, port, ok: false, error: "timeout", ms: Date.now() - started });
    });
    socket.on("error", (err) => {
      resolve({ label, port, ok: false, error: err.message, ms: Date.now() - started });
    });
  });
}

/** Minimal SMTPS send via raw protocol (AUTH LOGIN + DATA). */
function smtpSendTest() {
  return new Promise((resolve) => {
    const encoded = (s) => Buffer.from(s, "utf8").toString("base64");
    let stage = "connect";
    let buffer = "";
    const transcript = [];

    const fail = (msg) => {
      try {
        socket.end();
      } catch {
        /* ignore */
      }
      resolve({ ok: false, error: msg, transcript });
    };

    const send = (line) => {
      transcript.push(`> ${line.replace(PASS, "***")}`);
      socket.write(`${line}\r\n`);
    };

    const expectCode = (code, next) => {
      const handler = () => {
        while (buffer.includes("\r\n")) {
          const idx = buffer.indexOf("\r\n");
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          transcript.push(`< ${line}`);
          if (!line.startsWith(String(code))) {
            socket.removeListener("data", handler);
            fail(`Expected ${code}, got: ${line}`);
            return;
          }
          socket.removeListener("data", handler);
          next();
          return;
        }
      };
      socket.on("data", handler);
    };

    const socket = tls.connect(
      { host: HOST, port: SMTP_PORT, servername: HOST, rejectUnauthorized: true },
      () => {
        stage = "greeting";
        expectCode("220", () => {
          send(`EHLO ${HOST}`);
          stage = "ehlo";
          expectCode("250", () => {
            send("AUTH LOGIN");
            stage = "auth-login";
            expectCode("334", () => {
              send(encoded(USER));
              stage = "auth-user";
              expectCode("334", () => {
                send(encoded(PASS));
                stage = "auth-pass";
                expectCode("235", () => {
                  send(`MAIL FROM:<${USER}>`);
                  stage = "mail-from";
                  expectCode("250", () => {
                    send(`RCPT TO:<${TO}>`);
                    stage = "rcpt-to";
                    expectCode("250", () => {
                      send("DATA");
                      stage = "data";
                      expectCode("354", () => {
                        const body = [
                          `From: ${USER}`,
                          `To: ${TO}`,
                          `Subject: Blocharch SMTP test ${new Date().toISOString()}`,
                          "MIME-Version: 1.0",
                          "Content-Type: text/plain; charset=utf-8",
                          "",
                          "This is an automated SMTP connectivity test from the Blocharch dashboard setup.",
                          "",
                          `Sent at: ${new Date().toISOString()}`,
                          ".",
                        ].join("\r\n");
                        send(body);
                        stage = "sent";
                        expectCode("250", () => {
                          send("QUIT");
                          expectCode("221", () => {
                            socket.end();
                            resolve({ ok: true, to: TO, transcript });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      }
    );

    socket.setTimeout(30000);
    socket.on("timeout", () => fail(`timeout during ${stage}`));
    socket.on("error", (err) => fail(err.message));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
    });
  });
}

async function main() {
  console.log(`Testing ${USER} @ ${HOST}\n`);

  const probes = await Promise.all([
    tlsProbe("SMTP SSL/TLS", SMTP_PORT),
    tlsProbe("IMAP SSL/TLS", IMAP_PORT),
  ]);

  for (const p of probes) {
    console.log(
      `${p.ok ? "OK" : "FAIL"}  ${p.label} port ${p.port} (${p.ms}ms)${p.error ? ` — ${p.error}` : ""}`
    );
  }

  console.log("\nSMTP AUTH + send test…");
  const send = await smtpSendTest();
  if (send.ok) {
    console.log(`OK  Message accepted for delivery to ${send.to}`);
  } else {
    console.log(`FAIL  ${send.error}`);
    console.log("\nTranscript:");
    for (const line of send.transcript.slice(-20)) console.log(line);
    process.exit(1);
  }

  console.log("\nAll checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
