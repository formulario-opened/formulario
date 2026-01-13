document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("meme-form");
  const msg = document.getElementById("message");

  function show(text, isError = false) {
    msg.textContent = text;
    msg.style.color = isError ? "#ffb4b4" : "#b7f0fb";
  }

  function validEmailFormat(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function sanitize(str) {
    return String(str || "").trim();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    show("");

    const payload = {
      name: sanitize(form.name.value).slice(0, 100),
      email: sanitize(form.email.value).slice(0, 254),
      favorite: sanitize(form.favorite.value).slice(0, 200),
      why: sanitize(form.why.value).slice(0, 500)
    };

    if (!payload.favorite) {
      show("Por favor, informe seu meme favorito.", true);
      return;
    }

    if (payload.email && !validEmailFormat(payload.email)) {
      show("Formato de e‑mail inválido.", true);
      return;
    }

    show("Enviando...");

    try {
      const resp = await fetch("/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const error = await resp.json().catch(()=>({ message: "Erro no servidor" }));
        show("Erro: " + (error.message || resp.statusText), true);
        return;
      }

      const data = await resp.json();
      if (data.ok) {
        show("Resposta recebida.");
        form.reset();
      } else {
        show("Não foi possível enviar: " + (data.message || "erro desconhecido"), true);
      }
    } catch (err) {
      show("Falha de rede: " + err.message, true);
    }
  });
});
