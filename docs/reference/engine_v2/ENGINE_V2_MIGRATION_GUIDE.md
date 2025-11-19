# ENGINE V2 — Migration Guide (SPEC_04)

Guida per portare progetti legacy al motore SPEC_04 consolidando SPEC_03 + patch01-04 + Branching_beta01.

## 1. Obiettivi
- Usare `generateEngineV2` come **singola** entry point (`lib/engine_v2/engine.ts`).
- Garantire determinismo (seed = keywords + canvas) e compatibilità multi-canvas.
- Allineare documentazione (`docs/specs/SPEC_04_COSMOGRAPH_ENGINE.md`, `docs/reference/engine_v2/*`).

## 2. Sequenza di migrazione
1. **Arquiviare il legacy**
   - Sposta motori precedenti (`lib/geometry.ts`, `lib/semantic.ts`) in `archive/` o marcali come `@deprecated`.
   - Aggiorna README per puntare a SPEC_04 (vedi `docs/README.md`).
2. **Adottare semantic map v2**
   - Importa solo `semantic-map-v2.json` tramite `getSemanticMapV2`.
   - Assicurati che i componenti UI non leggano più la vecchia mappa a 6 assi.
3. **Integrare `generateEngineV2`**
   - In `app/page.tsx` invoca `generateEngineV2({ keywords, options })` passando canvas size, slider e flag debug.
   - Propaga `canvasWidth/canvasHeight` ottenuti da `resolveCanvasSize` (vedi `feature1_canvas_size.md`).
4. **Collegare gli slider**
   - Slider1 → `lengthScale` (Step 5)
   - Slider2 → `curvatureScale` (Step 6)
   - Slider3 → `clusterCount` (Step 4)
   - Slider4 → `clusterSpread` (Step 4)
   - Mantieni gli slider placeholder (“Complessità”, “Mutamento”) disaccoppiati finché non viene definita la nuova logica.
5. **Allineare debug e export**
   - Passa `includeDebug` per popolare `EngineV2DebugInfo` e usare `DebugOverlay`.
   - Verifica che `DownloadSvgButton` e `prepareSvgForExport` ricevano `canvasWidth/canvasHeight` aggiornati.
6. **Verifica patch SPEC_04**
   - Patch02: check micro-dispersione e anchor (Step 3).
   - Patch03: slider cluster attivi e grafica allineata (Step 4).
   - Patch04: profili di lunghezza e curvatura visibili (Step 5-6).
   - Patch01 + Branching_beta01: bounding box/mirroring e rami dalle intersezioni (Step 7-8).

## 3. Regressioni da eseguire
- Genera simboli di riferimento (1 keyword, 4 keyword mix) per più canvas (1:1, 4:5, 16:9).
- Verifica determinismo: stesso seed → stesse `BranchedConnection` anche cambiando slider placeholder.
- Controlla overlay: i cluster devono rispettare slider e gamma; i profili patch04 devono riflettersi in spessore/opacità.
- Usa il changelog (`docs/changes/CHANGELOG_SFCM_SYMBOLS.md`) per replicare gli scenari elencati nelle entry patch.

## 4. Documentazione e governance
- Quando aggiungi una feature/pipeline step:
  1. Aggiorna SPEC_04 (capitolo pertinente + appendici seed prefixes).
  2. Aggiorna `docs/reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md` con le formule.
  3. Scrivi un paragrafo nel changelog e collega eventuali nuove guide.
- Per patch incrementali usa `docs/development/guides/PATCH_IMPLEMENTATION_GUIDE.md` e registra la patch in `docs/proposals/PATCHES_INDEX.md` prima di modificare il codice.

## 5. Troubleshooting rapido
- **Output non specchiato** → assicurati che `finalMirroring.ts` sia importato e che le dimensioni canvas non siano zero.
- **Rami assenti** → controlla `applyBranching` e `generationDepth`; Branching è attivo solo dopo mirroring.
- **Cluster invariati** → verifica Slider3/4 → options, e che `clusterCount` sia almeno 2.
- **Seed instabile** → non concatenare slider o timestamp in `generateSeed`; usare solo keywords + canvas size.

Seguendo questi step il runtime rispecchierà SPEC_04 ed eviterà regressioni rispetto a patch01-04 + Branching_beta01.
