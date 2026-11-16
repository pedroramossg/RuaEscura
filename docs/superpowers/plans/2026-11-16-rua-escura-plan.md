# RuaEscura Front-end Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete, security-hardened, Apple HIG + `bejamas.com-DESIGN.md` mobile-first front-end PWA for **RuaEscura** (UFSC Trindade campus safe routing, lighting/QR post reporting, Gov.br-verified companion matching, and incident reporting).

**Architecture:** Client-side React 19 + TypeScript + Vite SPA/PWA with a reactive campus store persisted via Zod-validated `localStorage`, a weighted Dijkstra routing engine over real UFSC Trindade coordinates, a Leaflet interactive map layered with a resilient local SVG/GeoJSON campus overlay (working even offline), and a two-layer Liquid Glass + editorial canvas UI.

**Tech Stack:** React 19, TypeScript 5, Vite 6, Tailwind CSS v4, `leaflet`, `motion`, `zod`, `lucide-react`, `vitest`, `@testing-library/react`, `jsdom`.

**Spec:** `docs/superpowers/specs/2026-11-16-rua-escura-design.md`

## Global Constraints

- Design tokens from `bejamas.com-DESIGN.md`: canvas `#f3f3f4`, surface `#ffffff`, dark stage `#131314`, muted `#66646d`, mid-ink `#46444a`, hairline rule `#dfe3e6`, luminous lime `#befc65` (always paired with `#131314` ink); font stack `"NeueMontreal", "Inter", -apple-system, BlinkMacSystemFont, sans-serif` (weights 400–500 default, 600 micro-controls only); radii `9999px` capsules, `17.6px`–`24px` cards, `32px` sheets, `50%` circular badges.
- Semantic colors + accessibility: `#befc65`/`#15803d` (lit/safe), `#D97706`/`#FF9F0A` + `AlertTriangle` (`Oscilando`), `#D70015`/`#FF3B30` + `Flame`/`ShieldAlert` (`Queimado`/emergency); never convey state by color alone; min touch target `44×44px`; body text `>= 15px–17px`, absolute minimum `12px`.
- Liquid Glass discipline: apply `backdrop-filter: blur(24px) saturate(140%)` ONLY to floating functional controls (bottom dock, map search/filter bar, floating map controls), NEVER to content cards/lists/forms; honor `prefers-reduced-transparency`, `prefers-contrast: more`, and `prefers-reduced-motion`; max 1 prominent CTA per view; single sheet at a time (chat transitions inside the active sheet with a Back button).
- Haptics, Optimistic UI & Spatial Motion: `useHaptics()` (`light`, `medium`, `heavy`, `selection`, `success`, `warning`, `error`) + `active:scale-[0.97]` feedback; zero artificial blocking spinners on user mutations; `motion` springs (`bounce: 0, duration: 0.35` default; `bounce: 0.16` draggable sheet).
- Security (`Cortex/security.md` adaptation): Zero Trust Zod validation fail-fast on all inputs and `localStorage` hydration; reject `<`, `>`, `javascript:`, `data:` in user text inputs and render strictly as React plain text (zero `dangerouslySetInnerHTML`/`innerHTML`); validate uploaded evidence via MIME + `<= 5 MB` + Magic Bytes + `<canvas>` JPEG downscale (`<= 480px`) to strip EXIF; strict CSP `<meta>` allowing OSM/Carto tiles only; zero hardcoded secrets; `build.sourcemap: false`; masked CPF (`***.XXX.XXX-**`) with zero PII in `console.*`; `crypto.randomUUID()` IDs; simulated UFSC Security `(48) 3721-9555` / `190` emergency modal (no live `tel:190` calls).
- Ponytail discipline: no speculative abstractions, no unused configs/wrappers, concise focused files.

## Review Focus

- **Corrupted or tampered `localStorage` JSON / wrong schema shape:** `loadCampusState()` must safely catch `JSON.parse` errors and Zod failures and return the clean seed state without crashing the UI.
- **Spoofed file upload (`.exe`/HTML/SVG renamed to `.jpg` or > 5 MB):** `validateEvidenceImage()` must inspect binary Magic Bytes (not just file extension/MIME) and reject spoofed or oversized files before touching `<canvas>`.
- **XSS / HTML / `javascript:` payload in incident report or chat message:** `ReportSubmissionSchema` and `ChatMessageSchema` must fail fast with clear Portuguese validation messages instead of silently persisting or executing markup.
- **Invalid Brazilian CPF (e.g., `111.111.111-11` or wrong check digits) or malformed QR code:** `GovBrAuthSchema` and `QrCodeInputSchema` must reject repeated-digit CPFs, bad check digits, and arbitrary strings cleanly.
- **Disconnected/all-burned-out corridor fallback in `findRoute()`:** When every edge between two nodes has `Queimado` posts, `findRoute()` must still return the least-dark reachable path with accurate warning metadata instead of returning `null` or throwing.

---

## File Structure

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example` — project config, strict CSP, `sourcemap: false`.
- `src/index.css` — Bejamas design tokens, Liquid Glass utilities, `@media (prefers-reduced-motion)` / `(prefers-reduced-transparency)` / `(prefers-contrast: more)`.
- `src/types/campus.ts` — Core TypeScript interfaces (`CampusNode`, `CampusEdge`, `LampPost`, `CompanionMatch`, `IncidentReport`, `GovBrSession`, `PersistedCampusState`).
- `src/data/ufscTrindade.ts` — 14 real UFSC Trindade landmarks, graph edges, 8 QR lamp posts, 5 Gov.br verified companions, initial community reports.
- `src/engine/routing.ts` — Weighted Dijkstra (`brightest` vs `fastest`), dynamic penalties (`Queimado +100`, `Oscilando +25`, active report `+35`, community rating 1–5), coverage % calculator.
- `src/security/schemas.ts` — Zod schemas, `isValidCpf()`, `maskCpf()`, `sanitizeSafeText` guard (`<`, `>`, `javascript:`, `data:`).
- `src/security/fileValidation.ts` — Magic Bytes inspector (`JPEG`, `PNG`, `WEBP`), `<= 5 MB` check, `<canvas>` EXIF-stripping thumbnail generator (`<= 480px`, `<= 80 KB`).
- `src/security/storage.ts` — Zod-guarded `localStorage` load/save with quota handling and clean fallbacks.
- `src/hooks/useHaptics.ts` — Tactile feedback patterns + reduced-motion/user-toggle support.
- `src/hooks/useCampusStore.ts` — Central reactive state + optimistic mutations (report post, rate corridor, join/chat match, submit report, onboarding/auth, dual reset).
- `src/components/ui/` — `LiquidGlassSurface.tsx`, `PillButton.tsx`, `BottomSheet.tsx`, `FloatingTabBar.tsx`.
- `src/components/onboarding/OnboardingFlow.tsx` — 4-step conversion flow (Dark `#131314` stage, multi-intent centers, live Aha! preview, GPS pre-permission + Gov.br animated checklist).
- `src/components/explore/ExploreTab.tsx` — Editorial home hub.
- `src/components/map/` — `CampusMap.tsx`, `RouteControlsOverlay.tsx`, `RouteSheet.tsx`, `CompanionChatView.tsx`.
- `src/components/lights/LightsTab.tsx` — QR post scanner simulator + 1-tap optimistic post toggle + 1–5 corridor luminance voting.
- `src/components/reports/ReportsTab.tsx` — Simulated UFSC/190 emergency modal, Zod-validated report form with Magic-Bytes photo upload, confidential feed.
- `src/components/profile/ProfileSheet.tsx` — Masked Gov.br badge, haptics & night toggles, dual reset.
- `src/App.tsx`, `src/main.tsx` — App shell, tab state, global non-blocking toast feedback.
- `src/__tests__/` — `routing.test.ts`, `security.test.ts`, `app.test.tsx`.

---

### Task 1: Project Scaffold, CSP, Design System Tokens & UI Primitives

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `.env.example`
- Create: `src/index.css`, `src/hooks/useHaptics.ts`
- Create: `src/components/ui/LiquidGlassSurface.tsx`, `src/components/ui/PillButton.tsx`, `src/components/ui/BottomSheet.tsx`, `src/components/ui/FloatingTabBar.tsx`
- Create: `src/__tests__/ui.test.tsx`

**Interfaces:**
- Produces:
  - `useHaptics(): { enabled: boolean; setEnabled: (v: boolean) => void; trigger: (kind: HapticKind) => void }`
  - `LiquidGlassSurface({ variant, dark, className, children })`
  - `PillButton({ variant: 'lime' | 'ink' | 'glass' | 'danger' | 'outline', size?: 'compact' | 'feature', ...buttonProps })`
  - `BottomSheet({ detent: 'peek' | 'medium' | 'expanded', onDetentChange, dark, grabberLabel, children })`
  - `FloatingTabBar({ activeTab, onTabChange, alertCount })`

- [ ] **Step 1: Initialize `.gitignore`, `.env.example`, `package.json`, `tsconfig.json`, `vite.config.ts`, and `index.html`**
  - Configure Vite + React + Tailwind v4 (`@tailwindcss/vite`), `vitest` (`jsdom`), `build.sourcemap: false`, strict CSP meta tag in `index.html` (`default-src 'self'`, `img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com`, `style-src 'self' 'unsafe-inline'`, `script-src 'self'`), and Leaflet CSS imported cleanly via npm (`leaflet/dist/leaflet.css`).
- [ ] **Step 2: Run `npm install` and verify test runner boots**
  - Run: `npm install && npx vitest --version`
  - Expected: clean install with 0 missing peers and Vitest version printed.
- [ ] **Step 3: Write failing test `src/__tests__/ui.test.tsx`**
  - Assert `FloatingTabBar` renders exactly 4 tab buttons (`Explorar`, `Mapa`, `Postes`, `Denúncias`) with `aria-current="page"` on active tab and minimum `44px` hit target styling, and `BottomSheet` exposes a clickable grabber cycling detents (`peek` -> `medium` -> `expanded`).
- [ ] **Step 4: Run test to verify it fails**
  - Run: `npx vitest run src/__tests__/ui.test.tsx`
  - Expected: FAIL (`Cannot find module`).
- [ ] **Step 5: Implement `src/index.css`, `src/hooks/useHaptics.ts`, and `src/components/ui/*`**
  - Include Bejamas CSS tokens, Liquid Glass `.liquid-glass` / `.liquid-glass-dark` + accessibility media queries (`prefers-reduced-transparency`, `prefers-contrast: more`, `prefers-reduced-motion`).
  - `BottomSheet` supports both grabber tap and pointer drag with velocity projection (`motion` spring `bounce: 0.16, duration: 0.4`).
- [ ] **Step 6: Run test to verify it passes**
  - Run: `npx vitest run src/__tests__/ui.test.tsx`
  - Expected: PASS.
- [ ] **Step 7: Commit**
  - `git add -A && git commit -m "feat: scaffold Vite app, CSP, design tokens, and Apple UI primitives"`

---

### Task 2: UFSC Trindade Graph, Dijkstra Lighting Router & DevSecOps Validation (TDD)

**Files:**
- Create: `src/types/campus.ts`, `src/data/ufscTrindade.ts`, `src/engine/routing.ts`
- Create: `src/security/schemas.ts`, `src/security/fileValidation.ts`, `src/security/storage.ts`
- Create: `src/__tests__/routing.test.ts`, `src/__tests__/security.test.ts`

**Interfaces:**
- Produces:
  - `findRoute(originId: string, destinationId: string, mode: 'brightest' | 'fastest', posts: LampPost[], edgeRatings: Record<string, EdgeRatingSummary>, activeReports: IncidentReport[]): RouteResult`
  - `isValidCpf(cpf: string): boolean` and `maskCpf(cpf: string): string`
  - `GovBrAuthSchema`, `QrCodeInputSchema`, `LightRatingSchema`, `ReportSubmissionSchema`, `ChatMessageSchema`, `PersistedCampusStateSchema`
  - `validateEvidenceImage(file: File, stripExif?: (file: File) => Promise<string>): Promise<ValidatedEvidenceResult>`
  - `loadCampusState(storage?: Storage): PersistedCampusState` and `saveCampusState(state: PersistedCampusState, storage?: Storage): boolean`

- [ ] **Step 1: Write failing tests in `src/__tests__/routing.test.ts` and `src/__tests__/security.test.ts`**
  - `routing.test.ts`:
    - Tests `findRoute('bu', 'ru', 'brightest', ...)` chooses illuminated corridor over darker shortcut.
    - Tests marking a pole on the primary corridor as `Queimado` (`+100` penalty) causes `findRoute(..., 'brightest')` to automatically detour to an alternate lit path.
    - Tests `Oscilando` (`+25`), active report (`+35`), and community rating `1..5` update lighting percentage and route choice.
    - Tests fallback when ALL paths contain `Queimado` poles (returns least-dark route with `hasDarkWarning: true`, never `null`).
    - Tests `origin === destination` edge case cleanly.
  - `security.test.ts` (all 5 Review Focus attack vectors):
    - Rejects XSS `<script>alert(1)</script>`, `<img onerror=...>`, and `javascript:alert(1)` in `ReportSubmissionSchema` and `ChatMessageSchema`.
    - Rejects oversized strings (`> 500` chars report, `> 240` chars chat) and malformed QR codes (`../etc/passwd`, `POSTE-!@#`).
    - Rejects invalid CPFs (`111.111.111-11`, wrong check digits) and accepts valid check-digit CPF while `maskCpf` produces `***.456.789-**`.
    - `validateEvidenceImage` rejects `.exe`/HTML bytes disguised with `image/jpeg` MIME (`Magic Bytes` check) and rejects `> 5 MB` files; accepts valid JPEG/PNG/WEBP headers.
    - `loadCampusState` safely falls back to clean seed data when `localStorage` contains malformed JSON or schema-violating payloads (including prototype pollution keys).
- [ ] **Step 2: Run tests to verify they fail**
  - Run: `npx vitest run src/__tests__/routing.test.ts src/__tests__/security.test.ts`
  - Expected: FAIL (`Cannot find module`).
- [ ] **Step 3: Implement `src/types/campus.ts`, `src/data/ufscTrindade.ts`, and `src/engine/routing.ts`**
  - Real coordinates for the 14 UFSC Trindade landmarks from the satellite reference (`BU`, `RU`, `CCE`, `CSE`, `CCJ`, `CFH`, `Reitoria`, `Centro de Cultura e Eventos`, `Colégio de Aplicação`, `EPS`, `Fundação CERTI`, `HU`, `Bosque`, `Praça Santos Dumont`) and connected walkway edges + 8 QR lamp posts (`POSTE-BU-01`, `POSTE-RU-03`, `POSTE-CCE-02`, `POSTE-BOSQUE-04`, `POSTE-CCJ-01`, `POSTE-VITOR-02`, `POSTE-CSE-01`, `POSTE-CFH-02`).
- [ ] **Step 4: Implement `src/security/schemas.ts`, `src/security/fileValidation.ts`, and `src/security/storage.ts`**
  - Strict Zod validation, binary magic-byte header check (`0xFF 0xD8 0xFF`, `0x89 0x50 0x4E 0x47`, `RIFF....WEBP`), `<canvas>` downscale/re-encode to strip EXIF, safe `localStorage` wrapper.
- [ ] **Step 5: Run tests to verify they pass**
  - Run: `npx vitest run src/__tests__/routing.test.ts src/__tests__/security.test.ts`
  - Expected: PASS (all routing + attack tests green).
- [ ] **Step 6: Commit**
  - `git add src/types src/data src/engine src/security src/__tests__ && git commit -m "feat: add UFSC routing graph and Zero-Trust Zod/Magic-Bytes security layer"`

---

### Task 3: Reactive Campus Store & 4-Step Conversion Onboarding + Gov.br Gate

**Files:**
- Create: `src/hooks/useCampusStore.ts`, `src/components/onboarding/OnboardingFlow.tsx`
- Create: `src/__tests__/onboarding.test.tsx`

**Interfaces:**
- Consumes: `src/types/campus.ts`, `src/data/ufscTrindade.ts`, `src/engine/routing.ts`, `src/security/schemas.ts`, `src/security/storage.ts`, `src/hooks/useHaptics.ts`
- Produces: `CampusStoreProvider` & `useCampusStore()`, `OnboardingFlow()`

- [ ] **Step 1: Write failing test `src/__tests__/onboarding.test.tsx`**
  - Tests 4-step onboarding flow:
    - Step 1 dark stage renders outcome promise and `"Já tenho conta Gov.br"` shortcut jumping to Step 4.
    - Step 2 allows selecting multiple UFSC buildings, time slot, and map mode (`Sempre Noturno` sets `isNightMap: true`).
    - Step 3 shows live Aha! preview with verified companion count and % illumination BEFORE requiring login.
    - Step 4 validates CPF fail-fast, supports `"Preencher demo Gov.br"`, runs animated checklist, and completes onboarding cleanly into the main app.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/__tests__/onboarding.test.tsx`
  - Expected: FAIL.
- [ ] **Step 3: Implement `src/hooks/useCampusStore.ts` and `src/components/onboarding/OnboardingFlow.tsx`**
  - Optimistic mutations for `updateLampPostStatus`, `rateEdgeLighting`, `submitReport`, `toggleJoinCompanion`, `sendChatMessage`, `setRouteEndpoints`, `toggleNightMap`, `resetSessionOnly`, `resetAllDemoData`.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/__tests__/onboarding.test.tsx`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git add src/hooks/useCampusStore.ts src/components/onboarding src/__tests__/onboarding.test.tsx && git commit -m "feat: add reactive campus store and 4-step Gov.br conversion onboarding"`

---

### Task 4: Interactive UFSC Map (`Leaflet` + Vector Fallback), Route Comparison, Companions & In-Sheet Chat

**Files:**
- Create: `src/components/map/CampusMap.tsx`, `src/components/map/RouteControlsOverlay.tsx`, `src/components/map/RouteSheet.tsx`, `src/components/map/CompanionChatView.tsx`, `src/components/map/MapTab.tsx`
- Create: `src/__tests__/map.test.tsx`

**Interfaces:**
- Consumes: `useCampusStore()`, `LiquidGlassSurface`, `PillButton`, `BottomSheet`, `ChatMessageSchema`
- Produces: `MapTab({ onOpenReportsShortcut })`

- [ ] **Step 1: Write failing test `src/__tests__/map.test.tsx`**
  - Tests swapping Origin/Destination swaps endpoints and recalculates route; toggling `☾ Luz Noturna` switches night state; clicking `"Combinar trajeto"` transitions in-place to `CompanionChatView` inside the single active sheet (never rendering two stacked sheets) and clicking `Voltar` restores companion list; sending `<script>` in chat is blocked by Zod validation while safe text appends optimistically.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/__tests__/map.test.tsx`
  - Expected: FAIL.
- [ ] **Step 3: Implement `CampusMap.tsx`, `RouteControlsOverlay.tsx`, `RouteSheet.tsx`, `CompanionChatView.tsx`, `MapTab.tsx`**
  - `CampusMap.tsx` initializes Leaflet bounded to UFSC Trindade with OSM/Carto raster tiles + SVG vector campus footprint overlay (`BU`, `RU`, `CCE`, `CSE`, `CCJ`, `CFH`, `Bosque`, walkways) so campus landmarks and routes always render clearly even offline; `☾ Luz Noturna` applies dark nocturnal canvas `#131314`, glowing `#befc65` halos on active poles, and distinct status icons (`Zap`, `AlertTriangle`, `Flame`) for accessibility.
- [ ] **Step 4: Run test to verify it passes**
  - Run: `npx vitest run src/__tests__/map.test.tsx`
  - Expected: PASS.
- [ ] **Step 5: Commit**
  - `git add src/components/map src/__tests__/map.test.tsx && git commit -m "feat: implement interactive UFSC map, lighting routes, companions sheet, and chat"`

---

### Task 5: Explore Hub, QR Lamp Post Reporter, Incident Reports, Profile Sheet & App Shell

**Files:**
- Create: `src/components/explore/ExploreTab.tsx`, `src/components/lights/LightsTab.tsx`, `src/components/reports/ReportsTab.tsx`, `src/components/profile/ProfileSheet.tsx`
- Create: `src/App.tsx`, `src/main.tsx`
- Create: `src/__tests__/flows.test.tsx`

**Interfaces:**
- Consumes: `useCampusStore()`, `QrCodeInputSchema`, `LightRatingSchema`, `ReportSubmissionSchema`, `validateEvidenceImage`
- Produces: `App()` complete 4-tab shell + Profile sheet + toast notifications

- [ ] **Step 1: Write failing test `src/__tests__/flows.test.tsx`**
  - Tests:
    - `LightsTab`: scanning/selecting `POSTE-BU-01` and tapping `Queimado` immediately updates post status and updates route state optimistically.
    - `ReportsTab`: emergency button opens explicit confirmation dialog showing `(48) 3721-9555` and `190` (never directly dialing); valid report appends to community feed; XSS payload shows inline validation error.
    - `ProfileSheet`: displays masked CPF (`***.XXX.XXX-**`) and never raw digits; supports separate account reset vs full demo reset.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `npx vitest run src/__tests__/flows.test.tsx`
  - Expected: FAIL.
- [ ] **Step 3: Implement `ExploreTab.tsx`, `LightsTab.tsx`, `ReportsTab.tsx`, `ProfileSheet.tsx`, `App.tsx`, `main.tsx`**
  - Strict adherence to `bejamas.com-DESIGN.md` (`40px` index disks, `1px #dfe3e6` rules, `17.6px`/`24px` cards, `#befc65` primary capsule CTAs) and Apple HIG (`<= 1` prominent button per view, `44px` hit areas, single sheet discipline).
- [ ] **Step 4: Run full test suite + TypeScript + production build**
  - Run: `npx tsc --noEmit && npx vitest run && npm run build`
  - Expected: 0 TS errors, all tests passing, clean `dist/` without `.map` sourcemaps.
- [ ] **Step 5: Commit**
  - `git add src/components/explore src/components/lights src/components/reports src/components/profile src/App.tsx src/main.tsx src/__tests__/flows.test.tsx && git commit -m "feat: add Explore, QR lamp reporter, incident reports, profile sheet, and app shell"`

---

### Task 6: Final Security Audit, Apple Design Audit & Live Browser Verification

**Files:**
- Modify (if audit finds issues): targeted components/modules only

- [ ] **Step 1: Dispatch independent Apple Design Review (`dickwu-apple-design` + `emil-design-eng` + `claude-liquid-glass`) and Security Audit (`Cortex/security.md`)**
  - Fix any Critical/High/Important findings immediately and re-run `npx tsc --noEmit && npx vitest run && npm run build`.
- [ ] **Step 2: Verify production bundle has no sourcemaps or leaked secrets**
  - Run: `find dist -name "*.map"` (must be empty) and verify no hardcoded credentials/tokens.
- [ ] **Step 3: Live browser preview & visual inspection**
  - Run Vite dev/preview server and inspect all 4 tabs + onboarding + `☾ Luz Noturna` at mobile `390×844` and desktop `1280×800`.
- [ ] **Step 4: Final commit (if fixes applied)**
  - `git status` clean, all checks passing.

