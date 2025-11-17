# TASKS_02 — Milestones SFCM (React + SVG)

> Ogni sezione corrisponde a uno step del `CURSOR_WORKFLOW_02.md`.

---

## Step 1 — Layout & Tema

- [ ] `app/layout.tsx` aggiornato:
  - [ ] font: Times New Roman
  - [ ] fondo nero
  - [ ] main full-height (`min-height: 100vh`)
- [ ] `styles/globals.css`:
  - [ ] reset `html, body`
  - [ ] `.svg-wrapper` definita
  - [ ] `.svg-preview` definita (1:1 dentro viewport)

---

## Step 2 — Tipi, Seed, Semantica

- [ ] `lib/types.ts` creato con:
  - [ ] `Axes`
  - [ ] `KeywordVec`
  - [ ] `Point`
  - [ ] `ClusterPoint`
  - [ ] `Cluster`
  - [ ] `Connection`
  - [ ] `BranchedConnection`
- [ ] `lib/seed.ts` creato con:
  - [ ] funzione `cyrb53`
  - [ ] funzione `prng`
- [ ] `lib/semantic.ts` creato con:
  - [ ] import `semantic/semantic-map.json`
  - [ ] `fallbackAxes(word): Axes`
  - [ ] `getAxesForKeyword(word): Promise<Axes>`
- [ ] Test: chiamare `getAxesForKeyword` su 2–3 parole e loggare i risultati.

---

## Step 3 — Geometria

- [ ] `lib/geometry.ts` creato/aggiornato:

  - [ ] `projectHex(axes, scale?)`:
    - [ ] usa ruota esagonale,
    - [ ] clamp alle coordinate 0–1080 (con margine).
  - [ ] `generateCluster(keyword, axes, mutamento, seed)`:
    - [ ] punto principale calcolato,
    - [ ] sottopunti generati,
    - [ ] numero di sottopunti dipendente da `mutamento`.
  - [ ] `buildConnections(points, axesPerPoint, sliders)`:
    - [ ] MST deterministico,
    - [ ] connessioni extra da densità,
    - [ ] limite da complessità,
    - [ ] `curved` + `curvature` da Naturale–Artificiale,
    - [ ] `dashed` da Teoria–Pratica.
  - [ ] `detectIntersections(connections)`:
    - [ ] restituisce lista di intersezioni.
  - [ ] `addBranching(connections, intersections, sliders, seed)`:
    - [ ] genera nuove linee,
    - [ ] imposta `generationDepth`,
    - [ ] limita numero massimo di connessioni.

---

## Step 4 — Rendering SVG + Animazione

- [ ] `components/SvgPreview.tsx` creato:

  - [ ] props `connections`, `animationEnabled?`, `animationProgress?`.
  - [ ] `<svg viewBox="0 0 1080 1080" className="svg-preview">`.
  - [ ] `<defs>` con `<marker id="arrowhead">`.
  - [ ] `<rect>` sfondo nero.
  - [ ] loop su `connections`:
    - [ ] `<line>` se `curved === false`,
    - [ ] `<path>` con `Q` se `curved === true`,
    - [ ] `stroke-dasharray` se `dashed === true`,
    - [ ] `markerEnd="url(#arrowhead)"`.

- [ ] Animazione integrata:

  - [ ] supporto per `animationEnabled`.
  - [ ] `animationProgress` usato per modulare `stroke-dashoffset`.
  - [ ] ordinamento connessioni per `generationDepth`.

---

## Step 5 — Export SVG

- [ ] `lib/svgExport.ts` creato:

  - [ ] `generateSvg(connections): string`.
  - [ ] l’SVG generato replica `SvgPreview` (stesso layout, ma statico).

- [ ] `components/DownloadSvgButton.tsx`:

  - [ ] riceve `connections`.
  - [ ] chiama `generateSvg`.
  - [ ] crea Blob `image/svg+xml`.
  - [ ] scarica il file `.svg`.

- [ ] Test: aprire il `.svg` esportato e verificare:

  - [ ] 1080×1080,
  - [ ] sfondo nero,
  - [ ] linee + frecce coerenti con la preview.

---

## Step 6 — UI (keywords + slider + preview + download)

- [ ] `app/page.tsx`:

  - [ ] input keywords (es. textarea separata da virgole),
  - [ ] slider densità,
  - [ ] slider ramificazione,
  - [ ] slider complessità,
  - [ ] slider mutamento,
  - [ ] pulsante “Genera”,
  - [ ] (opzionale) toggle “Animazione ON/OFF”.

- [ ] Pipeline:

  - [ ] parse delle keywords,
  - [ ] `getAxesForKeyword` per ogni keyword,
  - [ ] `generateCluster` per ogni keyword,
  - [ ] `buildConnections`,
  - [ ] `detectIntersections` + `addBranching`,
  - [ ] stato `connections` in React,
  - [ ] passare `connections` a `SvgPreview` e `DownloadSvgButton`.

---

## Step 7 — Permalink

- [ ] `lib/permalink.ts`:

  - [ ] funzione per encodare keywords + slider (+ seed) in querystring,
  - [ ] funzione per decodare querystring in stato.

- [ ] `page.tsx`:

  - [ ] leggere parametri all’avvio e ripristinare stato,
  - [ ] aggiornare URL su modifiche importanti (senza reload).

- [ ] Test permalink:  
  - [ ] generare un grafo,  
  - [ ] copiare URL,  
  - [ ] aprirlo in una nuova finestra → stesso output.

---

## Step 8 — Gemini (opzionale)

- [ ] `app/api/semantic/route.ts`:

  - [ ] legge `word` da query,
  - [ ] legge `process.env.GEMINI_API_KEY`,
  - [ ] chiama il modello Gemini,
  - [ ] restituisce JSON `Axes`.

- [ ] (Opzionale) collegare questa route in `semantic.ts` per uso in sviluppo.

- [ ] Assicurarsi che la chiave non sia mai visibile nel frontend.

---

## Step 9 — Deploy

- [ ] `npm run build` funziona senza errori.
- [ ] Progetto collegato a Vercel.
- [ ] (Se necessario) `GEMINI_API_KEY` configurata su Vercel.
- [ ] Test:

  - [ ] preview SVG su Vercel,
  - [ ] export SVG,
  - [ ] permalink.
