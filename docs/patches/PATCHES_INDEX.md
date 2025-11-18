# ENGINE_V2 — Patch Index

Indice delle patch applicate all'ENGINE_V2 all’interno del progetto **SFCM SYMBOLS**.

> Nota: il "contractor" per l’implementazione tecnica è un agente AI, nello specifico **Cursor AI agent**.

---

## patch01 — Mirroring finale sulla geometria

- **ID:** patch01_SPEC_03_mirroring_revision  
- **Data:** 2025-11-16  
- **Scope:** revisione del mirroring definito in `SPEC_03_ENGINE_V2.md`.  
- **Tipo:** Non-breaking, structural revision (ordine interno del pipeline).  
- **Implementazione:** `lib/engine_v2/*` (funzione di mirroring finale sulle connections).  
- **Contractor:** Cursor AI agent (esegue la patch a partire da `patch01_tasks.md`).  

### Documenti correlati

- `SPEC_03_ENGINE_V2.md` (sezioni 2.2 e Step 1–6 aggiornate).  
- `ENGINE_V2_GEOMETRY_PIPELINE.md` (pipeline aggiornata con mirroring finale).  
- `ENGINE_V2_MIGRATION_GUIDE.md` (sezione dedicata alla patch01).  
- `ENGINE_V2_OVERVIEW.md` (overview aggiornata con mirroring finale).  
- `patch01_SPEC_03_mirroring_revision.md` (dettaglio spec della patch).  
- `patch01_tasks.md` (lista task esecutivi per Cursor).

---

## patch02 — Dispersione punti origine linee

- **ID:** patch_02_Point_Dispersion_at_Line_Origin  
- **Data:** 2025-01-XX  
- **Scope:** miglioramento visivo della generazione geometrica.  
- **Tipo:** Non-breaking, feature enhancement (miglioramento visivo).  
- **Implementazione:** `lib/engine_v2/curves.ts` (funzione `generateDispersedStartPoint` e modifica a `generateCurveFromPoint`).  
- **Contractor:** Cursor AI agent.  

### Documenti correlati

- `patch_02_Point_Dispersion_at_Line_Origin.md` (dettaglio spec della patch).  
- `ENGINE_V2_GEOMETRY_PIPELINE.md` (pipeline aggiornata con dispersione punti).  
- `CHANGELOG_SFCM_SYMBOLS.md` (entry patch02).

---

## patch03 — Clustering direzioni linee

- **ID:** patch_03_Direction_Clustering  
- **Data:** 2025-01-XX  
- **Scope:** miglioramento visivo della generazione delle direzioni delle linee.  
- **Tipo:** Non-breaking, feature enhancement (miglioramento visivo).  
- **Implementazione:** `lib/engine_v2/curves.ts` (modifica a `getLineDirection` con clustering), `lib/seed.ts` (helper `seededRandom`), `app/page.tsx` (slider UI).  
- **Contractor:** Cursor AI agent.  

### Documenti correlati

- `patch_03_Direction_Clustering.md` (dettaglio spec della patch).  
- `ENGINE_V2_GEOMETRY_PIPELINE.md` (pipeline aggiornata con clustering direzioni).  
- `ENGINE_V2_SLIDER_MAPPING.md` (documentazione slider clusterCount e clusterSpread).  
- `CHANGELOG_SFCM_SYMBOLS.md` (entry patch03).

---

## patch04 — Clustering lunghezze e curvature per linea

- **ID:** patch_04_Length_and_Curvature_Clustering  
- **Data:** 2025-01-XX  
- **Scope:** miglioramento visivo della struttura delle linee (lunghezza e curvatura) all'interno di ogni punto Alfa/Beta.  
- **Tipo:** Non-breaking, feature enhancement (miglioramento visivo).  
- **Implementazione:** `lib/engine_v2/curves.ts` (profili di lunghezza/curvatura per linea), `lib/types.ts` (estensione `DirectionClusterDebug`), `components/DebugOverlay.tsx` (visualizzazione profili).  
- **Contractor:** Cursor AI agent.  

### Documenti correlati

- `patch_04_Length_and_Curvature_Clustering.md` (dettaglio spec della patch).  
- `ENGINE_V2_GEOMETRY_PIPELINE.md` (pipeline aggiornata con profili di lunghezza/curvatura per linea).  
- `ENGINE_V2_SLIDER_MAPPING.md` (note su interazione Slider1/Slider2 con i profili).  
- `ENGINE_V2_DEBUG_OVERLAY.md` (debug overlay aggiornato con visualizzazione profili).  
- `CHANGELOG_SFCM_SYMBOLS.md` (entry patch04).

