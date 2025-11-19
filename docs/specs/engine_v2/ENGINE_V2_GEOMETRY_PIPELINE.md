# ENGINE V2 — Geometry Pipeline

Pipeline completa per la generazione geometrica dei simboli SFCM.

Questa versione incorpora:
- **patch01_SPEC_03_mirroring_revision**: il mirroring viene applicato **sulla geometria finale**, come ultimo step prima del rendering.
- **patch_02_Point_Dispersion_at_Line_Origin**: dispersione deterministica dei punti di origine delle linee per creare un effetto visivo più organico.

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

Questa coppia definisce il **punto di ancoraggio base** del sistema di linee.

**Nota (patch02)**: Ogni linea generata da una keyword parte da un punto leggermente diverso, disperso deterministicamente attorno al punto di ancoraggio base. Questo crea un effetto visivo più organico rispetto al pattern "a stella" dove tutte le linee partono dallo stesso punto.

## 3. Dispersione punti origine (patch02)

Prima di generare le linee, i punti di origine sono gestiti come segue:

- **Prima linea (index 0)**: usa esattamente il punto di ancoraggio base (Alfa/Beta → canvas coordinates)
  - Nessuna dispersione applicata
  - Corrisponde visivamente all'anchor point nel debug overlay
  - Mantiene la connessione semantica tra assi e geometria

- **Linee successive (index > 0)**: punti dispersi deterministicamente attorno al punto base
  - **Raggio di dispersione**: 2% della diagonale del canvas (default, configurabile 1–4%)
  - **Distribuzione**: uniforme nell'area del cerchio (non uniforme nel raggio)
  - **Determinismo**: stesso seed + stesso pointIndex + stesso lineIndex → stesso punto disperso
  - **Formula**: 
    - `diagonal = sqrt(canvasWidth² + canvasHeight²)`
    - `radius = diagonal * 0.02`
    - `angle = rng() * 2π` (PRNG deterministico)
    - `distance = sqrt(rng()) * radius` (uniforme in area cerchio)
    - `dispersedPoint = basePoint + (cos(angle), sin(angle)) * distance`

Questo garantisce che:

- La prima linea mantiene la corrispondenza esatta con il punto semantico (Alfa/Beta)

- Le linee successive creano un cluster organico invece di un pattern radiale

- L'anchor point nel debug overlay corrisponde all'origine della prima linea

## 4. Generazione linee base (Gamma)

Gamma controlla la struttura di base:

- numero di linee base (1–7)
  - Formula: `t = Math.min(1, Math.abs(gamma) / 100)`
  - Formula: `lineCount = 1 + Math.round(t * 6)`
  - Gamma ≈ 0    → 1 linea
  - Gamma ≈ ±50  → 4 linee
  - Gamma ≈ ±100 → 7 linee

- **direzione con clustering** (patch03):
  - **Range angoli**: 0°–180° (patch03: cambiato da -45°/+45°)
  - **Clustering**: Le linee si raggruppano in cluster di direzioni simili
    - Numero di cluster: configurabile via slider (default: 3, range: 2–5)
    - Cluster distribuiti uniformemente su 0–180°: `clusterAngle = (clusterIndex / clusterCount) * 180`
    - Assegnazione cluster: deterministica basata su `seed` e `lineIndex`
  - **Rotazione Gamma**: Gamma ruota tutti i cluster insieme
    - Formula: `gammaRotation = (gamma / 100) * 180`
    - Gamma = -100 → rotazione = 0° (cluster in posizione originale)
    - Gamma = 0 → rotazione = 90°
    - Gamma = +100 → rotazione = 180°
  - **Jitter dentro cluster**: Variazione deterministica dentro ogni cluster
    - Ampiezza jitter: configurabile via slider (default: 30°, range: 10–60°)
    - Formula: `jitter = (seededRandom(seed:jitter:lineIndex) - 0.5) * clusterSpread`
  - **Angolo finale**: `(clusterAngle + gammaRotation + jitter) % 180`, clampato a [0, 180]

- lunghezza base: 15%–50% della diagonale del canvas
  - Formula: `t = Math.min(1, Math.abs(gamma) / 100)`
  - Formula: `frac = 0.15 + t * (0.50 - 0.15)` (in [0.15, 0.50])
  - Formula: `baseLength = frac * diag` dove `diag = sqrt(canvasWidth² + canvasHeight²)`
  - Gamma ≈ 0    → 15% della diagonale
  - Gamma ≈ ±100 → 50% della diagonale
  - **Profili di lunghezza (patch04)**:
    - Per ogni linea viene selezionato un moltiplicatore di profilo da un set discreto (es. `[0.5, 0.8, 1.0, 1.3, 1.8]` → molto corta / corta / media / lunga / molto lunga, con differenze più marcate).
    - La selezione è deterministica e dipende da `seed`, `pointIndex`, `lineIndex`, `clusterIndex` e `clusterCount`.
    - La lunghezza effettiva di ogni linea diventa `profiledLength = baseLength * lengthProfile`.
  - **Nota importante**: Tutte le lunghezze finali delle linee sono calcolate attraverso lo stesso pipeline (Gamma + range base + `lengthScale` + profilo di lunghezza), anche quando la keyword non è presente nel dizionario semantico. La generazione fallback/seed-based produce comunque assi (incluso Gamma), e la stessa computazione della lunghezza affetta da `lengthScale` e dai profili viene applicata. Questo garantisce che Slider1 ("Lunghezza linee") influenzi tutte le linee generate, indipendentemente dal fatto che la keyword sia nota o sconosciuta, mantenendo le differenze relative introdotte dai profili.

Output di questo step: un array di connections **senza curvatura definitiva**:

```ts
type ConnectionBase = {
  from: Vec2;      // punto di partenza
  to: Vec2;        // punto di arrivo
};
```

Le coordinate sono espresse nello spazio canvas normalizzato.

## 5. Irregolarità e curvatura (Delta)

Delta controlla la curvatura delle linee in modo deterministico:

- **Magnitudine della curvatura**: 5% a 30% della lunghezza della linea (via |Delta|)
  - Formula: `d = Math.min(1, Math.abs(delta) / 100)`
  - Formula: `curvFrac = 0.05 + d * (0.30 - 0.05)` (in [0.05, 0.30])
  - Formula: `offsetMag = curvFrac * lineLength`
  - Delta ≈ 0    → curvatura ~5% (linee quasi dritte)
  - Delta ≈ ±100 → curvatura ~30% (linee chiaramente curve)
  - **Profili di curvatura (patch04)**:
  - Per ogni linea viene selezionato un moltiplicatore di profilo da un set discreto (es. `[0.4, 0.75, 1.0, 1.5, 2.0]` → molto bassa / bassa / media / alta / molto alta, con differenze più marcate).
  - La selezione è deterministica e dipende da `seed`, `pointIndex`, `lineIndex`, `clusterIndex` e `clusterCount`.
  - Il profilo viene applicato come moltiplicatore a `curvatureScale` (Slider2), mantenendo invariata la semantica globale dello slider: `effectiveCurvatureScale = curvatureScale * curvatureProfile`.
  - È applicata una **correlazione inversa più marcata** tra lunghezza e curvatura: linee più corte tendono ad avere curvatura sensibilmente più alta, linee più lunghe curvatura sensibilmente più bassa.
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

## 6. Mirroring finale della geometria (patch01)

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

## 7. Branching dalle intersezioni (Branching_beta01)

Step finale applicato **dopo** il mirroring.

- **Input:** array di `Connection` già specchiati.
- **Rilevamento intersezioni:**
  - Approssima ogni curva quadratica con 12 campioni uniformi (`t = 0..1`).
  - Confronta tutti i segmenti delle polilinee campionate usando `segmentIntersection` (t/u ∈ [0, 1]).
  - Raggruppa intersezioni vicine arrotondando le coordinate a 1px.
  - Tiene solo i gruppi con almeno 2 connessioni.
- **Generazione rami:**
  - Considera al massimo 30 intersezioni per contenere il numero di nuove linee.
  - Le intersezioni vengono **mescolate in modo deterministico** prima di essere selezionate, per distribuire i rami su tutte le regioni generate e non solo sulle prime connessioni.
  - Per ogni intersezione crea 1–2 rami deterministici:
    - Direzione base = media normalizzata dei vettori delle connessioni incidenti (fallback (1,0)).
    - Lunghezza = `diag * (0.06 + r * 0.06)` dove `diag = sqrt(w² + h²)` e `r` deriva dal seed.
    - Offset angolare deterministico ±60°.
    - Curvatura opzionale: `(rng - 0.5) * 0.7`, considerata curva se |curvature| > 0.08.
    - Tratteggio deterministico con probabilità 35%.
    - Punto finale clampato al canvas, `generationDepth = 1`, `generatedFrom = index intersezione`.
- **Determinismo:** tutte le sorgenti aleatorie usano `seededRandom` con prefissi espliciti (`branching:count:length:angle:curvature:dashed`).
- **Compatibilità:** lunghezze basate sulla diagonale assicurano proporzionalità su qualunque formato di canvas.

## 8. Output finale

La pipeline produce un array di curve quadratiche:

```ts
type EngineV2Output = {
  connections: Connection[];
};
```

- Nessun cluster  
- Arrowhead fissa per tutte le linee  
- Output compatibile con il renderer esistente (React/SVG).
