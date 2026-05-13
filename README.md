# FFDrug 🏥
**Assistente ordini vocale — Ospedale Le Scotte di Siena**

Prototipo web per ordinare materiale sanitario tramite input vocale o testuale.
L'IA interpreta la richiesta in linguaggio naturale e identifica il prodotto nel catalogo.

---

## Fasi implementate

| Fase | Descrizione | Stato |
|------|-------------|-------|
| 1 | Input vocale (microfono) | ✅ |
| 2 | Trascrizione automatica | ✅ |
| 3 | Interpretazione IA (Claude) | ✅ |
| 4 | Ricerca prodotto nel database | ✅ |
| 5 | Apertura gestionale aziendale | 🔜 da configurare |
| 6 | Inoltro ordine all'applicativo | 🔜 da configurare |

---

## Struttura file

```
scottino/
├── index.html      ← pagina principale
├── app.js          ← logica voce, IA, ricerca
├── database.js     ← catalogo prodotti (da aggiornare)
├── style.css       ← stile grafico
└── README.md       ← questo file
```

---

## Come aggiornare il catalogo prodotti

Apri `database.js` e modifica l'array `DB`.
Ogni prodotto ha questa struttura:

```javascript
{
  nome_prodotto:    "Nome del prodotto",
  nome_commerciale: "Nome commerciale / marca",
  barcode:          "codice a barre",
  codice:           "codice numerico interno"
}
```

Esempio — aggiungere un prodotto:
```javascript
{
  nome_prodotto:    "Guanti S",
  nome_commerciale: "NitrilfreeS",
  barcode:          "1454542570",
  codice:           "1454542570"
}
```

---

## Come usare in locale

1. Scarica o clona il repository
2. Apri `index.html` direttamente nel browser (Chrome consigliato)
3. Il microfono richiede Chrome su desktop per funzionare

> **Nota:** La chiamata all'API di Claude funziona direttamente nell'anteprima
> integrata. Per un deploy autonomo su server, vedi la sezione "Deploy" qui sotto.

---

## Deploy su GitHub Pages (per demo interna)

1. Vai su **Settings → Pages** nel tuo repository GitHub
2. Seleziona **Branch: main** come sorgente
3. Salva — GitHub pubblicherà l'app su `https://tuonome.github.io/scottino/`

> ⚠️ GitHub Pages è adatto solo per demo/presentazione.
> Per un deploy ospedaliero sicuro è necessario un server interno (vedi IT).

---

## Note per il reparto IT (deploy on-premise)

- L'app è un frontend statico (HTML + CSS + JS puro, nessun backend)
- La chiamata IA avviene verso `api.anthropic.com` — serve connessione outbound sulla porta 443
- In alternativa è possibile sostituire la chiamata con un modello LLM interno
- Il database prodotti è in `database.js`: può essere sostituito con una chiamata a un'API interna
- Compatibilità: Chrome/Edge moderni (il riconoscimento vocale richiede HTTPS in produzione)

---

## Roadmap fasi 5-6

Quando il gestionale aziendale sarà identificato, la funzione `confirmOrder()` in `app.js`
andrà completata con la logica di integrazione. I dati dell'ordine già disponibili sono:

```javascript
{
  nome_prodotto:    "...",
  nome_commerciale: "...",
  barcode:          "...",
  codice:           "...",
  quantity:         1,
  unit:             "pacco"
}
```
