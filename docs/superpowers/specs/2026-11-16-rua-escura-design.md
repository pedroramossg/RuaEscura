# RuaEscura — Especificação de Design e Arquitetura Front-end (UFSC Trindade)

**Data:** 2026-11-16  
**Abordagem escolhida:** Opção A (Mapa Real Interativo com Leaflet + OpenStreetMap/Carto + camada vetorial local de resiliência UFSC) + Direção Visual C (Híbrida Adaptativa: Onboarding no palco escuro `#131314`/`#befc65` → App principal claro `#f3f3f4` com toggle instantâneo `☾ Luz Noturna`).

---

## 1. Intenção, Público e Diretrizes

- **Problema:** Estudantes da UFSC Campus Trindade se deslocam entre centros de ensino, Biblioteca Universitária (BU), Restaurante Universitário (RU), pontos de ônibus e entorno (`Praça Santos Dumont`, `R. Des. Vítor Lima`, `Av. César Seara`) à noite, enfrentando trechos escuros, postes queimados e insegurança ao caminhar sozinhos.
- **Solução Front-end:** PWA / Web App mobile-first (`390×844` como referência principal, adaptável a desktop) com mapa real do campus, roteamento ponderado por índice de iluminação, pareamento com estudantes verificados via Gov.br fazendo o mesmo trajeto, reporte de postes queimados via QR Code com atualização instantânea do mapa e canal seguro de denúncias.
- **Diretrizes combinadas:**
  - **Tokens `bejamas.com-DESIGN.md`:**
    - Canvas leitura/app claro: `#f3f3f4`, superfícies elevadas: `#ffffff`, ink primário: `#131314`, texto secundário: `#46444a` / `#66646d`, regras 1px: `#dfe3e6`.
    - Acento primário & iluminação ativa: `#befc65` (verde-lima luminoso, sempre com texto `#131314` para contraste >= 12:1).
    - Tipografia: `"NeueMontreal", "Inter", -apple-system, BlinkMacSystemFont, sans-serif`; pesos `400`–`500` em títulos e leitura, `600` apenas em micro-controles móveis; corpo >= `15px–17px`, mínimo absoluto `12px`.
    - Raios: cápsulas `9999px`, cards/mídia `17.6px`–`24px`, bottom sheets `32px`, badges circulares `50%`.
  - **Paleta Semântica e Modo Noturno do Mapa `[Decisão]`:**
    - **Camada Semântica (Apple HIG `color.md` + `accessibility.md`):** `#befc65` / `#15803d` (rota segura / poste aceso), `#D97706` / `#FF9F0A` (poste oscilando + ícone `AlertTriangle`), `#D70015` / `#FF3B30` (poste queimado / emergência + ícone `Flame` / `ShieldAlert`). Informação nunca depende só da cor.
    - **Escopo de `☾ Luz Noturna` e `"Sempre Noturno"` `[Decisão]`:** A alternância `☾ Luz Noturna` atua no **mapa e seus controles flutuantes** (tiles escuros + fundo `#131314`, halos `#befc65` nos postes, folha de mapa em `#1c1c1e` com texto `#f3f3f4` e borda `#2e2e32`), mantendo as abas editoriais (`Explorar`, `Postes`, `Denúncias`) no canvas `#f3f3f4`/`#ffffff` de alta legibilidade. Escolher `"Sempre Noturno"` no Onboarding inicia o mapa já com `☾ Luz Noturna` ativado.
  - **Apple HIG + Liquid Glass:**
    - Separação estrita: **Camada de Conteúdo** opaca (sem glass em listas, cards ou formulários) e **Camada Funcional Flutuante** com Liquid Glass CSS (`backdrop-filter: blur(24px) saturate(140%)`, borda especular `rgba(255,255,255,0.45)`) apenas na Tab Bar flutuante, barra de busca flutuante e botões sobre o mapa.
    - Alvos mínimos `44×44px`, no máximo 1 CTA proeminente por visão, fallback sólido para `prefers-reduced-transparency` e `prefers-contrast: more`.
  - **Hápticos, UI Otimista e Continuidade Espacial:**
    - `useHaptics()`: padrões `light`, `medium`, `heavy`, `selection`, `success`, `warning`, `error` (`navigator.vibrate` + resposta visual `active:scale-[0.97]` em `120ms ease-out`), respeitando `prefers-reduced-motion` e preferência do usuário no Perfil.
    - **Optimistic UI:** toda ação (reportar poste, votar iluminação, entrar em trajeto, enviar mensagem, enviar denúncia) reflete imediatamente na UI e no mapa sem spinners bloqueantes.
    - **Continuidade Espacial:** transições em mola (`motion`, criticamente amortecidas `bounce: 0`, `duration: 0.35s`; detents de sheet com `bounce: 0.16`), originando de onde o usuário tocou.
  - **Ponytail (YAGNI & Simplicidade):** Estado reativo único + `localStorage` validado, sem abstrações especulativas ou backend falso complexo.

---

## 2. Diretrizes de Segurança DevSecOps (`Cortex/security.md` aplicadas ao Front-end)

Como `Cortex/security.md` é referência externa ao repositório, os controles aplicáveis ao front-end ficam fixados aqui:

1. **Zero Trust & Validação Fail-Fast (Zod):** Toda entrada de formulário e **toda leitura do `localStorage`** passam por schemas `zod` com limites explícitos de comprimento, enums e formatos. Dados inválidos ou corrompidos no `localStorage` são descartados com fallback seguro para o seed inicial.
2. **Prevenção estrita de XSS `[Decisão]`:** Rejeição fail-fast na validação Zod de caracteres HTML perigosos (`<`, `>`) e esquemas `javascript:` / `data:` em textos livres (`ReportSubmissionSchema`, `ChatMessageSchema`, `GovBrAuthSchema`), além de renderização 100% em texto puro React (proibido `dangerouslySetInnerHTML` e `innerHTML`).
3. **Upload Seguro de Evidência em Denúncias `[Decisão]`:**
   - Validação de MIME type permitido (`image/jpeg`, `image/png`, `image/webp`), tamanho <= `5 MB` e **verificação de Magic Bytes** no buffer binário (`FFD8FF`, `89504E47`, `52494646...57454250`) em `fileValidation.ts`.
   - Para evitar `QuotaExceededError` no `localStorage` e **remover metadados EXIF sensíveis (GPS/dispositivo)** em denúncias confidenciais, a imagem validada é re-codificada via `<canvas>` para miniatura JPEG <= `480px` antes de persistir metadados + preview seguro (nunca armazenando o arquivo bruto de 5 MB).
4. **CSP e Whitelist de Origens `[Decisão]`:** `<meta http-equiv="Content-Security-Policy">` no `index.html` permitindo apenas `'self'`, tiles `https://*.tile.openstreetmap.org` e `https://*.basemaps.cartocdn.com`, e imagens `'self' data: blob:` (fontes locais/sistema sem CDN de terceiros arbitrária).
5. **Privacidade, PII & Segredos:** Zero tokens/segredos no código ou bundle; `build.sourcemap: false` no Vite; CPF validado pelos 2 dígitos verificadores e armazenado/exibido apenas mascarado (`***.456.789-**`); zero logs de console com PII; identificadores gerados por `crypto.randomUUID()` (nunca IDs sequenciais).

---

## 3. Não-Objetivos (Escopo Delimitado)

- Sem servidor/API remota nesta etapa (estado local reativo + `localStorage`).
- Sem OAuth real Gov.br nem acesso real à câmera nativa (scanner QR e fluxo Gov.br são simulados interativamente).
- Sem discagem real automática para emergência (`190`): o botão de emergência exibe confirmação segura com o telefone real da Segurança UFSC `(48) 3721-9555` e registro simulado no app para evitar acionamentos acidentais em demos/QA `[Decisão]`.

---

## 4. Fluxo de Onboarding (Conversão & Confiança)

1. **Etapa 1 — Palco Escuro (`#131314` + arco `#befc65`):**  
   Promessa direta (*"Caminhe pela UFSC no claro. E acompanhado."*) + animação vetorial da rota do campus se iluminando. CTA `#befc65` `"Começar meu trajeto →"` e atalho `"Já tenho conta Gov.br"` (que pula direto para a Etapa 4 com centros padrão `BU`, `RU`, `CCE` `[Decisão]`).
2. **Etapa 2 — Personalização Multi-Intenção:**  
   Seleção de múltiplos prédios/centros frequentes (`BU`, `RU`, `CCE`, `CSE`, `CCJ`, `CFH`, `Reitoria`, `Bosque`, `HU`, `Pista de Atletismo`), faixa de horário (`17h–19h`, `19h–21h`, `21h–23h`) e modo inicial do mapa (`Claro + Modo Noturno` ou `Sempre Noturno`).
3. **Etapa 3 — *Aha! Moment* ao Vivo (Antes do Login):**  
   Preview imediato entre os dois principais pontos selecionados mostrando colegas verificados naquele horário e % do corredor iluminado.
4. **Etapa 4 — Pré-Permissão GPS (`privacy.md`) + Gov.br Trust Gate:**  
   - Pré-tela clara com único botão `"Continuar para localização"` (fallback automático para coordenadas da UFSC Trindade se negado).
   - Validação Gov.br: nome, vínculo UFSC e CPF (com validação real de dígitos + botão `"Preencher demo Gov.br"` para teste rápido), seguida de checklist animado em 3 etapas (*Identidade Gov.br → Vínculo UFSC → Selo Verificado*).
   - Após concluído, não reaparece ao recarregar; acessível apenas pelo Perfil.

---

## 5. Arquitetura de Telas & Navegação

Tab Bar flutuante única em **Liquid Glass** no rodapé (4 abas puras de navegação, rótulos de 1 palavra, ícones preenchidos quando ativos):

1. **Explorar (`ExplorarTab`):**
   - Saudação editorial + selo Gov.br + botão de avatar (abre Sheet de Perfil).
   - Pílula de busca rápida que leva direto ao **Mapa** já com destino focado.
   - Card **"Seu corredor agora"** com resumo ao vivo (postes ativos/queimados, colegas no campus) + botão para abrir rota salva.
   - Carrossel horizontal de trajetos seguros (`BU → Praça Santos Dumont`, `RU → CCE`, `CSE → R. Des. Vítor Lima`, `CFH → Av. César Seara`).
   - Lista editorial com linhas `1px #dfe3e6` e discos numerados `40px` com últimas atualizações de iluminação.
2. **Mapa (`MapTab`):**
   - **Mapa Leaflet real** travado nos limites da UFSC Trindade (`-27.6065, -48.5265` a `-27.5955, -48.5125`) com tiles OSM/Carto **mais** camada vetorial SVG/GeoJSON local dos prédios e caminhos do campus (garante 100% de usabilidade mesmo se tiles externos falharem ou offline `[Decisão]`).
   - **Controles flutuantes Liquid Glass no topo:** seletor Origem/Destino com troca rápida, chips de filtro (`Colegas`, `Postes`, `Zonas Escuras`) e botão **`☾ Luz Noturna`**.
   - **Motor de Grafo (`src/engine/routing.ts`) `[Decisão]`:**
     - Calcula `Mais Iluminada` vs `Mais Rápida` sobre o grafo real dos caminhos da UFSC.
     - Pesos reativos: poste `Queimado` (`+100` penalidade na aresta, forçando desvio quando há alternativa), poste `Oscilando` (`+25`), nota média comunitária `1–5` do trecho e denúncias ativas recentes no nó (`+35`).
   - **Bottom Sheet único com detents** (`peek` / `medium` / `expanded` e grabber):
     - Comparativo `Mais Iluminada` vs `Mais Rápida` (minutos, metros, % iluminada).
     - Lista de **Estudantes Verificados Gov.br** no mesmo trajeto + botão `"Combinar trajeto"`.
     - **Chat do Trajeto (`sheets.md`: um único sheet por vez `[Decisão]`):** clicar em `"Combinar trajeto"` faz transição **interna** no mesmo sheet (com botão `Voltar` para os detalhes da rota) exibindo o chat rápido com sugestões seguras.
3. **Postes (`LightsTab`):**
   - **Simulador de QR Code de Poste:** visor estilizado + chips rápidos dos postes do campus (`POSTE-BU-01`, `POSTE-RU-03`, `POSTE-CCE-02`, `POSTE-BOSQUE-04`, `POSTE-CCJ-01`, `POSTE-VITOR-02`) + entrada manual validada por Zod.
   - **Atualização Otimista em 1 toque:** alternar poste para `Aceso`, `Oscilando` ou `Queimado` dispara háptico, atualiza o pino no mapa e recalcula automaticamente as rotas ativas.
   - **Avaliação de iluminação por trecho (`1` a `5`):** altera diretamente a pontuação do corredor no grafo.
4. **Denúncias (`ReportsTab`):**
   - **Botão de Emergência** (confinado a esta aba e um atalho discreto no cabeçalho do mapa) com diálogo de confirmação explícito exibindo **Segurança UFSC `(48) 3721-9555`** e **190** (disparo simulado na demonstração).
   - **Formulário Zod** (categoria, local no campus, descrição `10..500` chars sem HTML, toggle confidencial, upload de foto validado por MIME + Magic Bytes + miniatura sem EXIF).
   - **Feed comunitário anonimizado** com filtro por categoria.
5. **Perfil & Privacidade (Sheet modal acionado pelo avatar):**
   - Exibe nome, vínculo UFSC, CPF mascarado (`***.XXX.XXX-**`), toggle de hápticos, toggle de `Luz Noturna` e duas opções explícitas de reset: `"Trocar conta / Rever onboarding"` (mantém dados do campus) e `"Resetar tudo para padrão"` `[Decisão]`.

---

## 6. Estrutura de Arquivos e Qualidade

```text
src/
├── main.tsx
├── index.css
├── types/campus.ts
├── data/ufscTrindade.ts
├── engine/routing.ts
├── security/
│   ├── schemas.ts
│   ├── fileValidation.ts
│   └── storage.ts
├── hooks/
│   ├── useHaptics.ts
│   └── useCampusStore.ts
├── components/
│   ├── ui/                    # LiquidGlassSurface, PillButton, BottomSheet, FloatingTabBar
│   ├── onboarding/
│   ├── explore/
│   ├── map/
│   ├── lights/
│   ├── reports/
│   └── profile/
└── __tests__/
    ├── routing.test.ts
    └── security.test.ts
```

**Portões de verificação obrigatórios:** `tsc --noEmit`, `npm run build` (`sourcemap: false`), `vitest` (rotas + testes de ataque XSS/upload/CPF/storage), auditoria Apple Design + `Cortex/security.md`, e inspeção visual ao vivo em viewport mobile (`390×844`) e desktop.
