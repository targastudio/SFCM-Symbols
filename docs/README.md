# SFCM Symbols — Documentazione

Indice completo della documentazione del progetto **Studio For Cosmopolitical Models – Symbol Generator**.

La cartella `docs/` è organizzata per tipo di contenuto così da facilitare l'onboarding e la manutenzione:

---

## 🧭 Overview

**Percorso**: `overview/`

Documenti introduttivi e spiegazioni ad alto livello.

- `cluster-generation.md` — Spiega come i cluster direzionali influenzano la pipeline geometrica.

---

## 📐 Reference

**Percorso**: `reference/`

Specifiche formali e materiale di riferimento.

### SPEC_04 — Cosmograph Engine

**Percorso**: `specs/SPEC_04_COSMOGRAPH_ENGINE.md`

Documento unico che consolida SPEC_03, patch01-04 e Branching_beta01 descrivendo assi semantici, pipeline a otto step, slider, seed prefixes e appendici di riferimento.

### ENGINE_V2 (Sistema a 4 Assi)

**Percorso**: `reference/engine_v2/`

Il motore di generazione corrente basato su 4 assi semantici:

- **Alfa** (Azione ↔ Osservazione) → Posizione X
- **Beta** (Specifico ↔ Ampio) → Posizione Y
- **Gamma** (Unico ↔ Composto) → Numero, direzione, lunghezza linee
- **Delta** (Regolare ↔ Irregolare) → Curvatura e irregolarità

**Documenti chiave**:

- `SPEC_03_ENGINE_V2.md` — Specifica principale
- `ENGINE_V2_OVERVIEW.md` — Panoramica architettura
- `ENGINE_V2_GEOMETRY_PIPELINE.md` — Pipeline geometrica completa
- `ENGINE_V2_SEMANTIC_MAP.md` — Sistema di mapping semantico
- `ENGINE_V2_SLIDER_MAPPING.md` — Configurazione slider UI
- `ENGINE_V2_MIGRATION_GUIDE.md` — Guida per integrazioni

**Nota**: Le specifiche ENGINE_V2 restano consultabili per storico ma non più aggiornate. Per la versione corrente, consulta `specs/SPEC_04_COSMOGRAPH_ENGINE.md`.

### Features

**Percorso**: `reference/features/`

Documentazione delle feature specifiche:

- `feature1_canvas_size.md` — Sistema di dimensioni canvas (1:1, 4:5, 9:16, 16:9, fit, custom)
- `feature_branching_beta01.md` — Step Branching_beta01 post-mirroring

Quando si aggiungono nuove feature, usare la guida dedicata (vedi sezione "🧪 Guides").

---

## 🧪 Guides

**Percorso**: `guides/`

Processi di lavoro e istruzioni operative.

- `feature-implementation-workflow.md` — Workflow per implementare nuove feature.

### Debugging

**Percorso**: `guides/debugging/`

Strumenti interni per analizzare ENGINE_V2.

- `README.md` — Panoramica degli strumenti di debug
- `engine-v2-debug-overlay.md` — Overlay visuale per ispezionare geometrie e cluster

---

## 📝 Changes

**Percorso**: `changes/`

Storico modifiche e changelog ufficiali.

- `CHANGELOG_SFCM_SYMBOLS.md` — Storico modifiche del progetto

---

## 🧩 Proposals & Patch

**Percorso**: `proposals/`

Specifiche incrementali, patch e task list.

- `PATCHES_INDEX.md` — Indice completo delle patch
- `patch01_SPEC_03_mirroring_revision.md` — Revisione mirroring finale
- `patch_02_Point_Dispersion_at_Line_Origin.md` — Dispersione origine linee
- `patch_03_Direction_Clustering.md` — Clustering direzioni linee
- `patch_04_Length_and_Curvature_Clustering.md` — Profili lunghezza/curvatura per linea
- `patch01_tasks.md` — Task di implementazione

**Nota**: Consulta `PATCHES_INDEX.md` per la cronologia e usa la guida "Patch Implementation" per introdurre nuove iterazioni.

---

## 🗃️ Archive

**Percorso**: `archive/`

Documentazione e codice legacy non più utilizzati:

- `engine_v1/` — Vecchio motore 6 assi + SPEC_02
- `ENGINE_V2_ARCHIVE/` — Report storici e audit
- `spec02/` — Documentazione SPEC_02

Vedi `archive/README.md` per dettagli.

---

## 🚀 Quick Start

1. **Capire l'architettura**: parti da `specs/SPEC_04_COSMOGRAPH_ENGINE.md` o `reference/engine_v2/ENGINE_V2_OVERVIEW.md`
2. **Vedere la pipeline**: Leggi `reference/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md`
3. **Aggiungere feature**: segui `guides/feature-implementation-workflow.md`
4. **Introdurre patch**: consulta `guides/` e registra tutto nel changelog
5. **Validare visivamente**: usa `guides/debugging/engine-v2-debug-overlay.md`

## 🧼 Documentation hygiene

- Ogni nuovo file deve essere referenziato in questa mappa per rimanere discoverable.
- SPEC_04 è la singola fonte di verità; quando aggiorni pipeline o slider, sincronizza anche appendici e guide.
- I documenti legacy restano in `reference/engine_v2/` e `archive/`; non modificarli se non per note storiche.

---

**Ultimo aggiornamento**: 2025-11-18 (post-cleanup)
