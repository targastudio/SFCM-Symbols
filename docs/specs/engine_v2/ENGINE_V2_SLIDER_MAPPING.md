# ENGINE V2 — Slider Mapping

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

## 2. Slider placeholder (non ancora collegati)

Gli slider seguenti sono mantenuti nell'interfaccia ma non hanno ancora logica attiva:

- **Complessità**: placeholder, nessun effetto sulla generazione
- **Mutamento**: placeholder, nessun effetto sulla generazione

La nuova logica per questi slider sarà definita in futuro secondo le specifiche ENGINE_V2.

