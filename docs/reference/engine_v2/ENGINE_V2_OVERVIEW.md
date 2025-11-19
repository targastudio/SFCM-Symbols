# ENGINE V2 — Overview (SPEC_04 aligned)

Sintesi operativa dello stato corrente del motore ENGINE_V2 come definito da `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`.

## 1. Pilastri architetturali
- **4 assi semantici** (Alfa, Beta, Gamma, Delta) – sempre in [-100, +100] e normalizzati deterministici (`lib/engine_v2/axes.ts`).
- **Pipeline a otto step** – keyword → assi → posizione → dispersione → clustering → profili → mirroring → branching (`lib/engine_v2/engine.ts`).
- **Determinismo totale** – tutti i PRNG derivano da `generateSeed(keywords, canvasSize)` e usano prefissi espliciti (`lib/seed.ts`).
- **Compatibilità UI** – slider e controlli sono documentati in `ENGINE_V2_SLIDER_MAPPING.md` e sono l'unico modo per modificare la pipeline da interfaccia.

## 2. Assi semantici
### 2.1 Alfa — Azione ↔ Osservazione
Range [-100, +100]; controlla la coordinata X normalizzata (`xNorm = 0.5 + (Alfa / 200)`).

### 2.2 Beta — Specifico ↔ Ampio
Range [-100, +100]; controlla la coordinata Y normalizzata (`yNorm = 0.5 - (Beta / 200)`).

### 2.3 Gamma — Unico ↔ Composto
Determina numero linee (1–7), rotazione globale dei cluster e lunghezza base (15%–50% della diagonale).

### 2.4 Delta — Regolare ↔ Irregolare
Definisce curvatura e jitter deterministico dei control point (offset 5%–30% della lunghezza con jitter ±20%).

## 3. SPEC_04 Geometry Pipeline
1. **Step 1 – Keyword → Axes**: `getAxesForKeywordV2` normalizza parole chiave, consulta `semantic-map-v2.json` e usa fallback deterministico quando necessario.
2. **Step 2 – Base position**: `axesToNormalizedPosition` + `normalizedToPixel` convertono Alfa/Beta in coordinate pixel rispettando qualsiasi canvas (`lib/engine_v2/position.ts`).
3. **Step 3 – Point dispersion (patch02)**: `generateDispersedStartPoint` genera start point unici (2% diagonale) mantenendo la prima linea sull'anchor semantico.
4. **Step 4 – Direction clustering (patch03)**: `getLineDirection` assegna cluster discreti (2–5) distribuiti su 0°-180°, applica rotazione Gamma e jitter deterministico controllato da `clusterSpread`.
5. **Step 5 – Length profiles (patch04)**: `computeLengthProfileMultiplier` seleziona profili discreti (0.5×–1.8×) per ogni linea combinando Gamma, slider `lengthScale` e cluster metadata.
6. **Step 6 – Curvature profiles (patch04)**: `computeCurvatureProfileMultiplier` applica moltiplicatori discreti (0.4×–2×) con correlazione inversa alla lunghezza; `curvatureScale` resta un fattore globale.
7. **Step 7 – Final mirroring (patch01)**: `applyFinalMirroring` calcola il bbox pre-mirroring, sceglie asse verticale/orizzontale/diagonale centrato sul canvas e riflette tutte le curve prima dell'output.
8. **Step 8 – Branching_beta01**: `applyBranching` rileva intersezioni post-mirroring (12 sample Bézier), seleziona deterministicamente max 30 cluster di intersezioni e genera 1–2 rami per ciascuna con lunghezze 6%–12% della diagonale.

Output finale: `BranchedConnection[]` con `generationDepth` (0 = linee primarie, 1 = rami) consumato da preview/export.

## 4. Engine options e controlli UI
- **EngineV2Options** (`lib/engine_v2/engine.ts:32-90`): `lengthScale`, `curvatureScale`, `clusterCount`, `clusterSpread`, `includeDebug` e dimensioni canvas sono gli unici ingressi dinamici oltre a keyword/seed.
- **Slider mapping** (`docs/reference/engine_v2/ENGINE_V2_SLIDER_MAPPING.md`):
  - Slider1 → `lengthScale` (0.7–1.3)
  - Slider2 → `curvatureScale` (0.3–1.7)
  - Slider3 → `clusterCount` (2–5)
  - Slider4 → `clusterSpread` (10°–60°)
- **Canvas selector** (`feature1_canvas_size.md`): controlla `canvasWidth/canvasHeight` e influisce su diagonale, clamp e branching.

## 5. Debug & documentazione correlata
- `components/DebugOverlay.tsx` visualizza anchor, bbox, asse di mirroring, cluster direzionali e profili patch04 quando `includeDebug` è true.
- `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` fornisce la descrizione dettagliata step-by-step (formula + pseudo-code) allineata a SPEC_04.
- `docs/reference/features/feature_branching_beta01.md` e `docs/overview/cluster-generation.md` approfondiscono Step 4 e Step 8.

Per modifiche strutturali, attenersi a `docs/development/guides/PIPELINE_MODIFICATION_PLAYBOOK.md` e registrare sempre gli aggiornamenti in `docs/changes/CHANGELOG_SFCM_SYMBOLS.md` prima di toccare `SPEC_04`.
