# RuaEscura v2 Upgrade Implementation Plan

> **For agentic workers:** Follow Ponytail (minimum complete code, zero speculative bloat) and strict TDD where logic/security/rendering is non-trivial.

**Goal:** Upgrade RuaEscura with the `#0131CD`/`#FEF1CF`/`#B9FC01` palette, full `bloub` droplet mascot integration (all 15 animations), real OSM UFSC coordinates and sidewalk-following routes, satellite toggle, and client/build/edge performance + Zero-Trust hardening.

**Spec:** `/Users/pedroramos/Documents/DEV/RuaEscura/docs/superpowers/specs/2026-11-17-rua-escura-v2-upgrade.md`

## Global Constraints
- Palette tokens: Cobalt `#0131CD`, Warm Cream `#FEF1CF`, Volt Acid Lime `#B9FC01`, Deep Ink `#0B1226` (AA/AAA contrast >= 4.5:1 on all labels/CTAs).
- Mascot: MIT-licensed `jeremy-prt/bloub` engine with default `'goutte'` silhouette; all 15 animation states usable and actively mapped across onboarding and tabs; respects `prefers-reduced-motion`.
- Map integrity: Every UFSC landmark coordinate matches verified OSM Trindade locations; every `CampusEdge` has `waypoints` along real walkable paths; `LampPost` coordinates sit on edge midpoints.
- Security (`Cortex/security.md`): Zero `dangerouslySetInnerHTML`/`innerHTML`/`eval`, strict CSP allowing only `'self'`, `tile.openstreetmap.org`, and `server.arcgisonline.com`, fail-fast Zod validation (`webp|jpeg|png` base64 regex), `sourcemap: false`, zero runtime console leaks, masked CPF `***.XXX.XXX-**`.
- Ponytail: Keep files concise, avoid duplicate helpers, avoid unneeded npm packages.

---

### Task A: Port MIT `bloub` Droplet Engine & Build `DropletMascot` React Component
- Files: `src/mascot/bloub/*`, `src/components/mascot/DropletMascot.tsx`, `src/__tests__/mascot.test.tsx`.
- Verifies all 15 droplet states (`idle`, `thinking`, `wink`, `wide`, `alert`, `notify`, `exclaim`, `sleep`, `egg`, `hexagon`, `play`, `orbit`, `swirl`, `burst`, `comet`) render valid SVG body path + eyes/decorations and respect `prefers-reduced-motion`.

### Task B: Accurate OSM UFSC Landmarks, Sidewalk-Following Routes & Detailed Map Layers
- Files: `src/types/campus.ts`, `src/data/ufscTrindade.ts`, `src/engine/routing.ts`, `src/components/map/CampusMap.tsx`, `src/__tests__/routing.test.ts`.
- Uses verified `/tmp/ufsc-extracted.json` OSM coordinates & sidewalk polylines, preserves landmark IDs (`CTC/EPS` east vs `CCE` west), adds Esri World Imagery satellite option + RAF viewport sync + `React.memo`.

### Task C: Client/Edge Performance Engine, WebP EXIF Strip, Brotli/Gzip Build & Security Headers
- Files: `index.html`, `vite.config.ts`, `public/_headers`, `vercel.json`, `src/hooks/useDebounce.ts`, `src/utils/network.ts`, `src/utils/perfMonitor.ts`, `src/security/{fileValidation,schemas}.ts`, `src/components/ui/{Skeleton,VirtualizedList}.tsx`, `src/__tests__/perf.test.ts`, `src/__tests__/security.test.ts`.

### Task D: Cobalt/Cream/Volt Theme, Mascot-Guided Onboarding & Lazy Code-Split App Shell
- Files: `src/index.css`, `src/components/ui/{LiquidGlassSurface,PillButton,BottomSheet,FloatingTabBar}.tsx`, `src/components/onboarding/OnboardingFlow.tsx`, `src/App.tsx`, `src/__tests__/{ui,onboarding}.test.tsx`.

### Task E: Upgrade Feature Tabs (`ExploreTab`, `MapTab`, `RouteControlsOverlay`, `RouteSheet`, `LightsTab`, `ReportsTab`, `ProfileSheet`) & Live Browser QA
- Files: `src/components/explore/ExploreTab.tsx`, `src/components/map/{MapTab,RouteControlsOverlay,RouteSheet,CompanionChatView}.tsx`, `src/components/lights/LightsTab.tsx`, `src/components/reports/ReportsTab.tsx`, `src/components/profile/ProfileSheet.tsx`, `src/__tests__/{map,flows}.test.tsx`.
- Full verification (`tsc --noEmit`, `vitest run`, `npm run build` with `.br`/`.gz` & zero `.map`, live Chromium mobile `390×844` + Slow-3G + desktop `1280×800`).

