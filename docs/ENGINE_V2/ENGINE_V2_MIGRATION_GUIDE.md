# ENGINE V2 — Migration Guide

Guida ufficiale per integrare il nuovo engine nel progetto esistente e tenere traccia delle patch interne.

## 1. Obiettivi

- Sostituire completamente il motore di generazione geometrica.  
- Non toccare struttura, animazioni, preview ed export.  
- Rimuovere tutta la logica precedente legata al vecchio motore.  
- Integrare i file `ENGINE_V2_*` nella cartella `docs/` come riferimento per Cursor e per i contractor (in questo caso: **Cursor AI agent**).

## 2. Passi principali di migrazione

### Step 1 — Isolare il vecchio motore

- Spostare/archiviare la vecchia `geometry.ts` in una cartella di archive.  
- Verificare che nessun componente React importi più il vecchio motore.

### Step 2 — Integrare ENGINE_V2 in `app/page.tsx`

Sostituire la chiamata alla vecchia pipeline con:

```ts
import { generateEngineV2 } from "@/lib/engine_v2/engine";
```

e usare `generateEngineV2` come unica entry point per la generazione dei simboli.

### Step 3 — Aggiornare lo slider mapping

- Utilizzare i placeholder definiti in `ENGINE_V2_SLIDER_MAPPING.md`.  
- Mantenere gli slider esistenti in UI ma rimuovere la logica interna legacy.  
- Qualsiasi nuova logica slider deve essere definita **dopo** la stabilizzazione di ENGINE_V2.

### Step 4 — Test di regressione

Eseguire (idealmente tramite Cursor) i seguenti test:

- Test canvas 1080×1080.  
- Test con diverse combinazioni di keyword/assi.  
- Test del mirroring finale: verificare simmetria e assenza di glitch.  
- Test disattivazione cluster (deve restare sempre disattivato).  

## 3. patch01 — Mirroring finale (internal change)

**Patch:** `patch01_SPEC_03_mirroring_revision`  
**Scope:** solo ordine interno del pipeline geometrico (non-breaking).  
**Implementazione:** delegata al contractor **Cursor AI agent** all’interno di `lib/engine_v2/*`.

### 3.1 Cosa cambia

- Il mirroring **non** avviene più prima della generazione delle linee (su punti di input).  
- Il mirroring viene applicato **dopo** Gamma/Delta, sull’elenco finale di connections (curve quadratiche).  
- Nessuna API pubblica viene modificata; cambia solo l’ordine interno delle trasformazioni.

### 3.2 Impatto atteso

- Possibile variazione visiva di alcuni layout a parità di seed, dovuta al nuovo punto in cui la simmetria viene applicata.  
- Nessuna modifica per UI, animazione, export o semantic map.  
- Il determinismo resta garantito: stesso input → stesso output.

### 3.3 Cosa deve fare chi integra

- Nessuna azione aggiuntiva richiesta rispetto alla migrazione standard.  
- Tenere aggiornata la documentazione (`ENGINE_V2_GEOMETRY_PIPELINE.md`, `SPEC_03_ENGINE_V2.md`) in caso di ulteriori patch sul mirroring.
