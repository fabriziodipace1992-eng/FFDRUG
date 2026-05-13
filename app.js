/**
 * APP.JS — Scottino
 * Ospedale Le Scotte di Siena
 * Fasi 1-4: voce → trascrizione → IA → ricerca prodotto
 *
 * La chiave API è tenuta solo in memoria (variabile JS).
 * Nessun localStorage/sessionStorage — compatibile con Edge.
 */

// ── Stato ─────────────────────────────────────────────────────────────────────
let APIKEY = "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";   // chiave in memoria, mai su disco
let recognition  = null;
let recording    = false;
let hasText      = false;
let currentOrder = null;

// ── Avvio ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  showApp();
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
  document.getElementById("apiKeyInput").value = "";
  document.getElementById("config-error").style.display = "none";
  showApp();
}

// ── Salvataggio API key ───────────────────────────────────────────────────────
async function saveApiKey() {
  const input = document.getElementById("apiKeyInput");
  const btn   = document.getElementById("configBtn");
  const err   = document.getElementById("config-error");
  const key   = input.value.trim();

  if (!key.startsWith("sk-ant-")) {
    err.textContent = "La chiave deve iniziare con sk-ant-... Controlla di averla copiata per intero.";
    err.style.display = "block";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Verifica in corso...';
  err.style.display = "none";

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
        model: "claude-haiku-4-5",
        max_tokens: 10,
        messages: [{ role: "user", content: "ok" }]
      })
    });

    if (res.status === 401) {
      err.textContent = "Chiave API non valida. Controlla di averla copiata per intero.";
      err.style.display = "block";
      return;
    }

    APIKEY = key;
    showApp();

  } catch (e) {
    err.textContent = "Errore di connessione. Verifica la connessione internet e riprova.";
    err.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-check"></i> Salva e avvia';
  }
}

// ── Microfono: verifica supporto ──────────────────────────────────────────────
function checkMicSupport() {
  const hasApi = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  if (!hasApi) {
    showMicWarning("Il microfono non è supportato in questo browser. Scrivi la richiesta a mano.");
    document.getElementById("micBtn").disabled = true;
    document.getElementById("micBtn").style.opacity = "0.35";
  }
}

function showMicWarning(msg) {
  const warn = document.getElementById("mic-warning");
  document.getElementById("mic-warning-text").textContent = msg;
  warn.style.display = "flex";
}

function hideMicWarning() {
  document.getElementById("mic-warning").style.display = "none";
}

// ── Microfono: registrazione ──────────────────────────────────────────────────
function toggleMic() {
  if (recording) { recognition.stop(); return; }

  const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SRec) {
    showMicWarning("Microfono non supportato. Usa Chrome oppure scrivi a mano.");
    return;
  }

  hideMicWarning();
  recognition = new SRec();
  recognition.lang            = "it-IT";
  recognition.continuous      = false;
  recognition.interimResults  = true;
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
    if (e.error === "not-allowed") {
      showMicWarning("Microfono bloccato. Clicca sull'icona 🔒 nella barra dell'indirizzo e consenti il microfono per questo sito.");
    } else if (e.error !== "no-speech") {
      showMicWarning("Errore microfono. Scrivi la richiesta a mano.");
    }
  };

  recognition.onend = () => {
    recording = false;
    document.getElementById("micBtn").classList.remove("recording");
    document.getElementById("micHint").innerHTML =
      'Premi per registrare<br><span class="hint-small">(oppure scrivi direttamente sotto)</span>';
  };

  try {
    recognition.start();
  } catch(e) {
    showMicWarning("Impossibile avviare il microfono. Scrivi la richiesta a mano.");
  }
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

  if (!APIKEY) { showConfig(); return; }

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
    `{"intent":"breve descrizione","product_index":<indice intero o -1>,"quantity":<intero>,"unit":"pacco/conf/pz/flacone","confidence":"alta|media|bassa","note":""}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": APIKEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (res.status === 401) {
      APIKEY = null;
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

  if (!parsed || parsed.product_index < 0 || parsed.product_index === undefined) {
    resultEl.innerHTML = `
      <div class="result-card">
        <div class="no-result">
          <i class="ti ti-search-off icon-lg"></i>
          <p>Prodotto non trovato nel catalogo</p>
          <p class="note">${(parsed && parsed.note) || "Prova a riformulare la richiesta"}</p>
          <button class="reset-btn" onclick="reset()" style="margin-top:1rem">Prova di nuovo</button>
        </div>
      </div>`;
    return;
  }

  const prod = DB[parsed.product_index];
  if (!prod) { reset(); return; }

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
               value="${parsed.quantity || 1}" min="1" max="999" />
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

// ── Conferma ordine ───────────────────────────────────────────────────────────
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
    `(Integrazione gestionale — fase 5-6)`
  );
}
