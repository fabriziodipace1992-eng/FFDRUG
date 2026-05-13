# Scottino 🏥
**Assistente ordini vocale — Ospedale Le Scotte di Siena**

---

## Prima configurazione (5 minuti)

Al primo avvio l'app chiede una chiave API di Anthropic.

**Come ottenere la chiave:**
1. Vai su [console.anthropic.com](https://console.anthropic.com)
2. Registrati (puoi usare Google)
3. Menu a sinistra → **API Keys** → **Create Key**
4. Copia la chiave (inizia con `sk-ant-...`)
5. Incollala nell'app al primo avvio

La chiave viene salvata solo nel browser (localStorage) — non è nel codice e non viene caricata online.

---

## Fasi implementate

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 1 | Input vocale (microfono) | ✅ |
| 2 | Trascrizione automatica | ✅ |
| 3 | Interpretazione IA (Claude) | ✅ |
| 4 | Ricerca prodotto nel database | ✅ |
| 5 | Apertura gestionale aziendale | 🔜 |
| 6 | Inoltro ordine all'applicativo | 🔜 |

---

## Struttura file

```
scottino/
├── index.html    ← pagina principale
├── app.js        ← logica voce, IA, ricerca
├── database.js   ← catalogo prodotti (da aggiornare)
├── style.css     ← stile grafico
└── README.md     ← questo file
```

---

## Come aggiornare il catalogo

Apri `database.js` e modifica l'array `DB`. Ogni prodotto:

```javascript
{
  nome_prodotto:    "Nome del prodotto",
  nome_commerciale: "Nome commerciale / marca",
  barcode:          "codice a barre",
  codice:           "codice numerico interno"
}
```

---

## Deploy su GitHub Pages

1. Carica tutti i file su GitHub
2. **Settings → Pages → Branch: main → Save**
3. L'app sarà su `https://tuonome.github.io/nomerepo/`

> Il microfono funziona solo su HTTPS — GitHub Pages lo fornisce automaticamente.

---

## Note per il reparto IT

- Frontend statico (HTML + CSS + JS, nessun backend)
- Chiamate API verso `api.anthropic.com` (porta 443 outbound)
- In produzione on-premise: sostituire la chiamata con un LLM interno
- Il database (`database.js`) può essere sostituito con una chiamata REST interna
- Compatibilità: Chrome ed Edge moderni su HTTPS
