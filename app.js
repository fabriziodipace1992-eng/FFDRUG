/**
 * APP.JS — Scottino
 * Logica principale: voce, trascrizione, IA, ricerca prodotto
 *
 * CONFIGURAZIONE: inserisci la tua API key Anthropic nel file config.js
 */

// ── Stato applicazione ────────────────────────────────────────────────────────
let recognition  = null;
let recording    = false;
let hasText      = false;
let currentOrder = null;

// ── Inizializzazione ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  buildDBTable();
});

function buildDBTable() {
  const tbody = document.getElementById("dbBody");
  document.getElementById("dbCount").textContent = DB.length;
  DB.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.nome_prodotto}</td>
      <td>${p.nome_commerciale}</td>
      <td class="mono">${p.barcode}</td>
      <td class="mono">${p.codice}</td>`;
    tbody.appendChild(tr);
  });
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById("s" + i);
    if (i < n)       el.className = "step done";
    else if (i === n) el.className = "step active";
    else              el.className = "step";
  }
}

function toggleDB() {
  const table   = document.getElementById("dbTable");
  const chevron = document.getElementById("dbChevron");
  const open    = table.style.display === "none";
  table.style.display  = open ? "block" : "none";
  chevron.className    = open ? "ti ti-chevron-up" : "ti ti-chevron-down";
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

// ── Fase 1: input vocale ──────────────────────────────────────────────────────
function toggleMic() {
  const supported = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
  if (!supported) {
    alert("Riconoscimento vocale non supportato.\nUsa Google Chrome su desktop e riprova.");
    return;
  }
  if (recording) { recognition.stop(); return; }

  const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SRec();
  recognition.lang            = "it-IT";
  recognition.continuous      = false;
  recognition.interimResults  = true;

  recognition.onstart = () => {
    recording = true;
    document.getElementById("micBtn").classList.add("recording");
    document.getElementById("micHint").textContent = "In ascolto... parla ora";
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

  recognition.onend = () => {
    recording = false;
    document.getElementById("micBtn").classList.remove("recording");
    document.getElementById("micHint").innerHTML =
      'Premi per registrare<br><span class="hint-small">(oppure scrivi direttamente sotto)</span>';
  };

  recognition.start();
}

// ── Fase 3: interpretazione IA ────────────────────────────────────────────────
async function analyze() {
  const text = document.getElementById("transcription").textContent.trim();
  if (!text) return;

  setStep(3);
  const btn = document.getElementById("analyzeBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Analisi IA in corso...';
  document.getElementById("phase-result").innerHTML = "";

  const dbDesc = DB
    .map((p, i) => `${i}: "${p.nome_prodotto}" (commerciale: ${p.nome_commerciale})`)
    .join("\n");

  const prompt = `Sei l'assistente ordini dell'Ospedale Le Scotte di Siena.
L'operatore sanitario ha detto: "${text}"

Catalogo prodotti disponibili:
${dbDesc}

Rispondi SOLO con un oggetto JSON valido, senza markdown, senza backtick, con questi campi:
{
  "intent": "breve descrizione dell'intenzione (es: ordine guanti M)",
  "product_index": <numero intero, indice del prodotto più adatto, oppure -1 se non trovato>,
  "quantity": <numero intero, quantità richiesta, default 1>,
  "unit": "unità di misura (es: pacco, conf, pz, flacone)",
  "confidence": "alta|media|bassa",
  "note": "motivo se non trovato, oppure stringa vuota"
}`;

  try {
    // NOTA: la chiamata API funziona nell'anteprima integrata di Claude.
    // Per il deploy su GitHub Pages o server proprio, vedi README.md.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages:   [{ role: "user", content: prompt }]
      })
    });

    const data   = await res.json();
    const raw    = data.content.map(c => c.text || "").join("").trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    setStep(4);
    showResult(text, parsed);

  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-sparkles"></i> Interpreta e cerca prodotto';
    setStep(2);
    showError();
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
          <p class="note">${parsed.note || ""}</p>
          <button class="reset-btn" onclick="reset()">Prova di nuovo</button>
        </div>
      </div>`;
    return;
  }

  const prod = DB[parsed.product_index];
  currentOrder = { ...prod, quantity: parsed.quantity, unit: parsed.unit };

  const confClass = parsed.confidence === "alta"   ? "badge-success"
                  : parsed.confidence === "media"  ? "badge-warn"
                  :                                  "badge-info";

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

function showError() {
  document.getElementById("phase-result").innerHTML = `
    <div class="result-card">
      <div class="no-result">
        <i class="ti ti-wifi-off icon-lg"></i>
        <p>Errore di connessione all'IA</p>
        <button class="reset-btn" onclick="reset()" style="margin-top:0.75rem">Riprova</button>
      </div>
    </div>`;
}

// ── Conferma ordine (placeholder per fasi 5-6) ────────────────────────────────
function confirmOrder() {
  if (!currentOrder) return;
  const qty = parseInt(document.getElementById("qtyInput").value) || 1;

  // TODO fase 5-6: qui andrà la chiamata al gestionale aziendale
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
