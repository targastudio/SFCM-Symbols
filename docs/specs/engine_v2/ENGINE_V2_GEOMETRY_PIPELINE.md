# ENGINE V2 — Geometry Pipeline

Pipeline completa per la generazione geometrica dei simboli SFCM.

Questa versione incorpora **patch01_SPEC_03_mirroring_revision**: il mirroring viene applicato **sulla geometria finale**, come ultimo step prima del rendering.

## 1. Keyword → Assi

Ogni keyword produce quattro valori:
- Alfa ∈ [−100, +100]
- Beta ∈ [−100, +100]
- Gamma ∈ [−100, +100]
- Delta ∈ [−100, +100]

La conversione keyword → assi è deterministica (stesso input → stessi valori).

## 2. Coordinate normalizzate (Alfa, Beta)

A partire da Alfa/Beta ricaviamo una posizione primaria nel canvas normalizzato [0,1]:

```ts
const xNorm = 0.5 + (alfa / 200);
const yNorm = 0.5 - (beta / 200);

const xPx = xNorm * canvasWidth;
const yPx = yNorm * canvasHeight;
```

Questa coppia definisce il **punto di ancoraggio** del sistema di linee.

## 3. Generazione linee base (Gamma)

Gamma controlla la struttura di base:

- numero di linee base (1–7)
  - Formula: `t = Math.min(1, Math.abs(gamma) / 100)`
  - Formula: `lineCount = 1 + Math.round(t * 6)`
  - Gamma ≈ 0    → 1 linea
  - Gamma ≈ ±50  → 4 linee
  - Gamma ≈ ±100 → 7 linee
- direzione principale (diagonale rispetto al centro)  
- lunghezza base: 15%–50% della diagonale del canvas
  - Formula: `t = Math.min(1, Math.abs(gamma) / 100)`
  - Formula: `frac = 0.15 + t * (0.50 - 0.15)` (in [0.15, 0.50])
  - Formula: `baseLength = frac * diag` dove `diag = sqrt(canvasWidth² + canvasHeight²)`
  - Gamma ≈ 0    → 15% della diagonale
  - Gamma ≈ ±100 → 50% della diagonale
  - **Nota importante**: Tutte le lunghezze finali delle linee sono calcolate attraverso lo stesso pipeline (Gamma + range base + lengthScale), anche quando la keyword non è presente nel dizionario semantico. La generazione fallback/seed-based produce comunque assi (incluso Gamma), e la stessa computazione della lunghezza affetta da `lengthScale` viene applicata. Questo garantisce che Slider1 ("Lunghezza linee") influenzi tutte le linee generate, indipendentemente dal fatto che la keyword sia nota o sconosciuta.

Output di questo step: un array di connections **senza curvatura definitiva**:

```ts
type ConnectionBase = {
  from: Vec2;      // punto di partenza
  to: Vec2;        // punto di arrivo
};
```

Le coordinate sono espresse nello spazio canvas normalizzato.

## 4. Irregolarità e curvatura (Delta)

Delta controlla la curvatura delle linee in modo deterministico:

- **Magnitudine della curvatura**: 5% a 30% della lunghezza della linea (via |Delta|)
  - Formula: `d = Math.min(1, Math.abs(delta) / 100)`
  - Formula: `curvFrac = 0.05 + d * (0.30 - 0.05)` (in [0.05, 0.30])
  - Formula: `offsetMag = curvFrac * lineLength`
  - Delta ≈ 0    → curvatura ~5% (linee quasi dritte)
  - Delta ≈ ±100 → curvatura ~30% (linee chiaramente curve)
- **Direzione della curvatura**: perpendicolare al segmento, determinata dal segno di Delta e jitter deterministico
- **Jitter deterministico**: variazione ±20% sulla magnitudine della curvatura, basata sul seed

Output: array di curve quadratiche pronte per il rendering (prima del mirroring finale):

```ts
type Connection = {
  from: Vec2;
  to: Vec2;
  control?: Vec2; // opzionale, per curve quadratiche
};
```

## 5. Mirroring finale della geometria (patch01)

Questo step implementa la patch di mirroring.

- **Input:** array di `Connection` dopo Gamma/Delta  
- **Operazioni:**  

  1. Calcolo del **bounding box** di tutti i punti (`from`, `to`, eventuali `control`).  
  2. Scelta deterministica dell’**orientamento dell’asse di simmetria** (il bbox è usato SOLO per questa decisione):
     - se `width > height` → asse verticale
     - se `height > width` → asse orizzontale
     - se `width ≈ height` → asse diagonale  
  3. Posizionamento dell’asse: l’asse di simmetria è **sempre centrato sul canvas**, non sul bbox:
     - asse verticale: `x = canvasWidth / 2`
     - asse orizzontale: `y = canvasHeight / 2`
     - asse diagonale: diagonale principale del canvas (top-left → bottom-right) passante per il centro del canvas
  4. Generazione di una copia specchiata per ogni `Connection`, riflettendo `from`, `to` e `control` rispetto all’asse centrato sul canvas.  
  5. Merge di originali + specchiate in un unico array.

- Il mirroring è:
  - **post-processing geometrico** (non modifica i dati di input)  
  - **deterministico** (stesso seed → stesso output)  
  - completamente interno all’ENGINE_V2.

## 6. Output finale

La pipeline produce un array di curve quadratiche:

```ts
type EngineV2Output = {
  connections: Connection[];
};
```

- Nessun cluster  
- Arrowhead fissa per tutte le linee  
- Output compatibile con il renderer esistente (React/SVG).
