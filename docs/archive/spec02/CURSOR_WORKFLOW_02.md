# CURSOR_WORKFLOW_02 — React SVG Architecture

## Step 0 — Read SPEC_02_GITHUB.md

---

## Step 1 — Layout
- Set background: black (#000)
- Font: Times New Roman
- Body: 100vh
- Centered main area
- Create `.svg-wrapper` class

---

## Step 2 — Types + Semantic
Create:
- `types.ts`
- `seed.ts`
- `semantic.ts`

Implement:
- Axes
- KeywordVec
- Point
- Connection
- BranchedConnection
- fallbackAxes()
- getAxesForKeyword()

Use:
- `semantic/semantic-map.json`

---

## Step 3 — Geometry
Implement in `geometry.ts`:
- projectHex()
- cluster() with mutamento slider
- buildConnections() (MST + extra connections)
- computeCurveControl()
- branchAtIntersections()

---

## Step 4 — SVG Rendering (NEW)
Create:
- `SvgPreview.tsx`

Features:
- `<svg viewBox="0 0 1080 1080">`
- `<defs>` arrow marker
- `<line>` and `<path>`
- curved vs straight
- dashed lines
- clamping to canvas
- responsive wrapper

---

## Step 5 — Export SVG
Create:
- `generateSvg.ts`

Function:
- Mirror EXACT output of SvgPreview
- Produce valid XML SVG string
- Download via Blob

---

## Step 6 — UI Assembly
Implement:
- Keywords input
- Sliders
- Generate button
- SvgPreview inside `.svg-wrapper`

---

## Step 7 — Permalink
Serialize:
- Keywords
- Sliders
- Seed
Into URL.

---

## Step 8 — Gemini API Route (optional future)
Add:
- `app/api/semantic/route.ts`
Use:
- Gemini 2.5 Flash
- `process.env.GEMINI_API_KEY`

---

## Step 9 — Deployment
Deploy to Vercel.
Ensure:
- GEMINI_API_KEY added to environment variables (if used).
