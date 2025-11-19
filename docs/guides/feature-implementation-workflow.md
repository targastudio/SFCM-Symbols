# Feature Implementation Workflow

Questa procedura descrive come aggiungere una nuova feature lato prodotto (UI + engine) mantenendo consistente l'esperienza e la documentazione.

## 1. Allineamento con lo stato del motore
1. **Rivedi SPEC_04** per capire quali step o parametri influenzi (capitoli 3 e 4). Questo evita di duplicare controlli esistenti (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md:1-210`).
2. **Ispeziona `EngineV2Options`** per verificare se il parametro esiste già o se deve essere introdotto con default coerenti (`lib/engine_v2/engine.ts:32-134`).

## 2. Aggiornare l'interfaccia utente
1. **State mapping**: aggiungi lo slider o il controllo React nel componente pagina, seguendo il pattern `useState` già usato per i quattro slider principali (`app/page.tsx:190-223`).
2. **Formula esplicita**: documenta nel codice come il valore UI (0–100) viene convertito nel parametro del motore, come già fatto per `lengthScale`, `curvatureScale`, `clusterCount` e `clusterSpread` (`app/page.tsx:194-221`).
3. **Seed neutrality**: ricorda che il seed dipende solo da keywords e dimensioni canvas; eventuali nuove feature non devono alterare `generateSeed` (`app/page.tsx:154-201`).

## 3. Estendere il motore
1. **Passaggio parametri**: propaga il nuovo valore nell'oggetto `options` di `generateEngineV2`, mantenendo il pattern `{ ...existing, newParam }` (`app/page.tsx:223-232`).
2. **Utilizzo**: leggi l'opzione all'inizio della pipeline e passala allo step rilevante, analogamente a `lengthScale`, `curvatureScale`, `clusterCount` e `clusterSpread` (`lib/engine_v2/engine.ts:127-200`).
3. **Determinismo**: se la feature introduce randomizzazione, crea seed prefixes espliciti sfruttando `prng` (`lib/seed.ts:14-48`).

## 4. Aggiornare tipologie e debug
1. **Tipi condivisi**: se il parametro deve comparire in debug o nelle connessioni, aggiorna `lib/types.ts` assicurandoti che eventuali campi opzionali siano documentati (`lib/types.ts:15-139`).
2. **Debug overlay**: quando serve telemetria, arricchisci `EngineV2DebugInfo` e aggiorna `components/DebugOverlay.tsx` per visualizzare i nuovi dati (`components/DebugOverlay.tsx:1-141`).

## 5. Documentazione e QA
1. **SPEC e appendici**: aggiungi la feature nelle sezioni pertinenti di `SPEC_04` (pipeline o slider) con formule e seed prefixes (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md:180-320`).
2. **README docs**: registra il nuovo artefatto o guida nella mappa della documentazione per mantenere la discoverability (`docs/README.md:1-90`).
3. **Test determinismo**: esegui due generazioni identiche verificando che le nuove strutture producano lo stesso output dato seed invariato (`lib/engine_v2/engine.ts:121-233`).
