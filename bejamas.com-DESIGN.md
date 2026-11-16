# Bejamas — lime-lit editorial machinery

## Overview

A restrained grotesk editorial system interrupted by luminous green light and monumental sculptural forms. Mostly pale gray and near-black, it combines spare text, fine ruled grids, cinematic human footage and richly staged interface imagery. It suits complex products and expert services that need to feel both technically capable and approachable, with low text density around the big gestures and more concentrated detail in expandable chapters.

### Essentials

- The opening feels like an enormous object passing through darkness: a near-black stage with silver-green curved edges, a left-aligned 72px regular headline at 1.2 line height and -0.035em tracking, and ample untouched black space.
- Headlines speak rather than shout: sentence case NeueMontreal, weights 400–500; a 72px/1 regular closing line contrasts with compact 30px/1.2 section labels and 24px item titles.
- Conversion is a lime capsule, not a rectangular UI control: #befc65 with dark text, 9999px radius, 48px compact height or 80px feature height; secondary actions use a fine outline or translucent dark glass.
- Color belongs to light and evidence: keep the long reading canvas #f3f3f4 with #131314 text; concentrate lime in actions and sculptural illumination, while saturated project colors stay inside media or a dedicated proof band.
- Proof is staged as an editorial exhibition: rounded 17.6px image windows in alternating wide/narrow columns, small parenthesized context labels above, 24px outcome captions below, and white 40px-high metric pills on the imagery.
- The system carries both small indexing and a monumental signature: 40px dark numbered or lettered circles organize ruled lists, while a pale oversized wordmark fills about 1382px of a 1440px closing canvas. Use the new identity's wordmark, with typeset lettering as the minimum fallback; retain a silver curved sculpture somewhere in the page even when bespoke media is unavailable.

## Colors

### Accent

| Name | Value | Token | Roles | Use |
| --- | --- | --- | --- | --- |
| Luminous lime | `#befc65` | `--color-lime` | action, accent, background | Primary capsule actions and illumination behind sculptural art, not ordinary paragraph text. |

### Neutral

| Name | Value | Token | Roles | Use |
| --- | --- | --- | --- | --- |
| Near-black ink | `#131314` | `--color-ink` | text, background | Default text and dark stages; also used at 15% alpha over the pale canvas for the monumental footer signature. |
| Deep charcoal | `#333337` | `--color-deep-gray` | text | The stronger final statement in the problem narrative. |
| Soft charcoal | `#46444a` | `--color-mid-ink` | text | Large problem statements; varies within the muted charcoal range. |
| Muted violet gray | `#66646d` | `--color-muted` | text | Eyebrows, contextual metadata and secondary prose. |
| Warm hairline | `#e0dfdf` | `--color-editorial-rule` | border | The large split problem narrative's dividers. |
| Cool hairline | `#dfe3e6` | `--color-rule` | border | Default 1px section, row and logo-cell dividers. |
| Pale gray canvas | `#f3f3f4` | `--color-canvas` | background, surface | Default long-form canvas, not pure white. |
| White | `#ffffff` | `--color-white` | text, surface | Text on dark media, metric pills and selected raised panels. White at 90% alpha softens testimonial copy. |

### Page-type variants

| Only for | Name | Value | Token | Roles | Use |
| --- | --- | --- | --- | --- | --- |
| enterprise proof sections | Plum construction line | `#902677` | `--color-plum-line` | border, accent | Subtle rings and fading construction lines over the plum proof band. |
| enterprise proof sections | Proof plum | `#4a0039` | `--color-plum` | background | Dedicated customer testimonial band, separate from the default dark cinematic stage. |
| case studies | Inset gray | `#e9e9e9` | `--color-inset` | surface | Inset invitation panel in a long case study. |

## Typography

- **NeueMontreal** — All marketing headings, paragraphs, labels, numbers and navigation. A clean contemporary grotesk with open counters, compact sentence-case shapes and a slightly utilitarian editorial tone. If unavailable, use **Inter**. Use 400–500; tune line breaks before changing the measured size or tracking. Font stack: "NeueMontreal", "Inter", Arial, sans-serif.

| Recipe | Font | Weight | Size | Line height | Tracking | Use |
| --- | --- | --- | --- | --- | --- | --- |
| display | NeueMontreal | 400 | 72px | 1.2 | -0.035em | The dark sculptural opening's multiline promise. |
| closing | NeueMontreal | 400 | 72px | 1 | normal | Centered monumental final invitation. |
| stat | NeueMontreal | 500 | 72px | 1 | normal | Large signed percentages in the cinematic proof section. |
| problem-title | NeueMontreal | 500 | 56px | 1.18 | -0.025em | Large statements on the broad side of a split editorial section. |
| editorial-heading | NeueMontreal | 500 | 48px | 1 | normal | Standalone introductory heading above partner or customer matrices. |
| problem-intro | NeueMontreal | 500 | 32px | 1.18 | -0.02em | Smaller premise on the narrow side of a split editorial section. |
| section-label | NeueMontreal | 500 | 30px | 1.2 | normal | Compact section introductions beside lists or above project grids. |
| quote | NeueMontreal | 500 | 30px | 1.5 | normal | Long testimonial copy over cinematic footage. |
| item-title | NeueMontreal | 500 | 24px | 32px | normal | Service names and project captions. |
| lead | NeueMontreal | 500 | 24px | 1.2 | normal | Short supporting promise on a dark stage and problem-section explanations. |
| body | NeueMontreal | 500 | 20px | 1.4 | normal | Substantial supporting copy and feature-height button text. |
| footer-link | NeueMontreal | 500 | 20px | 1.6 | normal | Footer navigation links. |
| action | NeueMontreal | 500 | 18px | 28px | normal | Compact conversion actions. |
| navigation | NeueMontreal | 400 | 18px | 28px | normal | Top navigation links. |
| caption | NeueMontreal | 500 | 16px | 1.5 | normal | Muted metadata, small explanatory copy, metric pill text and section eyebrows. |
| footer-label | NeueMontreal | 400 | 16px | 1.5 | normal | Footer group headings. |
| index | NeueMontreal | 400 | 14px | 20px | normal | Decimal section markings in the footer. |

### Page-type variants

| Only for | Recipe | Font | Weight | Size | Line height | Tracking | Use |
| --- | --- | --- | --- | --- | --- | --- | --- |
| portfolio indexes | portfolio-opening | NeueMontreal | 500 | 72px | 1 | -0.04em | Short title above filters and the project gallery. |
| enterprise landing pages | enterprise-opening | NeueMontreal | 500 | 72px | 1 | normal | Right-hand promise beside a pale sculptural object. |
| enterprise FAQs | faq-heading | NeueMontreal | 500 | 60px | 1 | normal | Large introductory title on a white rounded-top band. |
| capability overviews and case studies | light-opening | NeueMontreal | 500 | 56px | 1.2 | normal | Narrow-column opening titles; also large project number and year metadata. |
| enterprise landing pages | enterprise-heading | NeueMontreal | 500 | 56px | 1 | normal | Major capability chapters and process card titles. |
| enterprise detail chapters | chapter-heading | NeueMontreal | 500 | 46px | 1.04 | normal | Chapter heading above a compact ruled information grid. |
| enterprise proof sections | plum-quote | NeueMontreal | 500 | 32px | 1.25 | normal | Short testimonial beside monumental customer artwork. |
| enterprise FAQs | faq-question | NeueMontreal | 400 | 24px | 1.25 | normal | Question text next to a circular plus control. |
| case studies | case-body | NeueMontreal | 500 | 21px | 1.625 | normal | Article paragraphs in the central reading column. |
| capability FAQs | expanded-answer | NeueMontreal | 500 | 20px | 1.625 | normal | Muted expanded answer prose. |

**Notes:**

- Use regular and medium rather than bold to create hierarchy. Sentence case and normal tracking are the norm; negative tracking is reserved for the dark opening, portfolio title and large problem statements.
- The same 72px size has different jobs: airy 1.2 line height in the dark opening, compact 1 line height in closing invitations and metrics. Preserve that distinction.
- Use parenthesized context labels and decimal indexes in the grotesk, not a monospace or uppercase technical label style.

## Layout

**Density:** Airy around narrative and imagery, concentrated within ruled lists; major pauses are created by section padding rather than oversized card gutters.

### Spacing

| Value | Use | Scales with viewport |
| --- | --- | --- |
| 6px | Tight gap in enterprise card carousels. | fixed |
| 8px | Inline control gaps and metric pill vertical padding. | fixed |
| 12px | Spacing within capability introduction copy. | fixed |
| 20px | Circle-to-text gap and service row vertical padding. | fixed |
| 24px | Eyebrow-to-title spacing and compact button horizontal padding. | fixed |
| 32px | Desktop outer gutters and white card padding. | fixed |
| 40px | Grid row gap, title-to-support spacing and inset panel padding. | fixed |
| 48px | Metric column gap. | fixed |
| 64px | Closing headline-to-button spacing and footer top gap. | fixed |
| 80px | Gallery item bottom spacing and article media breaks. | fixed |
| 96px | Closing invitation and logo-matrix section vertical padding. | fixed |
| 112px | Enterprise section vertical padding. | fixed |
| 120px | Capability chapter bottom breathing room. | fixed |
| 128px | Cinematic proof vertical padding. | fixed |
| 105.1px | Inset for the broad side of the split problem narrative. | 7.3vw |

### Containers and grids

- **main-container**: max width 1280px · side padding 32px. Centered desktop shell; its usable 1216px width stages media and editorial sections.
- **reading-column**: max width 672px · side padding 32px. Centered column with 608px usable text width; the text itself is left aligned.
- **project-grid**: 12 columns · gap 4px. Alternating seven-column and five-column media, 40px row gaps and 80px item bottom spacing; avoid a uniform tile wall.
- **problem-split**: 2 columns · gap 0px. A narrow premise occupying 42.7% beside 57.3% stacked statements, divided by a hairline.
- **logo-matrix**: 4 columns · gap 0px. Category label in the first column, then three logo columns; each logo cell is 304px by 128px.
- **footer-shell**: max width 1440px · side padding 32px. Full-width footer: brand statement across the left half, indexed groups across the right half, monumental lettering below.
- **enterprise-detail** (only for enterprise detail chapters): max width 1176px · gap 119px · side padding 32px. Small left chapter navigation beside a 676px main reading region.

## Corner radius

| Only for | Element | Radius |
| --- | --- | --- |
|  | capsule actions | 9999px (pill) |
|  | number badges | 50% |
|  | media windows | 17.6px |
|  | major rounded bands | 32px |
|  | metric pills | 40px |
| case studies | inset invitation | 24px |

## Surfaces and depth

### Surfaces

#### Pale canvas · level 0

**Use:** Default reading surface.

**CSS:** `background: #f3f3f4; color: #131314`

**Observed:** A continuous cool gray field connects sections; rules do more work than card boundaries.

**Transfer:** Use one uninterrupted field for reading-heavy sections.

#### Dark sculptural stage · level 0

**Use:** Default dramatic marketing opening.

**CSS:** `background: #131314; color: #ffffff; border-radius: 0px 0px 32px 32px; overflow: hidden; position: relative`

**Observed:** Near-black moving artwork extends edge to edge. A slight dark overlay improves text separation.

**Transfer:** Keep the art and lighting inside a single clipped stage, with text above it.

#### Cinematic proof stage · level 0

**Use:** Immersive human testimonial.

**CSS:** `background: #131314; color: #ffffff; border-radius: 17.6px; overflow: hidden; padding: 128px 90px`

**Observed:** Full-bleed footage sits behind a dark-to-transparent left gradient; copy occupies the quieter left portion.

**Transfer:** Back the quotation with relevant real-world footage or a still, retaining readable shadows behind the copy.

#### White panel · level 1

**Only for:** enterprise cards and FAQs

**Use:** Raised information against the pale canvas.

**CSS:** `background: #ffffff; border-radius: 32px; box-shadow: none`

**Observed:** Cards rely on the small canvas-to-white contrast, not drop shadows; FAQ bands round only their top corners.

**Transfer:** Reserve the raised white treatment for grouped evidence or objection handling.

#### Lime atmosphere · level 0

**Only for:** light sculptural enterprise sections

**Use:** Illumination behind translucent silver forms.

**CSS:** `background: linear-gradient(#f3f3f4 32%, #befc65 100%); border-radius: 9999px; filter: blur(30.9px); width: 1152px; height: 1152px`

**Observed:** The circular gradient is rotated and largely outside the left edge; it dissolves into the surrounding pale canvas.

**Transfer:** Place light behind the object, not under every text block. Match the soft glow; exact stops are not essential.

#### Inset invitation panel · level 1

**Only for:** case studies

**Use:** Small conversion pause before related work.

**CSS:** `background: #e9e9e9; border-radius: 24px; padding: 40px; max-width: 896px`

**Observed:** A dark circular icon precedes a narrow copy block and white capsule action.

**Transfer:** Make this quieter and smaller than the shared closing invitation.

#### Plum proof band · level 0

**Only for:** enterprise proof sections

**Use:** Customer quotation with oversized customer artwork.

**CSS:** `background: #4a0039; color: #ffffff; overflow: hidden; position: relative`

**Observed:** Quotation occupies the left half while oversized white artwork, rings and faint construction lines occupy the right.

**Transfer:** Use a customer's own visual world as a single proof interlude, not a new default theme.

## Components

### Navigation link

**Use:** Fixed top navigation.

**CSS:** `display: inline-flex; align-items: center; padding: 10px 20px; height: 48px; color: #ffffff; border-radius: 9999px`

**Text style:** `navigation` — NeueMontreal 400 · 18px/28px

**Observed:** Logo is isolated at the far left; links sit toward the right, with a separate lime action at the edge. Exclusion blending makes links dark on pale content. A 160px-tall progressive blur layer sits behind the header, using blur steps 1px, 2px, 4px, 8px and 16px.

**States:** Declared: hover background #ececec; focus-visible outline-style none with a zero shadow stack.

**Transfer:** Keep the brand, navigation and conversion action as distinct islands rather than enclosing them in a heavy bar.

### Primary button

**Use:** Compact top-level or final conversion.

**CSS:** `display: inline-flex; align-items: center; justify-content: center; background: #befc65; color: #131314; border-radius: 9999px; height: 48px; padding: 0px 24px`

**Text style:** `action` — NeueMontreal 500 · 18px/28px

**Observed:** Label-only capsule; the compact action is used in the header and centered closing invitation.

**States:** Declared: hover scale 1.02; focus-visible outline-style none with a zero shadow stack.

### Feature button

**Use:** Prominent conversion in a wide narrative section.

**CSS:** `display: inline-flex; align-items: center; justify-content: center; background: #befc65; color: #131314; border-radius: 9999px; height: 80px; padding: 0px 24px`

**Text style:** `body` — NeueMontreal 500 · 20px/1.4

**Observed:** Paired with an equally tall secondary capsule. The opening pair fills a two-column 688px region with a 4px gap; the list-section pair uses 304px-wide actions.

**States:** Declared: hover scale 1.01 for the opening variant; focus-visible outline-style none with a zero shadow stack.

**Transfer:** Use the larger action only where the surrounding whitespace supports it.

### Glass secondary button

**Use:** Secondary action on the dark opening.

**CSS:** `display: inline-flex; align-items: center; justify-content: center; height: 80px; padding: 0px 24px; border-radius: 9999px; background: rgba(19,19,20,0.5); border: 1px solid rgba(255,255,255,0.25); backdrop-filter: blur(8px); color: #ffffff`

**Text style:** `body` — NeueMontreal 500 · 20px/1.4

**Observed:** Sits beside Feature button, with the artwork showing through. Pale sections instead use a canvas-colored outlined capsule.

**States:** Declared: hover background-color color-mix(in oklab, #fff 10%, transparent); focus-visible outline-style none with a zero shadow stack.

### Index badge

**Use:** Ordered capability rows and lettered expandable lists.

**CSS:** `display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #131314; color: #ffffff; margin-right: 20px`

**Text style:** `caption` — NeueMontreal 500 · 16px/1.5

**Observed:** A small, solid disk balances the large surrounding whitespace; letters replace numerals in detailed accordion lists.

### Ruled service row

**Use:** Compact linked capability summary.

**CSS:** `display: flex; padding: 20px 0px; border-bottom: 1px solid #dfe3e6`

**Text style:** `item-title` — NeueMontreal 500 · 24px/32px

**Observed:** Index badge at left, title above one muted caption; the list sits in a 608px reading width with its section label outside to the left.

**Transfer:** Use short nouns or verbs for titles and a single practical benefit below.

### Project media card

**Use:** Outcome-oriented portfolio proof.

**CSS:** `position: relative; border-radius: 17.6px; overflow: clip`

**Text style:** `item-title` — NeueMontreal 500 · 24px/32px

**Observed:** Context metadata sits above the image window, project identity at its upper left, Metric pills near the bottom, and a plain outcome caption below. The whole item is linked; the caption is outside the clipped media.

**Transfer:** Use a real product view or a strong identity panel backed by customer color, not a generic feature icon.

### Metric pill

**Use:** Compact quantified proof over project imagery.

**CSS:** `background: #ffffff; color: #131314; border-radius: 40px; padding: 8px 24px; height: 40px`

**Text style:** `caption` — NeueMontreal 500 · 16px/1.5

**Observed:** Value and descriptor run together on one line. Pills wrap near the lower-left image edge with 4px vertical separation.

**Transfer:** Keep the data concrete and the labels short enough to read at a glance.

### Metric column

**Use:** Large results below a cinematic quotation.

**CSS:** `border-left: 1px solid rgba(230,230,230,0.24); padding-left: 24px; max-width: 320px`

**Text style:** `stat` — NeueMontreal 500 · 72px/1

**Observed:** A small muted label appears first, followed by the large signed percentage after an 80px gap; neighboring columns are separated by 48px.

**Transfer:** Make the label explain the number; keep the large numeral visually independent from the quote.

### Lettered accordion row

**Use:** Detailed capabilities and focused FAQ lists.

**CSS:** `display: flex; position: relative; padding: 16px 0px; color: #131314; border-bottom: 1px solid #dfe3e6`

**Text style:** `item-title` — NeueMontreal 500 · 24px/32px

**Observed:** Index badge, left-aligned title and a small outlined directional icon at the far right. Collapsed rows are about 73px tall; expanded text indents to the title, not the badge. Capability lists use an 813px region; focused FAQs use 704px.

**States:** Declared: hover text-decoration-line none; focus-visible outline-style none and border-color #a1a1aa.

**Transfer:** Use disclosure for real detail, preserving the sparse rhythm when closed.

### Footer text link

**Use:** Indexed footer navigation groups.

**CSS:** `display: inline-flex; align-items: center; min-height: 44px; color: #131314`

**Text style:** `footer-link` — NeueMontreal 500 · 20px/1.6

**Observed:** A small Index label and Footer-label heading precede links by 40px. Page links form two tight columns; social, resource and trust groups occupy neighboring indexed blocks.

**Transfer:** Preserve the editorial group numbering and wide left-side statement even with fewer links.

### FAQ plus control

**Only for:** enterprise FAQs

**Use:** Expandable questions grouped by category.

**CSS:** `display: grid; align-items: center; width: 40px; height: 40px; border-radius: 9999px; background: #ffffff; border: 1px solid #dfe3e6`

**Text style:** `faq-question` — NeueMontreal 400 · 24px/1.25

**Observed:** The question sits outside the circle, in a 760px column with 32px vertical trigger padding; the circle contains a 20px plus with 1.5px strokes. Category labels occupy the left column. Expanded plus rotates 45 degrees.

**Transfer:** Keep this distinct from the lettered accordion: it is a categorized enterprise objection pattern, not the default list.

## Imagery and graphics

### Silver-green macro sculpture

**Use:** Signature visual language for the default dramatic opening.

**Observed:** Huge smooth curved bands or thin oval plates pass diagonally beyond the frame. Metallic gray edges catch sharp pale highlights; dark green faces and lime light emerge from nearly black surroundings. The object dominates the frame but leaves a broad black pocket behind the headline.

**Transfer:** Use an abstract form related to the new identity rather than a literal product illustration. Minimum acceptable version is a well-lit layered elliptical band with a sharp rim, a lime reflection and deliberate off-frame cropping.

**Build:** Create an SVG with two oversized rotated ellipses, the inner one cut out with a mask to make a broad curved band. Extend it beyond the top-right edge and add a second blurred partial band at bottom-left. Use a near-black background, gray-to-white rim gradients, a translucent lime inner edge and a broad low-opacity lime reflection blurred about 30px. Layer a crisp narrow highlight above a softer dark face; keep the central text area mostly unlit.

### Staged project media

**Use:** Gallery cards and broad case-study image chapters.

**Observed:** Actual interface views are mounted in black-edged phones and tablets, sometimes overlapping or cut off by the frame. Other cards use identity artwork or natural product-in-use photography. Each frame has its own art direction: cool tabletop scenes, deep plum brand panels, pale blue interface compositions or dark device photography. The outside page remains neutral.

**Transfer:** Keep the product UI legible enough to establish reality without rebuilding all internal UI styles. Alternate an identity-led image with a device or use-context scene; use product colors only inside the frame.

### Cinematic human proof

**Use:** Immersive testimonial stage.

**Observed:** Natural outdoor footage shows people in conversation, with foliage darkening the left foreground and open sky behind the right-side subjects. The scene fills the whole band; white copy lives over the quieter shadowed side rather than a separate quote card.

**Transfer:** Use candid footage of a customer or team in a credible environment. A still with natural light, depth and an unobstructed text zone is an acceptable minimum.

### Monumental pale signature

**Use:** Required oversized identity device at the ending.

**Observed:** A very large pale-gray vector wordmark spans nearly the full canvas width, beneath indexed links. It is about 1382px wide and 355px high at desktop and nearly touches the bottom edge; some light-page endings add a silver plate form on the left.

**Transfer:** Use the new product's own wordmark at the same visual scale. If no vector exists, typeset its name as broad custom-spaced lettering; do not reduce this to a standard small footer logo.

**Build:** Place a wide inline SVG or text-to-path wordmark in a clipped footer stage. Fit it to 96% of the stage width, center it horizontally and anchor it 3px below the bottom. Fill it with rgba(19,19,20,0.15) over the pale canvas; keep utility text above it in the stacking order.

### Pale exploded sculpture

**Only for:** light enterprise sections and secondary-page footers

**Use:** Large left-hand art and small capability illustrations.

**Observed:** Translucent ivory-silver elliptical plates separate into an ascending curved stack. Fine gray rims and milky reflective faces sit over lime light on a pale gray ground. Smaller illustrations use silver bars, cubes and faceted clusters, with one lime-tinted piece.

**Transfer:** Reuse one geometric material vocabulary at several scales. The footer can reuse a close-up of the same plates without a colored glow.

**Build:** Use 6–10 SVG ellipses with subtle white-to-gray gradients, a thin gray edge and offset dark rim. Rotate each slightly and displace it vertically along a curve; put a blurred lime circle behind the middle of the stack and fade its edges into the pale canvas. For a minimal implementation, three overlapping tilted translucent oval plates retain the intended material.

### Construction-ring customer artwork

**Only for:** enterprise proof sections

**Use:** Oversized identity opposite a customer quotation.

**Observed:** White customer artwork sits inside a faint circular construction diagram on deep plum. Thin horizontal and vertical guides fade toward their ends; the art is oversized enough to compete with the text without crowding it.

**Transfer:** Use an authentic customer symbol or a simple abstract product emblem, maintaining the diagrammatic backing.

**Build:** In the right half of a plum band, draw a large SVG circle and inner circle with 1px plum-line strokes at low opacity. Add two vertical and two horizontal guides using transparent-to-plum-line-to-transparent gradients. Center white artwork over the guides, leaving the left half for the quote.

### Icons

**Observed:** Mostly small monochrome direction arrows and outline symbols. Typical symbols are 20px with 1.5–1.7px strokes, or 24px filled action arrows. Dark 40px circles contain white numerals, letters or outline capability icons; FAQ plus signs sit in outlined white circles.

**Transfer:** Choose simple geometric outline symbols with limited detail. Reserve filled arrow silhouettes for navigation and actions; do not introduce colorful icon badges into the editorial grid.

## Section recipes

How recurring sections are built.

### First screen: Dark sculptural opening

**Observed:** A full-width 1428px dark stage begins beneath a sparse fixed navigation. Back to front: near-black field, oversized silver-green macro sculpture, subtle dark overlay, then text and proof marks. In the first 900px, the object arcs across the right and corners while a three-line 72px Display promise sits in the left third, beginning around the middle of the screen; a small trust label and three monochrome marks sit beneath it. The large object mostly lies beyond the edges, not centered as a contained illustration. Only the compact header Primary button is visible as a conversion action in this first screen. The 24px Lead support line and the 80px Feature button / Glass secondary button pair appear farther down, aligned in the right half of the same stage; its rounded lower edge falls below the initial viewport.

**Transfer:** Make the first impression an asymmetrical encounter with a luminous abstract object and a concise customer outcome. Without bespoke 3D, use the Silver-green macro sculpture build with a carefully shaped negative-space pocket. Capability overviews instead open on pale canvas with a 56px title in the central reading column and a four-part ruled overview; portfolios use a 72px tightly tracked short title above filters; case studies use a 56px title between a large parenthesized index and year range; enterprise landings use a left pale sculpture and a right 72px promise, support and paired actions.

**Avoid:** Do not center a bright green object behind a centered headline, compress all hero content into 900px, or turn the first screen into a dashboard mockup with a conventional text-and-image split.

**Text style:** `display` — NeueMontreal 400 · 72px/1.2 · tracking -0.035em

### Split problem narrative

**Observed:** Pale canvas with a 32px premise on the narrow side and stacked 56px Problem-title statements on the broad side. Fine warm rules divide the columns and 384px-tall statement rows. The left premise remains sticky while a brief empathy label and underlined response sit toward its lower portion.

**Transfer:** Use this pattern to articulate two or three recognizable constraints, keeping each statement concrete and the smaller premise calm.

**Text style:** `problem-title` — NeueMontreal 500 · 56px/1.18 · tracking -0.025em

### Indexed capability list

**Observed:** A 30px Section-label sits to the left of a central reading-width list. Ruled service rows combine Index badge, 24px title and 16px muted support; an action pair follows with a 40px top gap.

**Transfer:** Use an ordered operating model, lifecycle or product capability set without making a new card for every item.

**Text style:** `section-label` — NeueMontreal 500 · 30px/1.2

### Exhibition proof grid

**Observed:** Project media cards alternate wide and narrow compositions across a 12-column grid with a 4px gutter. Metadata is above the rounded image, captions below; Metric pills live inside the image. Some images are wide landscapes and others tall devices or identity panels.

**Transfer:** Art-direct each proof item around its strongest material while preserving the caption and metadata positions.

**Text style:** `item-title` — NeueMontreal 500 · 24px/32px

### Cinematic quote and metrics

**Observed:** Cinematic proof stage carries a 576px-wide quotation on the left in 30px/1.5 text, attribution beneath, then Metric columns. Human footage remains prominent on the right. A small translucent play control accompanies the scene.

**Transfer:** Let a real customer describe the change, then provide distinct measured results below. On enterprise pages, use Plum proof band and Construction-ring customer artwork as the scoped alternative.

**Text style:** `quote` — NeueMontreal 500 · 30px/1.5

### Offset editorial introduction

**Observed:** A left-aligned 48px heading and 24px support occupy a centered narrow region above a much broader matrix or chapter. The title-to-support gap is 40px, and matrix sections use 96px vertical padding.

**Transfer:** Use the offset heading to introduce the argument before expanding to a full-width evidence structure.

**Text style:** `editorial-heading` — NeueMontreal 500 · 48px/1

### Ruled logo matrix

**Observed:** Category labels run down the first column while monochrome logos occupy three neighboring columns in 304px by 128px cells. Hairline vertical and horizontal rules create a table-like field without individual rounded cards.

**Transfer:** Group authentic customers, integrations or ecosystem partners by a useful category. Preserve a plain monochrome treatment.

### Closing invitation and oversized signature

**Observed:** A centered 16px muted setup line leads to the 72px regular Closing invitation after 24px. A compact Primary button sits 64px below; the whole invitation has 96px vertical padding and a bottom rule. Footer content begins 64px later: a short statement on the left, indexed navigation on the right, followed by Monumental pale signature and small bottom-edge utilities. This ending is shared across all page types; the enterprise invitation changes its verb.

**Transfer:** End with a direct invitation that resolves the page's central friction, then give the identity its own oversized final visual moment.

**Text style:** `closing` — NeueMontreal 400 · 72px/1

### Capability detail chapters

**Only for:** capability overview pages

**Observed:** A compact left introduction with 24px title, 20px benefit and muted 16px explanation accompanies an 813px Lettered accordion row list. Each chapter has 120px bottom padding and a 40px separation. Small underlined exploration links sit below selected lists. A 704px-wide focused FAQ follows.

**Transfer:** Turn an extensive offering into navigable chapters with concise summaries and genuine expandable detail.

### Enterprise assurance chapters

**Only for:** enterprise landing pages

**Observed:** An initial horizontal white-card carousel uses 512px square cards, 32px corners, 248px sculptural art and a 6px gap. Deeper chapters pair small left navigation with a 676px body: 46px headings, two-column ruled capability grids, sculptural details, lettered disclosures and a severity model. Process cards later use large 56px titles and lime number disks; a pale sculpture-and-action interlude offers help.

**Transfer:** Use for complex buying journeys: show the operational proof buyers need, separate topics with ruled chapters, and keep any severity indicators confined to their support model.

### Categorized white FAQ band

**Only for:** enterprise landing pages

**Observed:** White panel becomes a full-width rounded-top band with a top hairline and 112px vertical padding. A 60px introductory heading precedes category labels at left and 24px regular questions at right, each ending in FAQ plus control.

**Transfer:** Group objections around buyer tasks rather than exposing one long undifferentiated list.

**Text style:** `faq-heading` — NeueMontreal 500 · 60px/1

### Case-study editorial sequence

**Only for:** case studies

**Observed:** Large index and year flank a 608px title column; services and stack metadata follow. Broad 1216px images alternate with 707px/503px media pairs and narrow 21px/1.625 article text. A quotation, lettered challenge/solution disclosures and outcome paragraph break up the gallery. An Inset invitation panel precedes a white related-project panel with large index, name and year.

**Transfer:** Tell one transformation through context, constraints, decisions and outcomes. Keep the image chapters much wider than the prose.

**Text style:** `light-opening` — NeueMontreal 500 · 56px/1.2

## Page flow

**Storyline:** Outcome promise → recognizable constraints or buying context → capabilities and visual proof → credible outcomes and objections → direct invitation → indexed navigation and monumental identity.

### Flagship marketing landing page

1. **Promise** — Dark sculpture and restrained multiline outcome, trust marks, then supporting statement and action pair.
2. **Problem recognition** — Split premise and large repeated constraints.
3. **Capability model** — Numbered ruled list with concise benefits.
4. **Product proof** — Alternating project media and result pills.
5. **Human and quantified proof** — Cinematic quotation and large metric columns.
6. **Closing call** — Centered invitation, indexed footer and oversized wordmark.

**Transfer:** Adapt the argument to a new product while keeping the contrast between spectacular media and plainspoken editorial detail.

### Detailed customer transformation

1. **Context** — Large title, index, year and capability metadata.
2. **Demonstration** — Broad staged interface image, narrow introduction and attributed quotation.
3. **Decisions and constraints** — Media pairs interleaved with challenge/solution disclosures.
4. **Outcomes** — Short result summary with actions and further visual proof.
5. **Continuation** — Inset invitation and oversized related-project panel.
6. **Closing call** — Shared invitation and monumental footer.

**Transfer:** Use fewer, better images and a narrow reading column; never let the case become an uninterrupted wall of prose.

### Portfolio or proof index

1. **Orientation** — Compact pale opening title and small filter controls.
2. **Proof browsing** — Asymmetric project exhibition with occasional full-width media and result pills.
3. **Ecosystem credibility** — Category-led monochrome partner matrix.
4. **Closing call** — Shared centered invitation, indexed groups and monumental wordmark with pale sculpture.

**Transfer:** Let visual proof lead; keep filters quiet and captions tied to practical outcomes.

### Enterprise reassurance and complex buying support

1. **Risk-aware promise** — Pale sculpture beside right-hand headline, supporting statement, actions and trust information.
2. **Assurance** — White sculptural reason cards and offset introduction.
3. **Operational detail** — Chapter navigation beside ruled grids, support disclosures and severity detail.
4. **Proof** — Curated project media with tags and directional actions.
5. **Buying enablement** — Large process carousel and a sculptural help interlude.
6. **Ecosystem and objections** — Partner descriptions followed by a white categorized FAQ band.
7. **Human proof** — Plum customer quote with oversized artwork.
8. **Closing call** — Context-specific invitation and the shared oversized ending.

**Transfer:** Translate assurances into the new buyer's actual approval needs rather than adding decorative badges.

### Capability overview and detailed offering

1. **Promise and map** — Pale narrow-column title, practical support and four-part illustrated overview.
2. **Capability chapters** — Left summaries beside lettered expandable detail lists.
3. **Objection handling** — Focused narrow FAQ with indented answers.
4. **Credibility** — Customer and partner matrices with category labels.
5. **Closing call** — Shared invitation, indexed navigation and giant pale signature with sculpture.

**Transfer:** Organize capabilities around the customer's operating journey; let disclosures carry detail without making the default view dense.

## Writing

Confident, operational and human. The voice names frustrating constraints plainly, explains what changes in daily work, and backs reassurance with specific mechanisms rather than decorative superlatives.

**Do not copy:** Do not reuse Bejamas's name or logo, customer identities, proprietary artwork, certification claims, project dates, performance numbers or quotations. Replace all examples with the new product's truthful content and authorized assets. The examples below show the pattern only; write new copy for the new product.

- **Addressing the reader:** Speak directly to you and your team. Use we for the people delivering the work, making responsibility visible rather than hiding behind impersonal platform language.
- **Rhythm:** Short sentence-case headlines, often a complete thought with a full stop. Support paragraphs explain one operational change at a time; longer lists and concrete details live in disclosures.

| Role | Pattern | Typical length | Examples of the pattern |
| --- | --- | --- | --- |
| Hero headline | An imperative outcome grounded in what the customer's team can do. | 6–12 words | “Migrate to a website your team can run.” |
| Problem statement | Repeat a simple opening word, then name a practical bottleneck. | 6–9 words | “Every change waits on a developer”<br>“Every year it costs more to run” |
| Capability support | A short declarative benefit, sometimes two contrasting fragments. | 5–12 words | “One design system. Every brand reuses it.”<br>“Start with evidence, not assumptions.” |
| Assurance heading | Contrast a real operational standard against a superficial substitute. | 5–9 words | “Certified operations. Not just polished output.”<br>“Certified partners. Not just users.” |
| Primary action | Plain conversational invitation rather than a funnel slogan. | 2–3 words | “Talk to us”<br>“Start project” |
| Closing invitation | Let's plus a specific verb that resolves the friction introduced earlier. | 3–7 words | “Let's move you off legacy.”<br>“Let's consolidate it.” |
| Proof caption | An action-led transformation with enough context to explain why it matters. | 7–14 words | “Moving Veezu off WordPress to publish without developers” |

**Words and phrasing to use:** your team; run; publish; one shared system; without waiting; long after launch; clear scope; named people; here's how; not just

**Avoid:** revolutionary; game-changing as the brand's own claim; unlock limitless potential; seamless digital transformation; world-class without proof; excessive acronym chains in headlines

**Rules:**

- Lead with a concrete day-to-day outcome; name the enabling mechanism in the support.
- Make risk reassurance checkable through process, ownership, documentation or real proof.
- Use compact verbs for chapter names and plain words for actions.
- Let authentic customer quotations have a more personal rhythm than the main marketing copy.
- Keep numbers attached to what improved, with context that makes the claim meaningful.

## Do's and Don'ts

### Do

- Keep ordinary reading sections on #f3f3f4 and use 1px #dfe3e6 rules to organize them.
- Maintain the 72px regular display treatment and its distinct 1.2 opening versus 1 closing line heights.
- Preserve both 48px compact and 80px feature-height capsule actions.
- Stage broad media within the 1280px shell and narrower prose within the 672px shell.
- Use 40px index disks with a 20px separation from their row text.
- Keep metric pills white, 40px high and inset near the lower image edge.
- Leave a substantial shadowed pocket in the sculptural stage for the headline.
- Finish with indexed footer groups and a monumental pale identity mark rather than only small legal text.

### Don't

- Do not turn every 24px item title into a bold heading; medium weight is the stronger default.
- Do not replace the 17.6px media corners with perfectly square windows or exaggerated capsule-shaped images.
- Do not spread lime across ordinary reading backgrounds or tint every card green.
- Do not give editorial rows the same raised white treatment as enterprise assurance cards.
- Do not center the body copy just because its 672px container is centered.
- Do not add soft drop shadows around the main gallery; media and spacing establish the hierarchy.
- Do not use uppercase tracked mono labels in place of the 16px grotesk metadata.
- Do not shrink the footer identity to a conventional logo size or let it obscure navigation and utility links.

## Motion and responsive

### Motion

**Observed:**

- Compact primary actions declare scale 1.02 on hover; the feature opening action uses 1.01. Transform transitions use .15s cubic-bezier(.4, 0, .2, 1).
- Underline links declare background-size 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94). Index badges declare opacity 0.5s.
- White enterprise cards declare transform transitions of 0.3s cubic-bezier(.4, 0, .2, 1); FAQ plus controls declare color 0.2s and background-color 0.2s.
- The fixed header uses stacked progressive blur; headline words can resolve from blur to a sharp resting state.

**Transfer:**

- Keep interaction motion small relative to the monumental artwork: slight capsule scaling and quiet underline reveals, not bouncy controls.
- Let the sculpture carry the atmospheric movement while the reading grid remains visually stable.

**Unknown:**

- Exact video loops, scroll animation choreography and headline reveal timings are not specified.

### Responsive

**Observed:**

- Desktop composition uses multi-column media, a separate right-side hero support area and a fixed top navigation.
- Narrow-layout class variants use 20px outer gutters, stacked content and smaller titles; enterprise assurance cards remain horizontally scrollable.

**Transfer:**

- On narrow screens, retain the silver-green sculpture as a cropped edge gesture, move the promise into normal flow, and stack support and actions beneath it.
- Collapse the alternating gallery to a single reading order while keeping metadata above and captions below each image.
- Move the small chapter navigation above the enterprise details and turn category-led logo matrices into fewer columns without losing their hairlines.
- Scale the oversized footer mark to the available width rather than retaining a desktop-sized clipped word.

**Unknown:**

- Exact active breakpoints, mobile navigation behavior and small-screen animation behavior are not established.

## How to use this guide

1. Start from the Essentials and the first-screen recipe; where the guide offers variants, use the default named for a new marketing page.
2. Plan the page before building: map your content onto the section recipes and page flow, then check the plan against the Do's and Don'ts.
3. Build with the tokens and component specs; recreate signature graphics with their build recipes instead of generic decoration, and use the named font substitutes if a font is unavailable.
4. Render the page at desktop and mobile widths, compare it with the Essentials and the Don'ts, and fix the differences before you finish.
