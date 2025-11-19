# Feature — Toggle Dark Mode
Specification draft v1.0
Location: `docs/specs/features/Toggle_Dark_Mode.md`

## Overview
Users need to review symbols in both the existing dark UI and an inverted light UI. A dedicated toggle must flip the entire generator between two palettes: the **current dark mode** (baseline colours and contrast) and a **light mode** that inverts foreground/background relationships (pure black ↔ pure white, accent colours swapped to maintain sufficient contrast). The toggle affects the live canvas, UI chrome, debug overlays, SVG export, and any persisted theme preference.

This document outlines the implementation scope, touching every layer required to deliver a robust theme system instead of a single hard-coded palette. It details the elements that need to change, what must be abstracted, and which modules require new code.

---

## Goals
1. **Enable theme switching at runtime** without page reloads.
2. **Preserve visual parity** between preview and exported SVGs in both modes.
3. **Respect accessibility** (contrast, animation visibility, focus states) across themes.
4. **Persist user preference** using client-side storage so the chosen theme survives reloads.

---

## Non-goals
- Rewriting ENGINE_V2 geometry logic.
- Supporting more than two themes.
- Theming legacy pages beyond the generator UI (can be addressed later if needed).

---

## Implementation Breakdown

### 1. Design Tokens & Color Abstraction
**Current state:** `app/globals.css` hard-codes colors (body background black, text white, UI outlines neon green/blue). Components (`SvgPreview`, `DownloadSvgButton`, sliders) import colours inline.

**Required work:**
- Introduce CSS custom properties representing the design system (e.g., `--surface`, `--surface-alt`, `--text-primary`, `--stroke-primary`, `--stroke-accent`, `--control-bg`, `--control-border`, `--debug-grid`). Define them inside `:root[data-theme="dark"]` using existing values, and `:root[data-theme="light"]` for their inverted equivalents. Light mode should flip black ↔ white, adjust accent hues so strokes remain visible (e.g., current cyan lines become deep navy, magenta arrows become burnt orange) while meeting WCAG contrast.
- Update `app/globals.css` plus any module-level CSS to consume variables instead of literals.
- Document palette mapping in comments so designers understand how "complete opposite" is satisfied.

### 2. Theme State & Provider
**New code:** create `lib/theme.tsx` (or similar) exporting a `ThemeProvider`, `useTheme` hook, and `ThemeId = "dark" | "light"` type.

Responsibilities:
- Keep `theme` state (`useState` in provider) defaulting to `"dark"`.
- Read persisted preference from `localStorage` inside a `useEffect` (guarded for SSR) and apply.
- Expose `setTheme` and `toggleTheme` helpers.
- Apply the attribute `data-theme` on the `<body>` or `<html>` element via `useEffect` to drive CSS variables.
- Provide context consumed by `app/page.tsx` and other components.

Update `app/layout.tsx` to wrap the root with `ThemeProvider`.

### 3. UI Toggle Component
**Changes in `app/page.tsx`:**
- Import `useTheme` and render a new control (likely next to debug toggle or above sliders) labeled "Dark mode" with a switch UI.
- UI element can reuse existing button styles or a new component (`components/ThemeToggle.tsx`). Requirements:
  - Display current state (icon or label, e.g., ☀️/🌙).
  - Keyboard accessible (`button` or `input type="checkbox"`).
  - Announce theme via `aria-pressed`/`aria-label`.
- Hook `onClick` to `toggleTheme`.

### 4. Canvas & SVG Styling Changes
**SvgPreview.tsx** must map theme tokens to actual stroke/fill values:
- Replace hard-coded `stroke="#8bc8ff"` etc. with props or theme context.
- Provide derived colors: `lineColor`, `anchorColor`, `backgroundColor`, `arrowFill`, `debugOverlayColor`.
- Ensure animation gradient / filters invert correctly (e.g., lighten vs dark background, drop shadow color flips).
- When `debugMode` is true, overlay grid/text uses theme-specific colors to remain visible.

**DownloadSvgButton.tsx / export helpers:**
- When serializing the SVG, inject the same colors used in preview. Accept theme values as props so exported file matches UI.
- Add tests or snapshots verifying color attributes switch with theme.

### 5. Ancillary UI Elements
Update all remaining UI primitives to consume tokens:
- Input fields, sliders, buttons inside `app/page.tsx` (borders, backgrounds, focus rings).
- `DebugOverlay.tsx` (line, text colors) to match theme tokens.
- Global text color (body, headings) to `var(--text-primary)`.

### 6. Persistence & SSR Safety
- `ThemeProvider` handles reading/writing `localStorage`. On initial SSR render, use a `useEffect` to sync the DOM attribute to avoid hydration mismatches. Consider inline script in `app/layout.tsx` to set `data-theme` before hydration (optional) to prevent flash.
- Provide fallback (if storage unavailable, default to dark).

### 7. Testing & QA Plan
- **Unit:** Add tests for `themeReducer`/helpers (if created) verifying toggling logic and persistence keys.
- **Visual:** Manual QA ensuring each control meets contrast in light mode (use Chrome dev tools). Confirm animation path remains visible.
- **Export parity:** Generate SVG in both themes, open in Illustrator/Figma verifying background/strokes invert.
- **Accessibility:** Run `npm run lint` + `npm run test` (if available) and optional `axe` browser scan to ensure color contrast >= 4.5:1.

---

## Development Effort Summary
| Area | Existing Code Changes | Net-new Development |
| --- | --- | --- |
| Styling | Replace literal colors in `app/globals.css`, `SvgPreview.tsx`, `DownloadSvgButton.tsx`, slider markup | Create two theme palettes, document tokens |
| State management | Inject `useTheme` into `app/page.tsx` and pass theme props down | Build `ThemeProvider`/context with persistence |
| UI controls | Add toggle markup to control stack | Possibly build `ThemeToggle` component with icons/animation |
| Export pipeline | Thread theme colors into serialization | Ensure new props + tests verifying color output |
| Testing | Update/regenerate snapshots | Write new tests for theme persistence |

---

## Rollout Considerations
1. **Feature flag** (optional): wrap ThemeToggle behind an environment flag for staged rollout.
2. **Documentation:** update `docs/reference/features` with usage notes once implemented.
3. **Telemetry:** if analytics exist, log theme toggles to gauge adoption.

---

## Open Questions
- Should light mode also invert typography weight or only color? (Recommendation: keep fonts identical.)
- Do exported SVGs embed both palettes (prefers-color-scheme) or single snapshot? (Currently single snapshot; confirm requirement.)
- Is there a design asset dictating exact light palette beyond simple inversion? Need designer approval.

---

By following the steps above we decouple presentation from logic, making future palette additions trivial while satisfying the requirement for a dark/light toggle with full parity between preview and exports.
