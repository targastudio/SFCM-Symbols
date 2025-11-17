# SFCM Symbols — Documentazione

Indice completo della documentazione del progetto **Studio For Cosmopolitical Models - Symbol Generator**.

---

## 📐 Specifiche Attive

### ENGINE_V2 (Sistema a 4 Assi)

**Percorso**: `specs/engine_v2/`

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

### Features

**Percorso**: `specs/features/`

Documentazione delle feature specifiche:

- `feature1_canvas_size.md` — Sistema di dimensioni canvas (1:1, 4:5, 9:16, 16:9, fit, custom)

---

## 🔧 Patch

**Percorso**: `patches/`

Patch applicate al sistema ENGINE_V2:

- `PATCHES_INDEX.md` — Indice completo delle patch
- `patch01_SPEC_03_mirroring_revision.md` — Final geometry mirroring
- `patch01_tasks.md` — Task implementazione patch01

---

## 🛠️ Development Tools

### Debug

**Percorso**: `development/debug/`

- `ENGINE_V2_DEBUG_OVERLAY.md` — Overlay visuale per debug geometria
- `README.md` — Panoramica strumenti di debug

### Changelog

**Percorso**: `development/changelog/`

- `CHANGELOG_SFCM_SYMBOLS.md` — Storico modifiche del progetto

---

## 📦 Archivio

**Percorso**: `archive/`

Documentazione e codice legacy non più utilizzati:

- `engine_v1/` — Vecchio motore 6 assi + SPEC_02
- `engine_v2_migration/` — Report e documentazione processo di migrazione

Vedi `archive/README.md` per dettagli.

---

## 🚀 Quick Start

1. **Capire l'architettura**: Inizia da `specs/engine_v2/ENGINE_V2_OVERVIEW.md`
2. **Vedere la pipeline**: Leggi `specs/engine_v2/ENGINE_V2_GEOMETRY_PIPELINE.md`
3. **Modificare comportamento**: Consulta `specs/engine_v2/SPEC_03_ENGINE_V2.md`
4. **Debug geometria**: Usa `development/debug/ENGINE_V2_DEBUG_OVERLAY.md`

---

**Ultimo aggiornamento**: 2025-11-18 (post-cleanup)

