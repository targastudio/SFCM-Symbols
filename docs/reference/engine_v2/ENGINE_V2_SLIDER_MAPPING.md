# ENGINE V2 — Slider Mapping

Riferimento operativo per i controlli UI descritti in SPEC_04 (Step 4-6).

## 1. Slider attivi

### Slider1: "Lunghezza linee"
- **UI label**: "Lunghezza linee"
- **UI range**: 0–100 (integer)
- **Default value**: 50 (center position)
- **Parametro ENGINE_V2**: `lengthScale` (in `EngineV2Options`)
- **Mapping formula**: `lengthScale = 0.7 + (slider / 100) * (1.3 - 0.7)`
  - `slider = 0`   → `lengthScale = 0.7`   (linee più corte)
  - `slider = 50`  → `lengthScale = 1.0`   (comportamento baseline)
  - `slider = 100` → `lengthScale = 1.3`   (linee più lunghe)
- **Effetto**: 
  - Scala la lunghezza base delle linee determinata da Gamma (che imposta la lunghezza base nel range 15%–50% della diagonale del canvas).
  - Non influisce sul numero di linee (ancora determinato da Gamma).
  - Non influisce sulla curvatura (Delta).
- **Stato**: ✅ **Implementato e attivo**

### Slider2: "Curvatura linee"
- **UI label**: "Curvatura linee"
- **UI range**: 0–100 (integer)
- **Default value**: 50 (center position)
- **Parametro ENGINE_V2**: `curvatureScale` (in `EngineV2Options`)
- **Mapping formula**: `curvatureScale = 0.3 + (slider / 100) * (1.7 - 0.3)`
  - `slider = 0`   → `curvatureScale = 0.3`   (curve meno marcate)
  - `slider = 50`  → `curvatureScale = 1.0`   (comportamento baseline)
  - `slider = 100` → `curvatureScale = 1.7`   (curve molto marcate)
- **Effetto**: 
  - Scala l'intensità della curvatura determinata da Delta.
  - Modifica il punto di controllo delle curve quadratiche.
  - Non influisce sul numero di linee (Gamma) o sulla lunghezza (Slider1).
- **Stato**: ✅ **Implementato e attivo**

### Slider3: "Numero Cluster" (patch03)
- **UI label**: "Numero Cluster"
- **UI range**: 0–100 (integer)
- **Default value**: 33 (corrisponde a clusterCount = 3)
- **Parametro ENGINE_V2**: `clusterCount` (in `EngineV2Options`)
- **Mapping formula**: `clusterCount = Math.round(2 + (slider / 100) * 3)`
  - `slider = 0`   → `clusterCount = 2`   (2 cluster)
  - `slider = 33`  → `clusterCount = 3`   (3 cluster, default)
  - `slider = 100` → `clusterCount = 5`   (5 cluster)
- **Effetto**: 
  - Controlla il numero di cluster di direzioni in cui vengono raggruppate le linee.
  - Più cluster = più varietà di direzioni.
  - Meno cluster = direzioni più raggruppate.
  - I cluster sono distribuiti uniformemente su 0–180°.
- **Stato**: ✅ **Implementato e attivo** (patch03)

### Slider4: "Ampiezza Cluster" (patch03)
- **UI label**: "Ampiezza Cluster"
- **UI range**: 0–100 (integer)
- **Default value**: 40 (corrisponde a clusterSpread = 30°)
- **Parametro ENGINE_V2**: `clusterSpread` (in `EngineV2Options`)
- **Mapping formula**: `clusterSpread = 10 + (slider / 100) * 50` (in gradi)
  - `slider = 0`   → `clusterSpread = 10°`  (cluster stretti)
  - `slider = 40`  → `clusterSpread = 30°`  (default)
  - `slider = 100` → `clusterSpread = 60°`  (cluster ampi)
- **Effetto**: 
  - Controlla l'ampiezza del jitter dentro ogni cluster.
  - Valore basso = linee in cluster hanno direzioni molto simili.
  - Valore alto = più variazione dentro ogni cluster.
  - Non influisce sul numero di cluster (Slider3) o sulla rotazione Gamma.
- **Stato**: ✅ **Implementato e attivo** (patch03)

## 2. Slider placeholder (non ancora collegati)

Gli slider seguenti sono mantenuti nell'interfaccia ma non hanno ancora logica attiva:

- **Complessità**: placeholder, nessun effetto sulla generazione
- **Mutamento**: placeholder, nessun effetto sulla generazione

La nuova logica per questi slider sarà definita in futuro secondo le specifiche ENGINE_V2.
