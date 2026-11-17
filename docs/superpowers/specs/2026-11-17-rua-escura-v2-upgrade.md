# RuaEscura v2 — Spec de Evolução Mobile, Mascote Gota (`bloub`), Paleta Cobalto/Creme/Volt, Mapa OSM Real e Performance

## 1. Direção Visual & Paleta (Nova Identidade)
- **Primária Cobalto (`#0131CD`)**: Palcos de abertura, selos Gov.br, barra ativa de navegação, acentos estruturais e contraste editorial.
- **Superfície Creme (`#FEF1CF`)**: Canvas principal claro e superfícies quentes combinadas com cartões `#FFFFFF` / `#FFF9EA`, bordas suaves `rgba(1,49,205,0.14)` e tinta escura `#0B1226`.
- **Volt Acid Lime (`#B9FC01`)**: CTAs capsulares principais, halos luminosos de postes acesos e destaques de rota segura (com texto `#0B1226` ou `#0131CD` garantindo contraste WCAG >= 7:1).
- **Modo Noturno do Mapa (`☾ Luz Noturna`)**: Mapa escuro (`#080E21`) com ruas filtradas, halos `#B9FC01`, e acentos `#0131CD` / `#B9FC01`.
- **Mobile Usability & Transições**: Fluxos responsivos sem overflow (`360×800`–`430×932`), alvos `>= 44×44px`, Liquid Glass apenas em controles flutuantes, `useReducedMotion()` em todas as transições entre abas e etapas.

## 2. Mascote Gota (`jeremy-prt/bloub`, MIT)
- Portar o motor geométrico puro TypeScript (`shape.ts` + `states.ts` + `expressions.ts` + `engine.ts` + `face.ts` + `eyefit.ts` + `decor.ts` + `profiles.ts` + `repere.ts` + `math.ts` + `gaze.ts`) para `src/mascot/bloub/`.
- Criar `DropletMascot.tsx` (React SVG com forma `'goutte'` por padrão), suporte a **todos os 15 estados** (`idle`, `thinking`, `wink`, `wide`, `alert`, `notify`, `exclaim`, `sleep`, `egg`, `hexagon`, `play`, `orbit`, `swirl`, `burst`, `comet`) e **16 expressões**, `follow` no ponteiro em desktop, e freeze determinístico sob `prefers-reduced-motion`.
- Integrar a gota como guia vivo no Onboarding (etapas 1–4) e em todas as abas (`Explorar`, `Mapa`, `Postes QR`, `Denúncias`, `Perfil`).

## 3. Mapa UFSC Trindade Real (OSM + Satélite) & Rotas em Ruas/Passarelas
- Atualizar [ufscTrindade.ts](file:///Users/pedroramos/Documents/DEV/RuaEscura/src/data/ufscTrindade.ts) com coordenadas reais extraídas da base OpenStreetMap de Trindade (`CTC/EPS` a leste `-27.600286, -48.517625`; `CCE` no centro-oeste `-27.600571, -48.521486`; `BU`, `RU`, `CFH`, `CSE`, `CCJ`, `Reitoria`, `Cultura`, `Aplicação`, `CERTI`, `HU`, `Bosque`, `Praça Santos Dumont`).
- Adicionar `waypoints: Coordinates[]` reais em cada `CampusEdge`, calculados sobre a malha de calçadas, passarelas (`footway`, `pedestrian`, `path`) e ruas da UFSC — nunca cortando pelo meio do mato — e posicionar os 8 postes QR exatamente nos pontos médios das passarelas/vias.
- Permitir alternar no mapa entre **OSM Detalhado (Ruas/Prédios)** e **Satélite (Esri World Imagery)** além do modo **Luz Noturna**.

## 4. Performance, Cache & Segurança Zero-Trust (`Cortex/security.md`)
- **Aplicados diretamente na PWA/Build/CDN:** `React.lazy` por página/aba com `Skeleton` shimmer, imagens WebP (`image/webp`) com remoção de EXIF e `loading="lazy"`, busca com `debounce`, paginação/virtualização de listas (`LightsTab`, `ReportsTab`), `React.memo` e throttle via `requestAnimationFrame` no mapa, deduplicação/timeout/paralelismo HTTPS-only (`network.ts`), compressão estática Gzip + Brotli (`.gz`/`.br`) no build sem dependências externas, headers imutáveis CDN + segurança em `public/_headers` e `vercel.json`, observador RUM Web Vitals + spans estilo OpenTelemetry locais (`perfMonitor.ts`), remoção de código morto.
- **Documentado (fora de escopo de PWA sem backend ativo):** camadas exclusivas de servidor/banco (`Redis`, `pool` SQL, `N+1`, filas/instâncias multi-nó e streaming SSE de IA).

