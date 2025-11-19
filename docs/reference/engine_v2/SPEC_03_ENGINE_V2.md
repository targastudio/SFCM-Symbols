# SPEC_03 — ENGINE V2 (4 Assi) — SFCM Symbol Generator

> **Legacy notice**: SPEC_04 (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`) sostituisce integralmente questo documento. Manteniamo SPEC_03 per storico e confronto.

## Stato del documento
Questo documento definisce **la nuova architettura del motore di generazione** (ENGINE_V2) basata su 4 assi semantici:

- **Alfa** — Azione ↔ Osservazione  
- **Beta** — Specifico ↔ Ampio  
- **Gamma** — Unico ↔ Composto  
- **Delta** — Regolare ↔ Irregolare  

Questa SPEC sostituisce esclusivamente la logica del **motore di generazione**, lasciando invariati:

- UI  
- preview React + SVG  
- animazione  
- export  
- struttura progetto  
- determinismo  

Tutto ciò che riguarda l’engine della versione precedente (6 assi, cluster ecc.) viene sostituito da ENGINE_V2.

---

# 1. Relazione con SPEC_02

La **SPEC_02_GITHUB.md** descrive l’intera architettura della versione precedente, composta da:

- engine semantico 6 assi  
- cluster  
- connessioni MST + extra  
- ramificazioni  
- curvatura e tratteggio  
- rendering SVG + animazione  
- export vettoriale  
- UI + slider  
- stack completo

Con ENGINE_V2:

### Cosa rimane valido di SPEC_02
- UI, struttura dei componenti, layout e tema  
- Canvas 1080×1080 come base concettuale  
- Determinismo globale  
- Animazione integrata nel rendering  
- Export SVG conforme alla preview  
- Arrowheads fissi (3px stroke, 14×19px)  
- Gestione canvas size (feature 6.1)  
- Stack: Next.js + React + TS  
- Struttura file  
- Niente testo nel canvas  
- Estetica bianco/nero  

### Cosa viene sostituito
- **Fase 2–4 della SPEC_02** (generazione geometrica, cluster, MST, ramificazioni)  
  → completamente rimpiazzate dal nuovo ENGINE_V2.

La semantica resta basata su keyword e un dizionario, ma ora produce valori per **4 assi**, non 6.

SPEC_02 rimane come riferimento storico e NON va modificata.

---

# 2. Documenti ENGINE_V2

La nuova architettura del motore è distribuita in 4 documenti:

### 2.1 `ENGINE_V2_OVERVVIEW.md`
Contesto generale:  
- perché 4 assi  
- caratteristiche dei nuovi assi (alfa, beta, gamma, delta)  
- eliminazione dei cluster  
- determinismo  
- struttura concettuale del nuovo engine  

### 2.2 `ENGINE_V2_GEOMETRY_PIPELINE.md`
Pipeline completa dell’ENGINE_V2:  
- mapping keyword → assi  
- mapping assi → coordinate  
- Alfa/Beta = posizionamento  
- Gamma = numero, lunghezza e direzione delle linee (distanza diagonale dal centro)  
- Delta = irregolarità / jitter (curvatura, offset, deformazione)  
- Generazione di un set di **connections di base** (curve quadratiche) a partire da Alfa/Beta/Gamma/Delta  
- Applicazione del **mirroring finale sulla geometria** (patch01_SPEC_03_mirroring_revision) sull’elenco di connections generato  
- Il mirroring avviene **dopo** Gamma/Delta e non modifica i dati di input  
- Output: elenco di curve quadratiche con arrowhead

### 2.3 `ENGINE_V2_SLIDER_MAPPING.md`
Contiene:  
- istruzioni su cosa fare con gli slider esistenti  
- indicazione che vanno mantenuti nella UI  
- logica interna rimossa completamente  
- nuovi slider ancora da definire in futuro  
- placeholder **legittimo** perché la logica NON è ancora progettata

### 2.4 `ENGINE_V2_MIGRATION_GUIDE.md`
Guida per Cursor:  
- come migrare senza modificare UI/preview/export  
- come isolare la vecchia geometry.ts  
- come implementare il nuovo engine in un file separato  
- cosa cancellare (solo engine vecchio) e cosa NON toccare  
- priorità: nessuna regressione a preview, animazione, export  

---

# 3. Requisiti ereditati da SPEC_02 (ancora validi)

Seguono i requisiti che restano invariati nella versione ENGINE_V2:

### 3.1 Input
- Lista di keyword (max 10)  
- Dizionario locale (`semantic-map.json`)  
- Fallback deterministico se la parola non è presente

### 3.2 Determinismo
Stesso input → stesso output.  
Il seed resta basato su:

```
hash(keywords_normalizzate + valori_assi + slider + canvasSize)
```

### 3.3 Vincoli visivi
- Sfondo nero (#000)  
- Linee e frecce bianche (#fff)  
- Arrowheads = triangolo (14×19 px), solo fill bianco  
- Canvas 1080×1080 come base, esteso con feature 6.1  
- Niente testo nel canvas  
- UI Times New Roman  
- Stile coerente con estetica SFCM  

### 3.4 Export
- SVG identico alla preview  
- Arrowhead fisso  
- Compatibile con Illustrator, Figma, browser  
- Nessuna perdita o conversione di stile  
- Canvas scalato correttamente per preset 1:1, 4:5, 9:16, 16:9, fit, custom  

### 3.5 Animazione
- Presenta line drawing deterministico  
- Disattivabile  
- Non viene modificata nella migrazione ENGINE_V2  

### 3.6 Stack
- Next.js App Router  
- React  
- TypeScript  
- seedrandom  
- Nessuna dipendenza da p5.js  

---

# 4. ENGINE V2 — Specifica principale (riassunto)

Il nuovo motore si basa sul seguente modello:

---

## 4.1 Assi semantici

### ALFA — Azione ↔ Osservazione  
Determina **X normalized**:

```
Alpha ∈ [-100, +100]
xNorm = 0.5 + (Alpha / 200)
```

### BETA — Specifico ↔ Ampio  
Determina **Y normalized**:

```
Beta ∈ [-100, +100]
yNorm = 0.5 - (Beta / 200)
```

### GAMMA — Unico ↔ Composto  
Controlla:

- numero di linee generate dal punto (min 1, max 7)
  - Gamma ≈ 0    → 1 linea
  - Gamma ≈ ±50  → 4 linee
  - Gamma ≈ ±100 → 7 linee
- lunghezza base delle linee: 15% a 50% della diagonale del canvas (via |Gamma|)
  - Gamma ≈ 0    → 15% della diagonale
  - Gamma ≈ ±100 → 50% della diagonale
- direzione base delle linee (orientamento diagonale misurato dal centro)

Nota: 
- Gamma imposta la lunghezza base nel range 15%-50% della diagonale.
- Slider1 ("Lunghezza linee") scala questa lunghezza base tramite `lengthScale` (0.7-1.3).
- Delta controlla la curvatura delle linee, non la lunghezza.

### DELTA — Regolare ↔ Irregolare  
Controlla:

- curvatura della linea (curva quadratica con 1 punto di controllo)
  - Magnitudine della curvatura: 5% a 30% della lunghezza della linea (via |Delta|)
  - Delta ≈ 0    → curvatura ~5% (linee quasi dritte)
  - Delta ≈ ±100 → curvatura ~30% (linee chiaramente curve)
- jitter direzionale deterministico basato sul seed
- variazioni casuali ma deterministiche basate sul seed

---

## 4.2 Pipeline ENGINE_V2

Ordinata e completa:

### Step 1 — Keyword → 4 Assi
- dizionario  
- fallback deterministico  
- output: valori ∈ [-100,+100] per alfa/beta/gamma/delta

### Step 2 — Alfa/Beta → Coordinate normalizzate
```ts
const xNorm = 0.5 + (alfa / 200);
const yNorm = 0.5 - (beta / 200);

const xPx = xNorm * canvasWidth;
const yPx = yNorm * canvasHeight;
```

### Step 3 — Applicazione Gamma (linee base)
- definisce numero linee ∈ {1,2,3}  
- definisce direzione principale delle linee  
- definisce lunghezza normale/diagonale rispetto al centro  
- produce un primo set di segmenti/curve attorno alla posizione primaria

### Step 4 — Applicazione Delta (irregolarità locale)
- definisce curvatura  
- definisce jitter deterministico  
- definisce micro-variazioni del controllo  

### Step 5 — Mirroring finale della geometria (patch01)
Input: insieme di connections dopo Gamma/Delta.

- calcolo del bounding box da tutti i punti (`from`, `to`, eventuali control point)  
- determinazione deterministica dell’asse di simmetria:
  - se width > height → asse verticale (x = centro)  
  - se height > width → asse orizzontale (y = centro)  
  - se width ≈ height → asse diagonale (da top-left a bottom-right nello spazio normalizzato)  
- generazione di una copia specchiata per ogni connection riflettendo `from`, `to` e control point rispetto all’asse scelto  
- merge di originali + copie specchiate in un unico array di output  

Il mirroring è un **post-processing** puramente geometrico:
- non modifica alfa/beta/gamma/delta  
- non altera seed o determinismo (stesso input → stesso output)  
- è interamente definito all’interno dell’ENGINE_V2.

### Step 6 — Output finale
- sempre curve quadratiche  
- con arrowhead fissa  
- nessuna polilinea  
- nessun cluster  
- output compatibile con rendering attuale

---

# 5. Slider

Gli slider esistenti:

- densità  
- ramificazione  
- complessità  
- mutamento  

vanno mantenuti come UI ma **tutta la logica deve essere rimossa**.  
Questo è specificato in `ENGINE_V2_SLIDER_MAPPING.md`.

Nuovi slider verranno definiti **solo dopo** che ENGINE_V2 funziona.

---

# 6. Migrazione (overview)

La guida tecnica completa è in `ENGINE_V2_MIGRATION_GUIDE.md`.

Principi fondamentali:

- Non toccare preview, animazione, export  
- Sostituire solo la pipeline di generazione  
- Codice vecchio del motore va isolato e rimosso completamente  
- Nuovo engine in file dedicato  
- Tutto deterministico  
- Nessuna regressione visiva nel canvas

---

# 7. Stato finale del progetto dopo SPEC_03

- SPEC_02 = documentazione storica, non modificata  
- ENGINE_V2 = nuovo motore ufficiale  
- SPEC_03 = specifica principale aggiornata  
- docs/ contiene tutti i file necessari per Cursor  

---

# Fine documento
