# Feature Branching_beta01 — Ramificazioni da intersezioni

Versione: 1.0 — SPEC_04 Step 8 reference (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md:270-320`)

## Scopo

Aggiungere una fase di **branching** alla fine della pipeline geometry ENGINE_V2 che generi nuove linee a partire dalle intersezioni tra le linee già presenti nel canvas (inclusi i segmenti specchiati). Il comportamento deve essere completamente deterministico e funzionare su tutte le dimensioni di canvas senza introdurre scaling anomali.

## Obiettivi

1. **Rilevare intersezioni reali tra curve**
   - Analizzare tutte le connessioni finali (post-mirroring) con un'approssimazione Bézier a campionamento uniforme.
   - Consolidare intersezioni vicine tramite arrotondamento a 1px per evitare duplicati.
2. **Generare nuove ramificazioni a partire dalle intersezioni**
   - Ogni intersezione selezionata crea 1–2 rami orientati in modo deterministico a partire dalla direzione media delle linee incidenti.
   - Lunghezze basate su frazioni della diagonale del canvas (6%–12%) per garantire compatibilità con qualsiasi formato.
   - Curvatura leggera opzionale (|curvature| ≤ 0.35) e tratteggio deterministico per varietà visiva.
3. **Mantenere il determinismo end-to-end**
   - Tutta la randomizzazione usa il seed globale di ENGINE_V2 con prefissi espliciti (`branching:*`).
   - Stesso set di keyword + seed + canvas size → stesso set di intersezioni e stesse ramificazioni.

## Vincoli

- Nessuna modifica ai parametri di input: nessun nuovo slider/UI.
- Le nuove linee devono rispettare i bound esatti del canvas; ogni punto finale va clampato.
- Non alterare la generazione esistente: le connessioni originali restano `generationDepth = 0`, le ramificazioni usano un depth maggiore per l'ordinamento nel renderer.

## Integrazione nella pipeline geometry

La fase di branching viene eseguita **dopo** il mirroring finale (`applyFinalMirroring`) e prima dell'output del risultato ENGINE_V2.

1. **Rilevamento intersezioni**
   - Funzione: `detectIntersections(connections, canvasWidth, canvasHeight)` in `lib/engine_v2/branching.ts`.
   - Approssima le curve quadratiche con 12 campioni uniformi usando `computeCurvePoint(t)`, includendo `t = 0..1`.
   - Confronta ogni segmento della polilinea con tutti gli altri, usando `segmentIntersection` (t/u in [0,1]).
   - Raggruppa intersezioni vicine arrotondando a 1px (`key = round(x),round(y)`).
   - Esclude intersezioni con meno di 2 connessioni.

2. **Generazione ramificazioni**
   - Funzione: `applyBranching(connections, canvasWidth, canvasHeight, seed)`.
   - Parametri fissi:
     - Max intersezioni considerate: `min(30, intersections.length)` con selezione **deterministicamente mescolata** per evitare bias sui primi cluster generati.
     - Max rami per intersezione: 2.
     - Lunghezza ramo: `diag * (0.06 + r * 0.06)` con `diag = sqrt(w² + h²)` e `r = seededRandom(\`${seed}:branching:length:${i}:${branchIndex}\`)`.
     - Offset angolare: ±60° deterministico (`seededRandom(\`${seed}:branching:angle:${i}:${branchIndex}\`)`).
     - Curvatura: `(seededRandom(\`${seed}:branching:curvature:${i}:${branchIndex}\`) - 0.5) * 0.7`, `curved = |curvature| > 0.08`.
     - Tratteggio: `seededRandom(\`${seed}:branching:dashed:${i}:${branchIndex}\`) < 0.35`.
   - Direzione base: media normalizzata dei vettori delle connessioni incidenti; fallback `(1,0)` se zero.
   - Punto finale clampato con `clampToCanvas`.
   - Ogni ramo è un `BranchedConnection` con `generationDepth = 1` e `generatedFrom = intersectionIndex`.

3. **Output finale**
   - L'engine restituisce `connections` = originali + rami.
   - La UI li renderizza ordinati per `generationDepth`, senza ulteriori cambiamenti.

## Determinismo

- Tutte le sorgenti di casualità usano `seededRandom` con prefissi espliciti (`branching:intersectionIndex`, `branching:length:...`, ecc.).
- Nessun accesso a stato globale o tempo di esecuzione.
- Dipendenza dal canvas size inclusa nel seed principale (come già avviene in ENGINE_V2), garantendo output ripetibili per ogni formato.

## Compatibilità

- Funziona con qualunque `canvasWidth`/`canvasHeight`; lunghezze derivate dalla diagonale assicurano proporzionalità.
- Nessuna modifica ai tipi pubblici né alla UI: retro-compatibilità garantita.
- Rispettati i bound del canvas per evitare overflow grafici.

## Deliverable

- Implementazione `lib/engine_v2/branching.ts` con detection + generation.
- Integrazione in `lib/engine_v2/engine.ts` subito dopo il mirroring finale.
- Aggiornamento `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` e changelog.
