# ENGINE V2 — Geometry Pipeline (SPEC_04)

Pipeline completa allineata a `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`. Tutti gli step vengono orchestrati da `generateEngineV2` (`lib/engine_v2/engine.ts`).

## Step 1 — Keyword → Axes (semantic map v2)
- Funzioni: `getSemanticMapV2`, `getAxesForKeywordV2`, `normalizeKeywordV2` (`lib/engine_v2/axes.ts`).
- Ogni keyword (max 10) produce un `AxesV2` deterministico:
  - Lookup su `semantic/semantic-map-v2.json` normalizzando la keyword.
  - Sanitizzazione/clamp in [-100,+100].
  - Fallback deterministico (`seedrandom("axes_v2:" + keyword)`), nessun I/O dinamico.

## Step 2 — Base position (Alfa/Beta → pixel)
- Funzioni: `axesToNormalizedPosition`, `normalizedToPixel` (`lib/engine_v2/position.ts`).
- Formule:
  ```ts
  const xNorm = clamp01(0.5 + alfa / 200);
  const yNorm = clamp01(0.5 - beta / 200);
  const start = {
    x: xNorm * canvasWidth,
    y: yNorm * canvasHeight,
  };
  ```
- Ogni keyword genera un anchor point in pixel space, registrato nel debug overlay.

## Step 3 — Point dispersion (patch02)
- Funzioni: `generateDispersedStartPoint` (`lib/engine_v2/curves.ts:245-325`).
- Prima linea per keyword usa l'anchor esatto. Le successive vengono disperse deterministicamente:
  ```ts
  radius = 0.02 * diagonal;
  angle = rng() * 2π;
  distance = sqrt(rng()) * radius;
  dispersed = clampToCanvas(anchor + polar(angle, distance));
  ```
- Seed prefix: `"disperse:" + pointIndex + ":" + lineIndex`.

## Step 4 — Direction clustering (patch03)
- Funzione: `getLineDirection` (`lib/engine_v2/curves.ts:60-150`).
- Parametri UI → `clusterCount` (2–5) e `clusterSpread` (10°–60°) da Slider3/4.
- Algoritmo:
  1. `clusterIndex = floor(seededRandom(`${seed}:cluster:${lineIndex}`) * clusterCount)`.
  2. `clusterAngle = (clusterIndex / clusterCount) * 180` (distribuzione uniforme 0°-180°).
  3. `gammaRotation = (gamma / 100) * 180` ruota tutti i cluster.
  4. `jitter = (seededRandom(`${seed}:jitter:${lineIndex}`) - 0.5) * clusterSpread`.
  5. `finalAngle = clampAngle(clusterAngle + gammaRotation + jitter)`.
- Debug overlay visualizza i centri cluster prima/dopo la rotazione e l'area di dispersione.

## Step 5 — Length profiles (patch04)
- Funzioni: `computeLengthProfileMultiplier`, `getLineLength` (`lib/engine_v2/curves.ts:200-275`, `520-590`).
- Gamma produce il range base (15%–50% della diagonale). La lunghezza finale è:
  ```ts
  baseLength = getLineLength(gamma, canvasWidth, canvasHeight);
  lengthProfile = pick([0.5, 0.8, 1.0, 1.3, 1.8], `${seed}:lenProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`);
  profiledLength = baseLength * lengthProfile * lengthScale;
  ```
- Slider1 (`lengthScale`) resta un moltiplicatore globale.

## Step 6 — Curvature profiles (patch04)
- Funzioni: `computeCurvatureProfileMultiplier`, `applyDeltaIrregularity` (`lib/engine_v2/curves.ts:300-420`, `560-650`).
- Delta continua a determinare direzione e magnitudine di curvatura; viene applicato un profilo discreto:
  ```ts
  curvatureProfile = pick([0.4, 0.75, 1.0, 1.5, 2.0], `${seed}:curvProfile:${pointIndex}:${lineIndex}:${clusterIndex}:${clusterCount}`);
  effectiveCurvature = baseCurvature * curvatureProfile * curvatureScale;
  ```
- Profili di lunghezza e curvatura hanno correlazione inversa soft per mantenere equilibrio visivo (linee corte più curve, lunghe più dritte).

## Step 7 — Final mirroring (patch01)
- Funzione: `applyFinalMirroring` (`lib/engine_v2/finalMirroring.ts`).
- Passaggi:
  1. Calcolo del bounding box pre-mirroring.
  2. Scelta asse:
     - `width > height` → asse verticale (mirror orizzontale)
     - `height > width` → asse orizzontale (mirror verticale)
     - quasi quadrato → diagonale principale.
  3. L'asse è sempre centrato sul canvas (`canvasWidth / 2`, `canvasHeight / 2`).
  4. Ogni curva viene riflessa e aggiunta alle originali.
- Seed serve solo per mantenere determinismo dell'ordinamento, non introduce random extra.

## Step 8 — Branching_beta01
- Funzione: `applyBranching` (`lib/engine_v2/branching.ts`).
- Rilevamento intersezioni:
  - Ogni curve viene campionata con 12 punti (inclusi `t=0` e `t=1`).
  - Segmenti delle polilinee vengono confrontati con `segmentIntersection`.
  - Intersezioni vicine vengono collegate arrotondando a 1px.
  - Filtraggio per gruppi con ≥2 connessioni, shuffle deterministico ed hard cap 30.
- Generazione rami:
  - Per intersezione si creano 1–2 rami.
  - Lunghezza: `diag * (0.06 + rng * 0.06)`.
  - Offset angolare ±60° e curvatura opzionale `(rng - 0.5) * 0.7`.
  - Tratteggio: `seededRandom(`${seed}:branching:dashed:${intersectionIndex}:${branchIndex}`) < 0.35`.
  - Output `generationDepth = 1`, `generatedFrom = intersectionIndex` per permettere ordinamento e debug.

## Output finale
```ts
type BranchedConnection = {
  from: Vec2;
  to: Vec2;
  control?: Vec2;
  curved: boolean;
  curvature?: number;
  generationDepth: 0 | 1;
  dashed?: boolean;
  debug?: DirectionClusterDebug;
};
```
- Le connessioni primarie (linee keyword) hanno `generationDepth = 0`; i rami 1.
- Il renderer React/SVG utilizza l'ordine per disegnare prima la geometria principale, poi le ramificazioni.
- Tutte le trasformazioni rispettano i bound del canvas via `clampToCanvas`.

Per modifiche alla pipeline usare `docs/development/guides/PIPELINE_MODIFICATION_PLAYBOOK.md` e aggiornare sempre `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md` + changelog.
