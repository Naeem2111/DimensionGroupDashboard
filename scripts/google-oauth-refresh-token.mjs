/**
 * One-time helper: obtain GOOGLE_REFRESH_TOKEN for server-side Calendar API.
 *
 * Prerequisites:
 *   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (or env vars)
 *   Redirect URI http://localhost:3333/oauth2callback added to OAuth client
 *
 * Run: node scripts/google-oauth-refresh-token.mjs
 */

import http from "http";
import { URL } from "url";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const port = 3333;
const redirectUri = `http://localhost:${port}/oauth2callback`;
const scope = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first.");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", scope);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

console.log("\nOpen this URL in the browser (sign in as Jethro):\n");
console.log(authUrl.toString());
console.log("\nWaiting for callback on", redirectUri, "...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  if (url.pathname !== "/oauth2callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  if (!code) {
    res.writeHead(400);
    res.end("Missing code");
    return;
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();
  res.writeHead(200, { "Content-Type": "text/html" });
  if (!data.refresh_token) {
    res.end("<p>No refresh_token — revoke app access and run again with prompt=consent.</p>");
    console.error(data);
  } else {
    res.end("<p>Success. Copy the refresh token from the terminal.</p>");
    console.log("\nAdd to .env:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
  }

  server.close();
});

server.listen(port);
