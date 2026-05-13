/**
 * APP.JS — Scottino
 * Ospedale Le Scotte di Siena
 *
 * Fasi 1-4: voce → trascrizione → IA → ricerca prodotto
 */

// ── Stato ─────────────────────────────────────────────────────────────────────
let recognition  = null;
let recording    = false;
let hasText      = false;
let currentOrder = null;

// ── Avvio ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const key = localStorage.getItem("scottino_api_key");
  if (key) {
    showApp();
  } else {
    showScreen("screen-config");
  }
});

// ── Gestione schermate ────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
}

function showApp() {
  showScreen("screen-app");
  buildDBTable();
  checkMicSupport();
}

function showConfig() {
  const existing = localStorage.getItem("scottino_api_key") || "";
  document.getElementById("apiKeyInput").value = existing ? "••••••••••••••••" : "";
  document.getElementById("config-error").style.display = "none";
  showScreen("screen-config");
}

// ── Salvataggio API key ───────────────────────────────────────────────────────
async function saveApiKey() {
  const input = document.getElementById("apiKeyInput");
  const btn   = document.getElementById("configBtn");
  const err   = document.getElementById("config-error");
  const key   = input.value.trim();

  if (!key || key.startsWith("•")) {
    // Se non ha cambiato la chiave mascherata, vai avanti
    const existing = localStorage.getItem("scottino_api_key");
    if (existing) { showApp(); return; }
  }

  if (!key.startsWith("sk-ant-")) {
    err.textContent = "La chiave deve iniziare con sk-ant-... Controlla di averla copiata per intero.";
    err.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Verifica in corso...';
  err.style.display = "none";

  // Test rapido della chiave
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "ok" }]
      })
    });

    if (res.status === 401) {
      throw new Error("chiave non valida");
    }

    localStorage.setItem("scottino_api_key", key);
    showApp();

  } catch (e) {
    err.textContent = e.message.includes("chiave")
      ? "Chiave API non valida. Controlla di averla copiata per intero."
      : "Errore di connessione. Verifica la connessione internet e riprova.";
    err.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-check"></i> Salva e avvia';
  }
}

// ── Microfono: verifica supporto ──────────────────────────────────────────────
function checkMicSupport() {
  const warn = document.getElementById("mic-warning");
  const txt  = document.getElementById("mic-warning-text");

  const hasApi = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;

  if (!hasApi) {
    warn.style.display = "flex";
    txt.textContent = "Il microfono non è supportato in questo browser. Scrivi la richiesta a mano.";
    document.getElementById("micBtn").disabled = true;
    document.getElementById("micBtn").style.opacity = "0.35";
    return;
  }

  // Su Edge serve HTTPS — se siamo su http:// locale avvisiamo
  if (location.protocol === "http:" && location.hostname !== "localhost") {
    warn.style.display = "flex";
    txt.textContent = "Il microfono richiede HTTPS. Su GitHub Pages funziona regolarmente.";
  }
}

// ── Microfono: registrazione ──────────────────────────────────────────────────
function toggleMic() {
  if (recording) { recognition.stop(); return; }

  const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SRec();
  recognition.lang           = "it-IT";
  recognition.continuous     = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    recording = true;
    document.getElementById("micBtn").classList.add("recording");
    document.getElementById("micHint").innerHTML =
      '<strong style="color:var(--red-text)">In ascolto...</strong><br>' +
      '<span class="hint-small">Premi di nuovo per fermare</span>';
    const el = document.getElementById("transcription");
    el.textContent = "";
    el.classList.remove("empty");
  };

  recognition.onresult = (e) => {
    const el = document.getElementById("transcription");
    el.textContent = Array.from(e.results).map(r => r[0].transcript).join("");
    hasText = el.textContent.trim().length > 0;
    document.getElementById("analyzeBtn").disabled = !hasText;
    setStep(2);
  };

  recognition.onerror = (e) => {
    const warn = document.getElementById("mic-warning");
    const txt  = document.getElementById("mic-warning-text");
    warn.style.display = "flex";
    if (e.error === "not-allowed") {
      txt.textContent = "Microfono bloccato. Vai nelle impostazioni del browser e consenti l'accesso al microfono per questo sito.";
    } else if (e.error === "no-speech") {
      txt.textContent = "Nessun audio rilevato. Riprova parlando più vicino al microfono.";
      warn.style.display = "none"; // non critico
    } else {
      txt.textContent = "Errore microfono (" + e.error + "). Riprova o scrivi a mano.";
    }
  };

  recognition.onend = () => {
    recording = false;
    document.getElementById("micBtn").classList.remove("recording");
    document.getElementById("micHint").innerHTML =
      'Premi per registrare<br><span class="hint-small">(oppure scrivi direttamente sotto)</span>';
  };

  // Edge a volte richiede il permesso esplicito — lo chiediamo prima
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => recognition.start())
    .catch(() => {
      const warn = document.getElementById("mic-warning");
      const txt  = document.getElementById("mic-warning-text");
      warn.style.display = "flex";
      txt.textContent = "Permesso microfono negato. Clicca sull'icona 🔒 nella barra dell'indirizzo e consenti il microfono.";
    });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function buildDBTable() {
  const tbody = document.getElementById("dbBody");
  document.getElementById("dbCount").textContent = DB.length;
  DB.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nome_prodotto}</td><td>${p.nome_commerciale}</td>
      <td class="mono">${p.barcode}</td><td class="mono">${p.codice}</td>`;
    tbody.appendChild(tr);
  });
}

function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById("s" + i);
    el.className = i < n ? "step done" : i === n ? "step active" : "step";
  }
}

function toggleDB() {
  const table   = document.getElementById("dbTable");
  const chevron = document.getElementById("dbChevron");
  const open    = table.style.display === "none";
  table.style.display = open ? "block" : "none";
  chevron.className   = open ? "ti ti-chevron-up" : "ti ti-chevron-down";
}

function clearPlaceholder() {
  const el = document.getElementById("transcription");
  if (el.classList.contains("empty")) {
    el.textContent = "";
    el.classList.remove("empty");
  }
}

function onTextInput() {
  const el = document.getElementById("transcription");
  hasText = el.textContent.trim().length > 0;
  document.getElementById("analyzeBtn").disabled = !hasText;
  setStep(hasText ? 2 : 1);
}

function useExample(chip) {
  const el = document.getElementById("transcription");
  el.textContent = chip.textContent;
  el.classList.remove("empty");
  hasText = true;
  document.getElementById("analyzeBtn").disabled = false;
  setStep(2);
}

function reset() {
  currentOrder = null;
  document.getElementById("phase-result").innerHTML = "";
  const el = document.getElementById("transcription");
  el.textContent = 'es. "ordina 2 guanti M" oppure "serve paracetamolo"';
  el.classList.add("empty");
  hasText = false;
  document.getElementById("analyzeBtn").disabled = true;
  setStep(1);
}

// ── Fase 3: interpretazione IA ────────────────────────────────────────────────
async function analyze() {
  const text = document.getElementById("transcription").textContent.trim();
  if (!text) return;

  const apiKey = localStorage.getItem("scottino_api_key");
  if (!apiKey) { showConfig(); return; }

  setStep(3);
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analisi IA in corso...';
  document.getElementById("phase-result").innerHTML = "";

  const dbDesc = DB.map((p, i) =>
    `${i}: "${p.nome_prodotto}" (commerciale: ${p.nome_commerciale})`
  ).join("\n");

  const prompt =
    `Sei l'assistente ordini dell'Ospedale Le Scotte di Siena.\n` +
    `L'operatore sanitario ha detto: "${text}"\n\n` +
    `Catalogo prodotti disponibili:\n${dbDesc}\n\n` +
    `Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick:\n` +
    `{\n` +
    `  "intent": "breve descrizione dell'intenzione",\n` +
    `  "product_index": <indice intero del prodotto più adatto, -1 se non trovato>,\n` +
    `  "quantity": <quantità intera richiesta, default 1>,\n` +
    `  "unit": "unità di misura (pacco/conf/pz/flacone)",\n` +
    `  "confidence": "alta|media|bassa",\n` +
    `  "note": "motivo se non trovato, altrimenti stringa vuota"\n` +
    `}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (res.status === 401) {
      localStorage.removeItem("scottino_api_key");
      showConfig();
      return;
    }

    const data   = await res.json();
    const raw    = data.content.map(c => c.text || "").join("").trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    setStep(4);
    showResult(text, parsed);

  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> Interpreta e cerca prodotto';
    setStep(2);
    document.getElementById("phase-result").innerHTML = `
      <div class="result-card">
        <div class="no-result">
          <i class="ti ti-wifi-off icon-lg"></i>
          <p>Errore di connessione. Controlla internet e riprova.</p>
          <button class="reset-btn" onclick="reset()" style="margin-top:0.75rem">Riprova</button>
        </div>
      </div>`;
  }
}

// ── Fase 4: mostra risultato ──────────────────────────────────────────────────
function showResult(originalText, parsed) {
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-sparkles"></i> Interpreta e cerca prodotto';

  const resultEl = document.getElementById("phase-result");

  if (parsed.product_index < 0 || parsed.product_index === undefined) {
    resultEl.innerHTML = `
      <div class="result-card">
        <div class="no-result">
          <i class="ti ti-search-off icon-lg"></i>
          <p>Prodotto non trovato nel catalogo</p>
          <p class="note">${parsed.note || "Prova a riformulare la richiesta"}</p>
          <button class="reset-btn" onclick="reset()" style="margin-top:1rem">Prova di nuovo</button>
        </div>
      </div>`;
    return;
  }

  const prod = DB[parsed.product_index];
  currentOrder = { ...prod, quantity: parsed.quantity, unit: parsed.unit };

  const confClass = parsed.confidence === "alta"  ? "badge-success"
                  : parsed.confidence === "media" ? "badge-warn"
                  :                                 "badge-info";

  resultEl.innerHTML = `
    <div class="result-card">
      <div class="result-header">
        <div class="result-icon"><i class="ti ti-package"></i></div>
        <div>
          <div class="result-title">Prodotto identificato</div>
          <div class="result-sub">${parsed.intent}</div>
        </div>
      </div>
      <div class="intent-box">
        <span class="muted">Testo originale: </span>"${originalText}"
      </div>
      <table class="product-table">
        <tr><td>Nome prodotto</td>    <td><strong>${prod.nome_prodotto}</strong></td></tr>
        <tr><td>Nome commerciale</td> <td>${prod.nome_commerciale}</td></tr>
        <tr><td>Codice a barre</td>   <td class="mono">${prod.barcode}</td></tr>
        <tr><td>Codice numerico</td>  <td class="mono">${prod.codice}</td></tr>
        <tr><td>Confidenza IA</td>    <td><span class="badge ${confClass}">${parsed.confidence}</span></td></tr>
      </table>
      <div class="qty-row">
        <span class="muted">Quantità:</span>
        <input type="number" class="qty-input" id="qtyInput"
               value="${parsed.quantity}" min="1" max="999" />
        <span class="muted">${parsed.unit || "pz"}</span>
        <button class="confirm-btn" onclick="confirmOrder()">
          <i class="ti ti-check"></i> Conferma ordine
        </button>
      </div>
      <div class="reset-row">
        <button class="reset-btn" onclick="reset()">Nuova richiesta</button>
      </div>
    </div>`;
}

// ── Conferma ordine (placeholder fase 5-6) ───────────────────────────────────
function confirmOrder() {
  if (!currentOrder) return;
  const qty = parseInt(document.getElementById("qtyInput").value) || 1;
  alert(
    `Ordine pronto:\n\n` +
    `Prodotto:        ${currentOrder.nome_prodotto}\n` +
    `Nome comm.:      ${currentOrder.nome_commerciale}\n` +
    `Codice a barre:  ${currentOrder.barcode}\n` +
    `Codice numerico: ${currentOrder.codice}\n` +
    `Quantità:        ${qty} ${currentOrder.unit || "pz"}\n\n` +
    `(Integrazione gestionale da configurare — fase 5-6)`
  );
}
