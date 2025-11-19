# Patch Implementation Guide

Questa guida descrive il processo operativo per introdurre una nuova patch ENGINE_V2 rispettando determinismo, ordine della pipeline e requisiti di documentazione.

## 1. Analizzare il punto di inserimento
1. **Mappa la pipeline attuale**: la sequenza ufficiale degli step vive in `generateEngineV2` e deve rimanere inalterata (keywords → axes → posizione → curve → mirroring → branching). Inserisci il nuovo comportamento solo dopo aver identificato chiaramente dove leggere e scrivere `BranchedConnection[]` (`lib/engine_v2/engine.ts:9-231`).
2. **Definisci input/output**: ogni patch deve ricevere strutture già tipizzate (`AxesV2`, `Point`, `BranchedConnection`) e restituire gli stessi tipi per mantenere la compatibilità (`lib/types.ts:15-139`).

## 2. Progettare il comportamento
1. **Determinismo del seed**: tutti i generatori pseudo-casuali devono derivare da `prng` o `seededRandom`, concatenando prefissi descrittivi al seed globale (`lib/seed.ts:14-48`).
2. **Limiti numerici**: riutilizza `clamp` e helper esistenti (`lib/engine_v2/curves.ts:311-321`) per mantenere la geometria dentro il canvas.
3. **Debug opzionale**: se la patch espone dati di debug, agganciali alla struttura `EngineV2DebugInfo` così che l'overlay possa visualizzarli (`lib/types.ts:101-139`).

## 3. Integrare la patch nel codice
1. **Pipeline hook**: aggiungi lo step nella funzione principale o in un modulo dedicato e importalo in `engine.ts`, mantenendo i parametri opzionali (lengthScale, curvatureScale, ecc.) nelle `EngineV2Options` (`lib/engine_v2/engine.ts:32-134`).
2. **Testing locale**: esegui la generazione tramite `generateEngineV2` usando seed ripetibili per verificare che `connections` rimangano deterministici (`lib/engine_v2/engine.ts:121-233`).

## 4. Documentazione e comunicazione
1. **Changelog**: registra la patch in `docs/changes/CHANGELOG_SFCM_SYMBOLS.md` sotto la sezione corrente, descrivendo impatto e seed prefixes usati (`docs/changes/CHANGELOG_SFCM_SYMBOLS.md:1-440`).
2. **Spec**: aggiorna `docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md` includendo lo step nel capitolo 3 e appendici su formule/seed.
3. **Indice docs**: se la patch introduce nuovi file o directory, aggiorna `docs/README.md` in modo che i contributor trovino subito la documentazione aggiornata (`docs/README.md:1-74`).
