# SPEC_02 — SFCM Symbol Generator (React + SVG)

> Questa SPEC sostituisce la precedente basata su p5.js.  
> L’architettura di rendering è ora **React + SVG** (preview + export).  
> L’animazione viene sviluppata insieme al rendering delle linee, non dopo il deploy.

---

## 1. Background

SFCM (Studio For Cosmopolitical Models) vuole una web app che generi **simboli / processi** a partire da **keywords**.

Output desiderato:

- una **mappa reticolare vettoriale** di linee e frecce,
- ramificazioni alle intersezioni,
- estetica: bianco su nero, linee sottili e frecce minimali, nessun testo nel canvas.

La prima architettura (SPEC_01) prevedeva p5.js.  
Dopo prototipazione, si è deciso di passare a:

- **React + SVG** per avere preview ed export **100% vettoriali**, coerenti tra loro.

---

## 2. Requisiti

### 2.1 Semantica

- Input: lista di **max 10 keywords** (tipico 4–5).
- Ogni keyword è proiettata su **6 assi**:

  1. Ordine ↔ Caos  
  2. Conflitto ↔ Consenso  
  3. Teoria ↔ Pratica  
  4. Individuale ↔ Collettivo  
  5. Naturale ↔ Artificiale  
  6. Locale ↔ Globale  

- Ogni asse → valore ∈ **[-10, +10]**.

### 2.2 Slider (controlli)

4 slider ∈ [0, 1]:

- **densità** → quante connessioni extra oltre la rete minima;
- **ramificazione** → quante nuove linee alle intersezioni;
- **complessità** → tetto massimo di linee totali;
- **mutamento** → quanti sottopunti genera ogni keyword.

### 2.3 Vincoli visivi

- Canvas concettuale: **viewBox 0 0 1080 1080**.
- L’SVG deve:

  - mantenere rapporto 1:1,
  - stare **sempre dentro il viewport** (no scroll orizzontale),
  - scalare in base a `min(100vw, 100vh)`.

- Stile:

  - sfondo: nero (#000),
  - linee + frecce: bianche (#fff),
  - linee sottili (`stroke-width=1`),
  - nessun testo nel canvas,
  - UI font: Times New Roman.

### 2.4 Determinismo

A parità di:

- keywords,
- slider,
- dizionario semantico,

il sistema deve generare **lo stesso SVG** (stesso output, stesso seed).

### 2.5 Hosting

- Next.js (App Router) + React + TypeScript.
- Hosting su **Vercel**.
- App pubblica, senza login.

---

## 3. Method — Pipeline concettuale

La pipeline completa è:

1. **Fase 1 — Semantica**: keywords → vettori sui 6 assi.
2. **Fase 2 — Geometria**: vettori → punti (cluster).
3. **Fase 3 — Connessioni**: punti → linee (MST + extra).
4. **Fase 4 — Ramificazioni**: intersezioni → nuove linee.
5. **Fase 5 — Rendering SVG + Animazione**: dati → `<svg>` (preview + animazione).

L’animazione è parte integrante della Fase 5 (rendering), **non un passo post-deploy**.

---

### 3.1 Fase 1 — Semantica (Keywords → Assi)

Ogni keyword produce un vettore:

```ts
type Axes = {
  ordine_caos: number;
  conflitto_consenso: number;
  teoria_pratica: number;
  individuale_collettivo: number;
  naturale_artificiale: number;
  locale_globale: number;
};
```

#### Sorgenti dei valori

1. **Dizionario locale** (`semantic/semantic-map.json`)

   - chiave: stringa lowercase della keyword;
   - valore: `Axes`.

2. **Fallback deterministico**

   - se la parola non è nel dizionario:
     - `fallbackAxes(word)` usa un PRNG deterministico (seed = hash(word)),
     - genera 6 valori ∈ [-10, +10].

3. **Gemini (solo authoring, opzionale)**

   - in fase di sviluppo, si può chiamare un’API interna `/api/semantic?word=...` per farsi suggerire valori da Gemini;
   - i valori approvati vengono poi inseriti a mano nel dizionario;
   - in produzione, idealmente si usa solo il dizionario.

#### Output Fase 1

```ts
type KeywordVec = {
  keyword: string;
  axes: Axes;
};
```

---

### 3.2 Fase 2 — Geometria (Assi → Coordinate / Cluster)

Obiettivo: disporre i concetti nello spazio.

#### Canvas logico

- Lavoriamo in coordinate 0–1080 per x e y.
- Margine interno (es. 40px) per evitare tagli.

#### Proiezione esagonale

Usiamo una "ruota" a 6 direzioni:

```ts
function projectHex(v: Axes, scale = 40): { x: number; y: number } {
  const rad = (deg: number) => (Math.PI / 180) * deg;
  const comps = [
    { a: v.ordine_caos, ang: 0 },
    { a: v.conflitto_consenso, ang: 60 },
    { a: v.teoria_pratica, ang: 120 },
    { a: v.individuale_collettivo, ang: 180 },
    { a: v.naturale_artificiale, ang: 240 },
    { a: v.locale_globale, ang: 300 }
  ];

  const sx = comps.reduce((s, c) => s + c.a * Math.cos(rad(c.ang)), 0) * scale;
  const sy = comps.reduce((s, c) => s + c.a * Math.sin(rad(c.ang)), 0) * scale;

  let x = sx + 540;
  let y = sy + 540;

  const margin = 40;
  x = Math.max(margin, Math.min(1080 - margin, x));
  y = Math.max(margin, Math.min(1080 - margin, y));

  return { x, y };
}
```

#### Cluster per keyword (slider “mutamento”)

- Ogni keyword genera un cluster:

  - 1 punto principale (da `projectHex()`),
  - N sottopunti in base a `mutamento`:

    - mutamento ≈ 0 → 3–6 sottopunti,
    - mutamento ≈ 1 → ~10–15 sottopunti.

- I sottopunti:

  - sono generati radialmente attorno al punto principale,
  - hanno raggio e angolo deterministici (PRNG basato su seed globale + nome keyword),
  - Ordine–Caos influenza il jitter (più Caos → più disordine radiale),
  - Individuale–Collettivo influenza la densità (più Collettivo → cluster più concentrato).

#### Tipi Fase 2

```ts
type Point = { x: number; y: number };

type ClusterPoint = Point & {
  isPrimary: boolean;
};

type Cluster = {
  keyword: string;
  axes: Axes;
  mutamento: number;
  points: ClusterPoint[];
};
```

---

### 3.3 Fase 3 — Connessioni (Punti → Linee)

Obiettivo: costruire il grafo di base.

#### MST + extra

1. Mettiamo tutti i punti in un array.
2. Costruiamo un **Minimum Spanning Tree**:

   - algoritmo deterministico (Prim / Kruskal),
   - peso = distanza euclidea.

3. Aggiungiamo connessioni extra:

   - slider **densità** → quanti vicini in più collegare;
   - slider **complessità** → tetto massimo di linee totali.

#### Curvatura (Naturale–Artificiale)

Per ogni connessione:

- calcoliamo la media `meanNatArt` dei punti coinvolti;
- otteniamo un coefficiente:

```ts
function curvatureFor(meanNatArt: number): number {
  // map [-10, 10] → [0.8, -0.8]
  return 0.8 - ((meanNatArt + 10) / 20) * 1.6;
}
```

Punto di controllo per una Bézier quadratica:

```ts
const mx = (c.from.x + c.to.x) / 2;
const my = (c.from.y + c.to.y) / 2;
const cx = mx + (c.to.y - c.from.y) * c.curvature;
const cy = my - (c.to.x - c.from.x) * c.curvature;
```

#### Tratteggio (Teoria–Pratica)

- Se la media di `teoria_pratica` è molto verso Teoria (valori negativi forti) → `dashed = true`.
- Se verso Pratica (positivi) → `dashed = false`.

#### Tipi Fase 3

```ts
type Connection = {
  from: Point;
  to: Point;
  curved: boolean;
  curvature: number; // -0.8 .. 0.8
  dashed: boolean;
  semanticInfluence: Partial<Axes>;
};
```

---

### 3.4 Fase 4 — Ramificazioni (Intersezioni → Nuove linee)

Obiettivo: far “crescere” il grafo alle intersezioni.

#### Intersezioni

- Per ogni coppia di connessioni (A,B):
  - si approssimano le curve a segmenti,
  - si verifica se si intersecano,
  - si calcola il punto di intersezione.

```ts
type Intersection = {
  point: Point;
  fromIndices: number[]; // connessioni coinvolte
};
```

#### Nuove linee (slider “ramificazione”)

- `ramificazione ∈ [0,1]` stabilisce il numero medio di nuove linee per intersezione:

  - 0 → nessuna ramificazione,
  - valori medi → 1–2 nuove linee,
  - alti → 3–5 nuove linee (con limite globale di sicurezza).

- Direzione:

  - somma normalizzata delle direzioni delle linee in ingresso,
  - offset deterministico (PRNG) per aprire ramificazioni in diverse direzioni.

- Lunghezza influenzata da **Locale–Globale** (più Globale → rami più lunghi).

#### Tipi Fase 4

```ts
type BranchedConnection = Connection & {
  generationDepth: number; // 0=MST, 1=extra, 2=ramificazioni
  generatedFrom?: number;  // id o indice della Intersection
};
```

---

### 3.5 Fase 5 — Rendering SVG + Animazione (React)

Questa è la parte **visiva**: qui entra in gioco React.

#### Componenti principali

- `SvgPreview.tsx` — disegna lo `<svg>`.
- `DownloadSvgButton.tsx` — scarica lo stesso SVG.
- (Futuro) `animations.ts` — helper per calcolare stati di animazione.

#### SvgPreview

Props:

```ts
type SvgPreviewProps = {
  connections: BranchedConnection[];
  animationEnabled?: boolean;
  animationProgress?: number; // 0..1, opzionale
};
```

Struttura:

```tsx
<div className="svg-wrapper">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1080 1080"
    className="svg-preview"
  >
    <defs>
      <marker
        id="arrowhead"
        markerWidth="6"
        markerHeight="6"
        refX="0"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L6,3 z" fill="#ffffff" />
      </marker>
    </defs>

    <rect x="0" y="0" width="1080" height="1080" fill="#000000" />

    {/* loop sulle connessioni */}
  </svg>
</div>
```

Per ogni connessione:

- linea dritta:

```tsx
<line
  x1={c.from.x}
  y1={c.from.y}
  x2={c.to.x}
  y2={c.to.y}
  stroke="#ffffff"
  strokeWidth={1}
  strokeDasharray={c.dashed ? "6 6" : undefined}
  markerEnd="url(#arrowhead)"
/>
```

- curva:

```tsx
const { cx, cy } = computeCurveControl(c);

<path
  d={`M ${c.from.x} ${c.from.y} Q ${cx} ${cy} ${c.to.x} ${c.to.y}`}
  stroke="#ffffff"
  strokeWidth={1}
  fill="none"
  strokeDasharray={c.dashed ? "6 6" : undefined}
  markerEnd="url(#arrowhead)"
/>
```

#### CSS (canvas 1:1 dentro il viewport)

```css
.svg-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  padding: 16px;
}

.svg-preview {
  max-width: min(100vw, 100vh);
  max-height: min(100vw, 100vh);
  width: 100%;
  height: auto;
  aspect-ratio: 1 / 1;
  display: block;
}
```

#### Animazione (integrata in questa fase)

L’animazione è parte del rendering, non un “extra dopo il deploy”.

Possibili strategie:

- **line drawing**:

  - per ogni path/line, impostare:
    - `stroke-dasharray` = lunghezza della linea,
    - `stroke-dashoffset` = lunghezza * (1 - progress),
  - dove `progress ∈ [0,1]` viene calcolato in base a un tempo o a `generationDepth`.

- **sequenza per generationDepth**:

  - prima MST (`generationDepth = 0`),
  - poi extra,
  - poi ramificazioni (`generationDepth = 2`),
  - progress calcolato in blocchi (0–0.33, 0.33–0.66, 0.66–1).

L’animazione deve essere:

- **deterministica** (stesso input → stesso modo di animare),
- **disattivabile** (es. toggle “Animazione ON/OFF”).

Quando si esporta lo SVG, si può esportare:

- una versione **senza** animazione (per stampa/pubblicazione).

---

## 4. Implementation (vista di alto livello)

### 4.1 Stack tecnico

- Next.js (App Router) + React + TypeScript.
- Nessun p5.js; solo `<svg>` e logica TS.
- `seedrandom` + hash `cyrb53` per determinismo.
- `semantic/semantic-map.json` per dizionario.

### 4.2 Struttura file

```txt
sfcm-symbols/
├─ app/
│  ├─ page.tsx                # UI: keywords, slider, preview, download
│  ├─ layout.tsx              # tema globale (nero, Times)
│  └─ api/
│     └─ semantic/route.ts    # opzionale (Gemini)
├─ components/
│  ├─ SvgPreview.tsx
│  ├─ Controls.tsx            # slider + input keywords
│  └─ DownloadSvgButton.tsx
├─ lib/
│  ├─ types.ts
│  ├─ seed.ts
│  ├─ semantic.ts
│  ├─ geometry.ts
│  ├─ svgExport.ts
│  └─ permalink.ts
├─ semantic/
│  └─ semantic-map.json
├─ styles/
│  └─ globals.css
└─ docs/
   ├─ SPEC_02_GITHUB.md
   ├─ CURSOR_WORKFLOW_02.md
   └─ TASKS_02.md
```

---

## 5. Milestones (overview)

I dettagli dei task sono in `TASKS_02.md`, ma la sequenza logica è:

1. Layout + tema.
2. Tipi, semantica, seed.
3. Geometria (cluster, connessioni, ramificazioni).
4. Rendering SVG + animazione base.
5. Export SVG.
6. UI completa.
7. Permalink.
8. (opzionale) Gemini.
9. Deploy su Vercel.

---

## 6. Gathering Results

- Verificare determinismo (stesso input → stesso SVG).
- Verificare che lo SVG rimanga sempre 1:1 e dentro il viewport.
- Verificare che l’estetica rispetti i riferimenti SFCM.
- Verificare che la transizione animata sia coerente con la logica di “crescita processuale”.

---

## Need Professional Help in Developing Your Architecture?

Please contact me at [sammuti.com](https://sammuti.com) :)
