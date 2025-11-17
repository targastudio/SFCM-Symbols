# Cleanup Log — 2025-11-18

## File Spostati

### Engine Legacy (ENGINE_V1)

- `lib/geometry.ts` → `docs/archive/engine_v1/geometry.ts`
- `lib/semantic.ts` → `docs/archive/engine_v1/semantic.ts`
- `semantic/semantic-map.json` → `docs/archive/engine_v1/semantic-map.json`

### Documentazione

- `docs/ENGINE_V2/` → `docs/specs/engine_v2/`
- `docs/extrafeatures/` → `docs/specs/features/`
- `docs/debug/` → `docs/development/debug/`
- `docs/changelog/` → `docs/development/changelog/`
- `docs/archive/spec02/` → `docs/archive/engine_v1/` (file spostati, cartella eliminata)
- `docs/archive/ENGINE_V2_ARCHIVE/` → `docs/archive/engine_v2_migration/` (rinominata)

## File Creati

- `docs/README.md` — Indice generale documentazione
- `docs/archive/README.md` — Indice archivio
- `CLEANUP_LOG.md` — Questo file

## File Eliminati

- `public/file.svg` — File SVG non utilizzato (default Next.js)
- `public/globe.svg` — File SVG non utilizzato (default Next.js)
- `public/next.svg` — File SVG non utilizzato (default Next.js)
- `public/vercel.svg` — File SVG non utilizzato (default Next.js)
- `public/window.svg` — File SVG non utilizzato (default Next.js)

## Modifiche Configurazione

- `tsconfig.json` — Aggiunto `docs/archive` a `exclude` per evitare errori TypeScript sui file legacy

## Verifica Post-Cleanup

- ✅ Build TypeScript: PASSED
- ✅ Nessun import rotto: VERIFIED
- ✅ Struttura documentazione: CLEAN
- ✅ File legacy isolati: CONFIRMED
- ✅ File pubblici non utilizzati: RIMOSSI

## Comandi di Verifica Eseguiti

```bash
# Verifica import legacy (nessun risultato trovato)
grep -r "from.*lib/geometry" --include="*.ts" --include="*.tsx" app/ components/ lib/
grep -r "from.*lib/semantic" --include="*.ts" --include="*.tsx" app/ components/ lib/

# Verifica struttura
ls -la docs/archive/engine_v1/
ls -la docs/specs/engine_v2/
ls -la docs/development/

# Build
npm run build
```

## Struttura Finale

```
docs/
├── specs/
│   ├── engine_v2/          # Specifiche ENGINE_V2
│   └── features/           # Feature specifiche
├── patches/                # Patch applicate
├── development/
│   ├── debug/              # Strumenti debug
│   └── changelog/          # Changelog
└── archive/
    ├── engine_v1/          # File legacy ENGINE_V1
    ├── engine_v2_migration/ # Report migrazione
    └── README.md           # Indice archivio
```

---

**Responsabile**: Cursor AI  
**Data**: 2025-11-18  
**Commit suggerito**: `chore: cleanup codebase - archive legacy ENGINE_V1 and reorganize docs`

