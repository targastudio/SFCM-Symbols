# Pipeline Modification Playbook

Seguire questa check-list quando si modifica la pipeline ENGINE_V2 per evitare regressioni o rotture.

## 1. Verificare i vincoli di compatibilità
1. **Formato BranchedConnection**: qualsiasi step nuovo o aggiornato deve restituire `BranchedConnection` con i campi obbligatori (`from`, `to`, `curved`, `curvature`, `generationDepth`) per compatibilità col renderer (`lib/engine_v2/engine.ts:63-108`).
2. **Mirroring e branching**: gli step 7 e 8 dipendono dall'array completo di curve; evitare di spostarli o bypassarli a meno di introdurre un feature flag documentato (`lib/engine_v2/engine.ts:227-279`).

## 2. Salvaguardare determinismo e semi
1. **Seed globale invariato**: il seed proviene solo da keywords + canvas; assicurati che nuove trasformazioni non lo rigenerino (`app/page.tsx:154-201`).
2. **Prefissi descrittivi**: registra ogni nuova fonte di randomizzazione nell'appendice B della SPEC e usa prefissi simili a quelli esistenti (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md:180-260`).

## 3. Validare geometria e canvas
1. **Clamp costante**: usa `clampToCanvas` quando crei nuovi punti o controlli per garantire che rientrino nel canvas (`lib/engine_v2/curves.ts:311-320`).
2. **Scale awareness**: quando operi in coordinate normalizzate, converti sempre tramite `normalizedToPixel` per rispettare canvas non quadrati (`lib/engine_v2/position.ts:32-75`).

## 4. Debug e QA
1. **IncludeDebug**: se lo step fornisce informazioni aggiuntive, popolale solo quando `includeDebug` è `true`, seguendo l'esempio dei cluster direzionali (`lib/engine_v2/engine.ts:194-219`).
2. **Overlay**: aggiorna `components/DebugOverlay.tsx` per rappresentare i nuovi dati e facilitare la validazione visiva (`components/DebugOverlay.tsx:1-141`).
3. **Regression suite**: rigenera i simboli campione usati nel changelog per confronti visivi e assicurati che eventuali differenze siano deliberate (`docs/changes/CHANGELOG_SFCM_SYMBOLS.md:1-440`).
