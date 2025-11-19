# Report Analisi Codebase lib/

Analisi aggiornata confrontando gli export della cartella `lib/` (eccetto `geometry.ts` e `semantic.ts`, marcati legacy) con l'intera repository (`app/`, `components/`, `semantic/`, `docs/`). Tutte le verifiche sono state effettuate con `rg` per garantire che i simboli contrassegnati come inutilizzati non abbiano import fuori dal rispettivo file.

## 1. Funzioni e tipi esportati vs utilizzo effettivo

### lib/seed.ts
- ✅ `cyrb53` – usata da `app/page.tsx` per derivare il seed globale in base a keywords e canvas.【F:lib/seed.ts†L14-L47】【F:app/page.tsx†L8-L197】
- ✅ `prng` – consumata dal nuovo engine (`lib/engine_v2/curves.ts`) e dal codice legacy (`lib/geometry.ts`, `lib/semantic.ts`) per generare numeri deterministici.【F:lib/seed.ts†L31-L48】【F:lib/engine_v2/curves.ts†L261-L432】【F:lib/geometry.ts†L290-L1291】【F:lib/semantic.ts†L36-L68】
- ✅ `seededRandom` – wrapper usato solo da `lib/engine_v2/curves.ts` per estrarre singoli valori pseudo-casuali.【F:lib/seed.ts†L40-L48】【F:lib/engine_v2/curves.ts†L82-L217】

### lib/canvasSizeConfig.ts
- ✅ `CanvasSizeId` – tipo usato da `app/page.tsx` per lo stato UI e per convertire gli input utente.【F:lib/canvasSizeConfig.ts†L19-L25】【F:app/page.tsx†L14-L70】
- ✅ `CANVAS_PRESETS` – ora helper interno (non esportato) utilizzato esclusivamente da `resolveCanvasSize`, quindi non espone più API superflue.【F:lib/canvasSizeConfig.ts†L27-L83】
- ✅ `resolveCanvasSize` – chiamato dalla UI per ottenere width/height effettivi in fase di generazione.【F:lib/canvasSizeConfig.ts†L36-L83】【F:app/page.tsx†L182-L219】
- ✅ `validateCustomSize` – usato per bloccare dimensioni custom non valide durante auto-rigenerazione e submit.【F:lib/canvasSizeConfig.ts†L85-L107】【F:app/page.tsx†L93-L105】【F:app/page.tsx†L282-L297】

### lib/svgStyleConfig.ts
- ✅ `CANVAS_SIZE` – la costante superflua è stata rimossa, lasciando il file focalizzato solo sullo styling condiviso; le dimensioni restano responsabilità di `resolveCanvasSize`.【F:lib/svgStyleConfig.ts†L1-L33】
- ✅ `BASE_STROKE_WIDTH`, `STROKE_COLOR`, `ARROW_WIDTH_PX`, `ARROW_HEIGHT_PX`, `ARROW_MARKER_UNITS`, `ARROW_MARKER_ID`, `BACKGROUND_COLOR` – usati da `components/SvgPreview.tsx` e da `lib/prepareSvgForExport.ts` per garantire coerenza tra preview e export.【F:lib/svgStyleConfig.ts†L15-L33】【F:components/SvgPreview.tsx†L3-L243】【F:lib/prepareSvgForExport.ts†L18-L356】

### lib/svgUtils.ts
- ✅ `clampToCanvas` – ora condiviso tra SvgPreview e ENGINE_V2 (`curves.ts` lo importa al posto della propria copia), lasciando il duplicato solo nel codice legacy di `geometry.ts`.【F:lib/svgUtils.ts†L10-L66】【F:lib/engine_v2/curves.ts†L19-L575】
- ✅ `computeCurveControl` – usato dal preview e dal mirroring finale per ricostruire i punti di controllo delle curve.【F:lib/svgUtils.ts†L31-L66】【F:components/SvgPreview.tsx†L3-L243】【F:lib/engine_v2/finalMirroring.ts†L22-L357】

### lib/prepareSvgForExport.ts
- ✅ `prepareSvgForExport` – unica API pubblica per l'export SVG; invocata da `components/DownloadSvgButton.tsx` prima di scaricare il file finale.【F:lib/prepareSvgForExport.ts†L822-L927】【F:components/DownloadSvgButton.tsx†L3-L84】

### lib/types.ts
- ✅ Tipi legacy condivisi (`Axes`, `Point`, `ClusterPoint`, `Cluster`, `Connection`, `Intersection`, `BranchedConnection`) – usati estensivamente dentro `lib/geometry.ts`, `lib/svgUtils.ts`, `components/SvgPreview.tsx` e `components/DownloadSvgButton.tsx`.【F:lib/types.ts†L6-L50】【F:lib/geometry.ts†L118-L1253】【F:components/SvgPreview.tsx†L3-L243】【F:components/DownloadSvgButton.tsx†L3-L84】
- ✅ Tipi ENGINE_V2 (`AxesV2`, `SemanticMapV2`, `Quadrant`, `KeywordAnchorDebug`, `DirectionClusterDebug`, `EngineV2DebugInfo`) – usati da `lib/engine_v2/*`, dalla UI e dal debug overlay.【F:lib/types.ts†L60-L163】【F:lib/engine_v2/engine.ts†L20-L269】【F:components/DebugOverlay.tsx†L13-L258】【F:app/page.tsx†L10-L258】
- ✅ Tipi inutilizzati (`KeywordVec`, `KeywordVecV2`, `EngineV2Curve`) rimossi: il file ora espone solo definizioni effettivamente consumate da engine e UI, riducendo la superficie API.【F:lib/types.ts†L1-L134】

### lib/engine_v2/axes.ts
- ✅ `normalizeKeywordV2`, `sanitizeAxesV2`, `fallbackAxesV2` – mantenuti interni al modulo per evitare API inutili, pur restando documentati come parti della pipeline.【F:lib/engine_v2/axes.ts†L21-L159】
- ✅ `getSemanticMapV2` – usato da `generateEngineV2` per caricare il dizionario patch03.【F:lib/engine_v2/axes.ts†L115-L205】【F:lib/engine_v2/engine.ts†L21-L210】
- ✅ `getAxesForKeywordV2` – API principale invocata dal motore per mappare keywords→assi.【F:lib/engine_v2/axes.ts†L162-L205】【F:lib/engine_v2/engine.ts†L149-L210】
- ✅ `getAxesV2ForKeyword` – wrapper legacy rimosso perché non più referenziato, prevenendo confusione con l'API principale.【F:lib/engine_v2/axes.ts†L162-L205】

### lib/engine_v2/curves.ts
- ✅ `getNumberOfLines`, `getLineDirectionWithDebug`, `getLineLength`, `applyDeltaIrregularity` – segnati ora come helper interni (non esportati) e riutilizzano `clampToCanvas` condiviso per evitare duplicati.【F:lib/engine_v2/curves.ts†L19-L575】
- ✅ `generateCurveFromPoint` – usato da `lib/engine_v2/engine.ts` per produrre le curve prima del mirroring finale.【F:lib/engine_v2/curves.ts†L449-L575】【F:lib/engine_v2/engine.ts†L195-L223】

### lib/engine_v2/engine.ts
- ✅ `EngineV2Options`, `EngineV2Result` – mantenuti come type alias interni alla funzione esportata; la UI continua ad usare `generateEngineV2` senza ricevere tipi pubblici inutilizzati.【F:lib/engine_v2/engine.ts†L30-L269】【F:app/page.tsx†L8-L258】
- ✅ `generateEngineV2` – funzione principale usata dalla pagina Next.js per generare connessioni e debug info.【F:lib/engine_v2/engine.ts†L119-L269】【F:app/page.tsx†L8-L258】

### lib/engine_v2/finalMirroring.ts
- ✅ `computeMirroringDebugInfo`, `applyFinalMirroring` – importati da `lib/engine_v2/engine.ts` per calcolare bounding box/assi e applicare il mirroring patch01.【F:lib/engine_v2/finalMirroring.ts†L1-L357】【F:lib/engine_v2/engine.ts†L20-L269】

### lib/engine_v2/position.ts
- ✅ `axesToNormalizedPosition`, `normalizedToPixel`, `getQuadrant` – usati dal motore per convertire Alfa/Beta in coordinate e determinare il quadrante.【F:lib/engine_v2/position.ts†L26-L76】【F:lib/engine_v2/engine.ts†L155-L210】
- ✅ `axesToPixelPosition` – helper rimosso per evitare un alias non utilizzato e mantenere chiara la superficie pubblica del modulo.【F:lib/engine_v2/position.ts†L1-L89】

### lib/archive/engine_v2_mirroring.ts (legacy)
- ✅ `getOccupiedQuadrants`, `applyQuadrantMirroring` – il vecchio modulo è stato spostato fuori da `lib/engine_v2/` per chiarire che si tratta solo di riferimento storico; non è importato da nessun runtime.【F:lib/archive/engine_v2_mirroring.ts†L1-L214】

## 2. Ridondanze individuate
- **✅ clampToCanvas duplicato** – ENGINE_V2 importa ora l'helper da `lib/svgUtils.ts`, quindi il duplicato rimane solo nel legacy `geometry.ts`. Ulteriori fix al clamping toccheranno un unico punto condiviso.【F:lib/svgUtils.ts†L10-L66】【F:lib/engine_v2/curves.ts†L19-L575】
- **❌ Normalizzazione keyword duplicata** – `normalizeKeywordV2` e il legacy `normalizeKeyword` in `lib/semantic.ts` condividono la stessa logica trim+lowercase. Estrarre un helper comune eviterebbe discrepanze tra i due engine (bloccato finché `lib/semantic.ts` resta immutable).【F:lib/engine_v2/axes.ts†L21-L31】【F:lib/semantic.ts†L22-L68】
- **✅ `axesToPixelPosition` sovrapposto** – rimosso per evitare alias ridondanti; il motore usa direttamente `axesToNormalizedPosition` + `normalizedToPixel`.【F:lib/engine_v2/position.ts†L1-L76】

## 3. Problemi di igiene del codice
- **✅ Export superflui** – gli helper segnalati sono stati internalizzati o rimossi (`CANVAS_PRESETS`, `CANVAS_SIZE`, `normalizeKeywordV2`, `sanitizeAxesV2`, `fallbackAxesV2`, wrapper legacy di `axes`, helper di `curves.ts`, `EngineV2Options/Result`, `axesToPixelPosition`, `KeywordVec*`, `EngineV2Curve`, `getOccupiedQuadrants/applyQuadrantMirroring`). Rimangono pubbliche solo le API effettivamente consumate da UI e motore.【F:lib/canvasSizeConfig.ts†L19-L107】【F:lib/svgStyleConfig.ts†L1-L33】【F:lib/engine_v2/axes.ts†L21-L205】【F:lib/engine_v2/curves.ts†L19-L575】【F:lib/engine_v2/engine.ts†L30-L269】【F:lib/engine_v2/position.ts†L1-L76】【F:lib/types.ts†L1-L134】【F:lib/archive/engine_v2_mirroring.ts†L1-L214】
- **✅ Console output sempre attivo** – `inlineStylesRecursive` ora logga solo in `development`, quindi l'export SVG non produce warn rumorosi in produzione.【F:lib/prepareSvgForExport.ts†L318-L357】
- **✅ Commenti/nomi obsoleti** – `lib/svgStyleConfig.ts` chiarisce che le dimensioni passano da `resolveCanvasSize`, e il mirroring legacy è stato spostato in `lib/archive/` fuori dalla cartella attiva di ENGINE_V2.【F:lib/svgStyleConfig.ts†L1-L33】【F:lib/archive/engine_v2_mirroring.ts†L1-L214】

## 4. Verifiche ENGINE_V2
- **Isolamento dal legacy** – i file in `lib/engine_v2/` importano solo moduli di `lib/engine_v2`, `../types`, `../seed`, `../svgUtils` e JSON di `semantic/`; non ci sono dipendenze dirette su `lib/geometry.ts` o `lib/semantic.ts`, rispettando il perimetro richiesto.【F:lib/engine_v2/engine.ts†L20-L28】【F:lib/engine_v2/curves.ts†L17-L19】【F:lib/engine_v2/axes.ts†L17-L24】【F:lib/engine_v2/position.ts†L17-L24】【F:lib/engine_v2/finalMirroring.ts†L22-L24】
- **Allineamento documentazione** – gli header in `engine.ts`, `curves.ts`, `finalMirroring.ts` e `axes.ts` puntano esplicitamente alle sezioni corrette di `docs/ENGINE_V2_*` e delle patch, come richiesto dal workflow di migrazione.【F:lib/engine_v2/engine.ts†L1-L18】【F:lib/engine_v2/curves.ts†L1-L27】【F:lib/engine_v2/finalMirroring.ts†L1-L20】【F:lib/engine_v2/axes.ts†L1-L19】
- **Legacy isolato** – il mirroring pre-patch01 vive ora in `lib/archive/engine_v2_mirroring.ts`; non viene importato dal runtime ed è chiaramente marcato come storico.【F:lib/archive/engine_v2_mirroring.ts†L1-L214】

## 5. Raccomandazioni

### High Priority
1. Estrarre un helper condiviso per la normalizzazione delle keyword (riutilizzabile da `lib/semantic.ts` e `lib/engine_v2/axes.ts`) per garantire parità tra ENGINE_V1 e ENGINE_V2 senza duplicare logica.

### Medium Priority
1. Aggiornare la documentazione (`docs/patches`, `docs/specs`) per riflettere la rimozione di `getAxesV2ForKeyword`, `CANVAS_SIZE` e degli altri export ora interni, così gli sviluppatori non cercano simboli inesistenti.

### Low Priority
1. Documentare in `docs/ENGINE_V2` quali export rimangono pubblici (ad esempio `generateEngineV2`, `prepareSvgForExport`, `svgStyleConfig`) per mantenere snella la superficie API.
