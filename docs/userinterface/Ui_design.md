# UI Design Documentation

## Overview
This document provides a comprehensive inventory of all UI components, elements, and styles used in the SFCM Symbol Generator application.

---

## React Components

### Located in `/components` directory

#### 1. `SvgPreview.tsx`
**Purpose:** Main SVG rendering component  
**Features:**
- Renders connections (lines/curves) with animation support
- Handles arrowhead rendering with explicit geometry
- Supports debug overlay integration
- Tracks animation phases (forward, pause, vanishing)
- Manages connection sorting by generation depth

**Key Props:**
- `connections: BranchedConnection[]`
- `animationEnabled?: boolean`
- `animationProgress?: number` (0..1)
- `canvasWidth: number`
- `canvasHeight: number`
- `debugInfo?: EngineV2DebugInfo`
- `debugMode?: boolean`

---

#### 2. `DownloadSvgButton.tsx`
**Purpose:** Download button component for SVG export  
**Features:**
- Triggers SVG file download
- Exports prepared SVG with finalized geometry
- Conditional rendering based on connections availability

**Key Props:**
- `connections: BranchedConnection[]`
- `canvasWidth: number`
- `canvasHeight: number`

**CSS Class:** `secondary-button`

---

#### 3. `DebugOverlay.tsx`
**Purpose:** Visual debug layer for ENGINE_V2  
**Features:**
- Canvas quadrant lines (vertical/horizontal at center)
- Primary anchor point visualization with crosshairs
- Keyword anchor points with labels
- Bounding box display
- Mirror axis visualization
- Direction clustering visualization
- Real-time generation telemetry display

**Key Props:**
- `width: number`
- `height: number`
- `anchor?: Point`
- `anchors?: KeywordAnchorDebug[]`
- `bbox?: GeometryBoundingBox`
- `mirrorAxisSegment?: { x1, y1, x2, y2 }`
- `directionClusters?: DirectionClusterDebug[]`
- `clusterCount?: number`
- `clusterSpread?: number`
- `gamma?: number`
- `realtimeGeneration?: RealtimeGenerationDebug`

---

## Page Component (`app/page.tsx`)

### Layout Structure

#### `page-shell`
**CSS Class:** `.page-shell`  
**Purpose:** Outer container for the entire page  
**Properties:**
- Full-height layout wrapper
- Centered content alignment
- Background: `#f6f6f4`
- Padding: `40px 32px`

---

#### `layout-main`
**CSS Class:** `.layout-main`  
**Purpose:** Main grid layout container  
**Properties:**
- Two-column CSS Grid
- Max-width: `1440px`
- Column 1: `minmax(360px, 460px)` (controls panel)
- Column 2: `minmax(0, 1fr)` (preview panel)
- Gap: `48px`
- Align-items: `start`

---

### Controls Panel (`controls-panel`)

#### Brand Block
**CSS Classes:**
- `.brand-block` — Container
- `.brand-kicker` — "STUDIO for" text
- `.brand-title` — "COSMOPOLITICAL MODELS" heading

**Structure:**
```tsx
<div className="brand-block">
  <p className="brand-kicker">STUDIO for</p>
  <h1 className="brand-title">COSMOPOLITICAL MODELS</h1>
</div>
```

**Styling:**
- Brand kicker: `0.95rem`, uppercase, `0.08em` letter-spacing
- Brand title: `2.4rem`, `0.06em` letter-spacing, `line-height: 1.1`
- Gap: `8px` between elements

---

#### Form Fields

##### Keywords Input
**CSS Classes:**
- `.field-group` — Input group container
- `.field-label` — Label styling
- `.text-input` — Textarea styling

**Structure:**
```tsx
<div className="field-group">
  <label htmlFor="keywords" className="field-label">
    Keywords separate dalla virgola
  </label>
  <textarea
    id="keywords"
    className="text-input"
    placeholder="Azione, impronta, specifico"
  />
</div>
```

**Styling:**
- Label: `1rem`, `0.04em` letter-spacing
- Textarea: `#f0f0f0` background, `#dcdcdc` border, `6px` border-radius, `12px` padding, `84px` min-height, vertically resizable

---

#### Sliders (`slider-stack`)

**CSS Classes:**
- `.slider-stack` — Container for all sliders
- `.slider-row` — Individual slider row
- `.field-label` — Slider label

**Sliders:**

1. **Line Length** (`lineLength`)
   - ID: `lineLength`
   - Range: `0-100`
   - Default: `50`
   - Controls: `lengthScale` in ENGINE_V2

2. **Curvature** (`curvature`)
   - ID: `curvature`
   - Range: `0-100`
   - Default: `50`
   - Controls: `curvatureScale` in ENGINE_V2

3. **Cluster Count** (`clusterCount`)
   - ID: `clusterCount`
   - Range: `0-100`
   - Default: `33`
   - Controls: `clusterCount` in ENGINE_V2
   - Maps to: `2 + (value/100) * 3` clusters

4. **Cluster Spread** (`clusterSpread`)
   - ID: `clusterSpread`
   - Range: `0-100`
   - Default: `40`
   - Controls: `clusterSpread` in ENGINE_V2
   - Maps to: `10 + (value/100) * 50` degrees

**Structure:**
```tsx
<div className="slider-stack">
  <div className="slider-row">
    <label htmlFor="lineLength" className="field-label">
      Lunghezza linee
    </label>
    <input id="lineLength" type="range" min="0" max="100" step="1" />
  </div>
  {/* ... other sliders ... */}
</div>
```

**Styling:**
- Slider stack: `18px` gap between rows
- Slider row: `8px` gap between label and input
- Range input: `100%` width, accent color `#0b0b0b`

---

#### Toggles

##### Force Orientation Toggle
**CSS Classes:**
- `.toggle-row` — Container
- `.field-label.inline` — Inline label with checkbox
- `.helper-text` — Description text

**Structure:**
```tsx
<div className="toggle-row">
  <label className="field-label inline">
    <input type="checkbox" checked={forceOrientation} />
    Force orientation
  </label>
  <span className="helper-text">
    Ruota di 90° clockwise se il bounding box pre-mirroring è più alto che largo.
  </span>
</div>
```

**Styling:**
- Toggle row: `6px` gap between elements
- Inline label: `0.95rem`, flex display, `8px` gap
- Helper text: `0.85rem`, `#555555` color

---

##### Toggle Grid
**CSS Classes:**
- `.toggle-grid` — Grid container
- `.field-label.inline` — Inline label with checkbox

**Checkboxes:**
1. **Animation** — Toggles line animation loop
2. **Debug Mode** — Toggles debug overlay display
3. **Real-time Preview** — Toggles real-time generation (conditional enable based on `REAL_TIME_GENERATION_FLAG`)

**Structure:**
```tsx
<div className="toggle-grid">
  <label className="field-label inline">
    <input type="checkbox" checked={animationEnabled} />
    Animazione
  </label>
  {/* ... other checkboxes ... */}
</div>
```

**Styling:**
- Grid: `repeat(auto-fit, minmax(160px, 1fr))`, `8px 12px` gap
- Labels: `0.95rem`, inline-flex, `8px` gap

---

#### Status Display

##### Real-time Hint
**CSS Classes:**
- `.realtime-hint` — Main status box
- `.realtime-meta` — Metadata text

**Structure:**
```tsx
{realtimeFeatureActive && hasGeneratedAtLeastOnce && (
  <div className="realtime-hint">
    <div>{realtimeIndicatorText}</div>
    {realtimeIndicatorMeta && (
      <div className="realtime-meta">{realtimeIndicatorMeta}</div>
    )}
  </div>
)}
```

**Styling:**
- Real-time hint: `#f0f0f0` background, `#dcdcdc` border, `6px` border-radius, `10px 12px` padding, `0.9rem` font
- Real-time meta: `0.85rem`, `#555555` color

**Content:**
- Status text: Shows generation status or last update duration
- Metadata: Throttle hits and skipped renders count

---

#### Action Buttons (`action-row`)

**CSS Classes:**
- `.action-row` — Button container
- `.primary-button` — Primary action button
- `.secondary-button` — Secondary action button

**Buttons:**
1. **Generate** (`.primary-button`)
   - Label: "Genera" / "Generazione in corso..." / "Anteprima in tempo reale..."
   - Disabled state: when `isGenerating` is true
   - Triggers: `handleGenerate()`

2. **Download SVG** (`.secondary-button`)
   - Conditional rendering: shows `DownloadSvgButton` component when connections available
   - Disabled state: when no connections available
   - Fallback: disabled button with same styling

**Structure:**
```tsx
<div className="action-row">
  <button onClick={handleGenerate} disabled={isGenerating} className="primary-button">
    {generationButtonLabel}
  </button>
  {connectionsAvailable ? (
    <DownloadSvgButton {...props} />
  ) : (
    <button className="secondary-button" disabled>
      Download SVG
    </button>
  )}
</div>
```

**Styling:**
- Action row: `12px` gap, flex display, aligned center
- Primary/Secondary buttons:
  - Padding: `12px 18px`
  - Border: `1px solid #0b0b0b`
  - Background: `#ffffff`
  - Color: `#0b0b0b`
  - Font: `1rem`, `0.03em` letter-spacing
  - Transition: `background 0.2s ease, color 0.2s ease`
  - Hover: `#0b0b0b` background, `#ffffff` color
  - Disabled: `0.5` opacity, `not-allowed` cursor

---

### Preview Panel (`preview-panel`)

**CSS Classes:**
- `.preview-panel` — Preview container
- `.preview-placeholder` — Placeholder text
- `.svg-wrapper` — SVG container (used inside SvgPreview)
- `.svg-preview` — SVG element

**Structure:**
```tsx
<div className="preview-panel">
  {connectionsAvailable ? (
    <SvgPreview {...props} />
  ) : (
    <div className="preview-placeholder">
      Genera per vedere l&apos;anteprima
    </div>
  )}
</div>
```

**Styling:**
- Preview panel:
  - Background: `#ffffff`
  - Border: `1px solid #dcdcdc`
  - Min-height: `620px`
  - Flex display, centered content
  - Padding: `20px`
- Preview placeholder: `1rem`, `#777777` color
- SVG wrapper:
  - Background: `#ffffff`
  - Border: `1px solid #dcdcdc`
  - Padding: `16px`
- SVG preview:
  - Max-width/height: `min(100vw, 100vh)`
  - Aspect-ratio: `1 / 1`
  - Block display

---

## CSS Classes Reference

### Layout Classes
- `.app-root` — Root application container
- `.page-shell` — Page outer wrapper
- `.layout-main` — Main grid layout
- `.controls-panel` — Left column controls container
- `.preview-panel` — Right column preview container

### Brand Classes
- `.brand-block` — Brand container
- `.brand-kicker` — Brand subtitle/kicker text
- `.brand-title` — Main brand heading

### Form Classes
- `.field-group` — Form field container
- `.field-label` — Label styling (base)
- `.field-label.inline` — Inline label with checkbox
- `.text-input` — Textarea input styling

### Slider Classes
- `.slider-stack` — Slider container
- `.slider-row` — Individual slider row

### Toggle Classes
- `.toggle-row` — Toggle with helper text
- `.toggle-grid` — Grid of checkboxes
- `.helper-text` — Helper/description text

### Button Classes
- `.primary-button` — Primary action button
- `.secondary-button` — Secondary action button
- `.action-row` — Button container row

### Status/Info Classes
- `.realtime-hint` — Real-time generation status box
- `.realtime-meta` — Real-time metadata text

### SVG Classes
- `.svg-wrapper` — SVG container wrapper
- `.svg-preview` — SVG preview element
- `.preview-placeholder` — Empty state placeholder

---

## Color Palette

### Background Colors
- Page background: `#f6f6f4` (light beige)
- Panel background: `#ffffff` (white)
- Input background: `#f0f0f0` (light gray)
- Hint/Status background: `#f0f0f0` (light gray)

### Text Colors
- Primary text: `#0b0b0b` (near black)
- Secondary text: `#555555` (medium gray)
- Placeholder text: `#777777` (darker gray)

### Border Colors
- Primary border: `#dcdcdc` (light gray)
- Input border: `#dcdcdc` (light gray)
- Button border: `#0b0b0b` (near black)

### SVG Colors
- Stroke color: `#0b0b0b` (near black)
- Background color: `#ffffff` (white)

---

## Typography

### Font Family
- Primary: `"Times New Roman", serif`

### Font Sizes
- Brand kicker: `0.95rem`
- Brand title: `2.4rem`
- Field labels: `1rem`
- Inline labels: `0.95rem`
- Helper text: `0.85rem`
- Button text: `1rem`
- Real-time hint: `0.9rem`
- Real-time meta: `0.85rem`
- Placeholder: `1rem`

### Letter Spacing
- Brand kicker: `0.08em`
- Brand title: `0.06em`
- Field labels: `0.04em`
- Button text: `0.03em`

---

## Spacing & Layout

### Grid Layout
- Max-width: `1440px`
- Columns: `minmax(360px, 460px) | minmax(0, 1fr)`
- Gap: `48px`

### Padding
- Page shell: `40px 32px`
- Controls panel: `20px` gap between elements
- Preview panel: `20px`
- Text input: `12px`
- Real-time hint: `10px 12px`
- SVG wrapper: `16px`

### Gaps
- Brand block: `8px`
- Field group: `8px`
- Slider stack: `18px`
- Slider row: `8px`
- Toggle row: `6px`
- Toggle grid: `8px 12px`
- Action row: `12px`

---

## Component Hierarchy

```
app-root (layout.tsx)
└── page-shell
    └── layout-main
        ├── controls-panel
        │   ├── brand-block
        │   │   ├── brand-kicker
        │   │   └── brand-title
        │   ├── field-group (keywords)
        │   │   ├── field-label
        │   │   └── text-input
        │   ├── slider-stack
        │   │   └── slider-row × 4
        │   │       ├── field-label
        │   │       └── input[type="range"]
        │   ├── toggle-row (force orientation)
        │   │   ├── field-label.inline
        │   │   └── helper-text
        │   ├── toggle-grid
        │   │   └── field-label.inline × 3
        │   ├── realtime-hint (conditional)
        │   │   ├── status text
        │   │   └── realtime-meta
        │   └── action-row
        │       ├── primary-button
        │       └── secondary-button / DownloadSvgButton
        └── preview-panel
            ├── SvgPreview (conditional)
            │   └── svg-wrapper
            │       └── svg-preview
            └── preview-placeholder (conditional)
```

---

## State Management

### UI State Variables (in `app/page.tsx`)

- `keywords: string` — User input keywords
- `lineLengthSlider: number` (0-100) — Line length control
- `curvatureSlider: number` (0-100) — Curvature control
- `clusterCountSlider: number` (0-100) — Cluster count control
- `clusterSpreadSlider: number` (0-100) — Cluster spread control
- `forceOrientation: boolean` — Force orientation toggle
- `animationEnabled: boolean` — Animation toggle
- `debugMode: boolean` — Debug mode toggle
- `realtimePreviewEnabled: boolean` — Real-time preview toggle
- `isGenerating: boolean` — Generation in progress
- `animationProgress: number` (0-1) — Animation progress
- `connections: BranchedConnection[]` — Generated connections
- `debugInfo: EngineV2DebugInfo | undefined` — Debug information

---

## Notes

### Real-time Generation
- Real-time preview requires `REAL_TIME_GENERATION_FLAG` environment variable
- Status display only shows when feature is active and at least one generation has occurred
- Real-time updates are throttled to ~60Hz (`REAL_TIME_MIN_INTERVAL_MS = 16`)

### Animation Loop
- Three-phase animation: forward → pause → forward-vanishing
- Arrowhead visibility tracked during vanishing phase
- Progress ranges from 0 (start) to 1 (full length)

### Responsive Design
- Grid layout adapts with `minmax()` constraints
- Slider stack and toggle grid use flexible layouts
- SVG preview maintains 1:1 aspect ratio

---

## Future Considerations

### Potential UI Improvements
- Mobile responsive breakpoints
- Keyboard navigation support
- Slider value display (current values)
- Tooltips for helper text
- Loading states for generation
- Export format options (SVG, PNG, etc.)

### Accessibility
- ARIA labels for interactive elements
- Keyboard shortcuts for common actions
- Focus states for all interactive elements
- Screen reader support for dynamic content

