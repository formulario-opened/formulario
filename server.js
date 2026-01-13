// server.js
// Requisitos: node >=14
// Instalar: npm install express node-fetch@2
// Uso:
//   export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."   # não exponha essa URL ao cliente
//   node server.js
//
// O servidor serve os arquivos em /public e recebe POST /submit para enviar ao webhook do Discord.

const express = require("express");
const fetch = require("node-fetch");
const dns = require("dns").promises;
const path = require("path");

const app = express();
app.use(express.json());

// Serve arquivos estáticos (client)
app.use(express.static(path.join(__dirname, "public")));

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
if (!WEBHOOK_URL) {
  console.error("ERRO: defina a variável de ambiente DISCORD_WEBHOOK_URL com a URL do webhook do Discord.");
  process.exit(1);
}

function validEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function domainHasMx(email) {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;
    const mx = await dns.resolveMx(domain);
    return Array.isArray(mx) && mx.length > 0;
  } catch {
    return false;
  }
}

// Rate limiter simples em memória por IP
const submissions = new Map();
const WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_PER_WINDOW = 15;

app.post("/submit", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
    const now = Date.now();
    const times = submissions.get(ip) || [];
    const recent = times.filter(t => now - t < WINDOW_MS);

    if (recent.length >= MAX_PER_WINDOW) {
      return res.status(429).json({ ok: false, message: "Muitos envios do seu IP. Tente novamente mais tarde." });
    }
    recent.push(now);
    submissions.set(ip, recent);

    const { name, email, favorite, why } = req.body || {};

    // tipos e limites
    const safeName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    const safeEmail = typeof email === "string" ? email.trim().slice(0, 254) : "";
    const safeFavorite = typeof favorite === "string" ? favorite.trim().slice(0, 200) : "";
    const safeWhy = typeof why === "string" ? why.trim().slice(0, 500) : "";

    if (!safeFavorite) {
      return res.status(400).json({ ok: false, message: "Campo 'favorite' é obrigatório." });
    }

    if (safeEmail && !validEmailFormat(safeEmail)) {
      return res.status(400).json({ ok: false, message: "E-mail inválido." });
    }

    // Verificação opcional de MX (não essencial, evita latência em alguns casos)
    let mxOk = false;
    try {
      if (safeEmail) mxOk = await domainHasMx(safeEmail);
    } catch {}

    // Cria mensagem para o Discord (texto simples)
    const lines = [
      "📨 Nova resposta — Pesquisa Meme Favorito",
      `Nome: ${safeName || "(não informado)"}`,
      `E-mail: ${safeEmail || "(não informado)"}`,
      `Meme favorito: ${safeFavorite}`,
      `Por que: ${safeWhy || "(não informado)"}`,
      `Verificação MX: ${mxOk ? "sim" : "não"}`
    ];
    const content = lines.join("\n");

    // Envia para o webhook do Discord
    const r = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("Erro ao postar no webhook:", r.status, text);
      return res.status(500).json({ ok: false, message: "Falha ao enviar ao webhook." });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro no /submit:", err);
    return res.status(500).json({ ok: false, message: "Erro interno no servidor." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}. Abra http://localhost:${PORT}/`);
});
