# Figma Design Specs — Cortex IDE Screens

> **Source:** Figma file `7TTa8SwHpewBP0OB5pjX0p`
> **Nodes:** `0-1168` (Open File), `0-890` (Code + project), `0-141` (Components library)
> **Extracted:** Automated via Figma MCP
> **Purpose:** Structured reference for implementation tasks. All values are exact from Figma.

---

## Table of Contents

1. [Design Tokens](#1-design-tokens)
2. [Activity Bar](#2-activity-bar)
3. [Explorer / Sidebar Panel](#3-explorer--sidebar-panel)
4. [Title Bar / Header](#4-title-bar--header)
5. [Editor Area](#5-editor-area)
6. [Tab Bar](#6-tab-bar)
7. [Status Bar / Footer](#7-status-bar--footer)
8. [Welcome / Open File Page](#8-welcome--open-file-page)
9. [Context Menu / Dropdown](#9-context-menu--dropdown)
10. [Vibe / IDE Toggle](#10-vibe--ide-toggle)
11. [File Tree](#11-file-tree)
12. [Code Editor](#12-code-editor)
13. [Icon Reference](#13-icon-reference)

---

## 1. Design Tokens

### Colors

#### Backgrounds

| Token              | Value                      | Usage                                    |
|--------------------|----------------------------|------------------------------------------|
| bg-primary         | `#141415`                  | Main panel, sidebar panel backgrounds    |
| bg-surface         | `#1C1C1D`                  | Activity bar container, chat input, cards |
| bg-elevated        | `#252628`                  | Sidebar item hover/selected, dropdown bg |
| bg-hover           | `#2E2F31`                  | Hover states, chat bubble, subtle bg     |
| bg-segment         | `#1A1B1F`                  | Toggle segment background                |
| bg-overlay         | `rgba(255,255,255,0.11)`   | Screen background overlay                |
| bg-transparent     | `rgba(255,255,255,0)`      | Logo container                           |

#### Text

| Token              | Value                      | Usage                                    |
|--------------------|----------------------------|------------------------------------------|
| text-primary       | `#FCFCFC`                  | Primary text, labels, selected icons     |
| text-secondary     | `#E9E9EA`                  | Input placeholder, sidebar active text   |
| text-muted         | `#8C8D8F`                  | Breadcrumbs, secondary labels, icons     |
| text-dimmed        | `rgba(255,255,255,0.5)`    | Dimmed text                              |
| text-semi          | `rgba(255,255,255,0.8)`    | Semi-transparent text                    |

#### Accent

| Token              | Value                      | Usage                                    |
|--------------------|----------------------------|------------------------------------------|
| accent-green       | `#B2FF22`                  | Active indicator, green accents          |
| accent-blue        | `#266FCF`                  | Toggle active, blue accents              |
| accent-blue-alt    | `#3163DF`                  | Status bar blue                          |
| accent-purple      | `#8A38F5`                  | Dashed border accent                     |
| accent-info-blue   | `#008CFF`                  | Info blue                                |

#### Borders

| Token              | Value                      | Usage                                    |
|--------------------|----------------------------|------------------------------------------|
| border-default     | `#2E2F31`                  | Panel borders, dividers                  |
| border-subtle      | `#3C3D40`                  | Activity bar container border, toggle    |
| border-lighter     | `#4C4C4D`                  | Breadcrumb separator, lighter borders    |
| border-divider     | `#4E4F54`                  | Terminal section dividers                |
| border-ghost       | `rgba(255,255,255,0.16)`   | Ghost borders, send button               |
| border-faint       | `rgba(255,255,255,0.05)`   | Model selector, very subtle borders      |

#### Status Colors

| Token              | Value                      | Usage                                    |
|--------------------|----------------------------|------------------------------------------|
| error-dark         | `#E53935`                  | Error indicator                          |
| error-light        | `#EF5350`                  | Error text/icon                          |
| warning-orange     | `#FF7043`                  | Warning indicator                        |
| warning-alt        | `#FF6B46`                  | Warning alternate                        |
| warning-yellow     | `#FFD54F`                  | Yellow warning                           |
| success-green      | `#8FED86`                  | Success indicator                        |
| success-bg         | `rgba(143,237,134,0.1)`    | Success background tint                  |
| git-added          | `#28692A`                  | Git added indicator                      |
| git-added-light    | `#018D0A`                  | Git added text                           |
| git-modified       | `#34499C`                  | Git modified indicator                   |

#### File Type Colors

| Token              | Value       | Usage            |
|--------------------|-------------|------------------|
| file-ts            | `#CB93DE`   | TypeScript/TSX   |
| file-json          | `#6BBD8F`   | JSON files       |
| file-js            | `#E8DD9B`   | JavaScript       |
| file-css           | `#0288D1`   | CSS files        |
| file-config        | `#455A64`   | Config files     |
| file-rust          | `#DDA96E`   | Rust files       |
| file-green-alt     | `#A6DD6E`   | Alt green files  |
| file-cyan          | `#6ED9DD`   | Cyan files       |
| file-purple-alt    | `#A96EDD`   | Alt purple files |
| file-html          | `#FF4081`   | HTML files       |
| file-blue          | `#1E88E5`   | Blue files       |
| file-blue-light    | `#42A5F5`   | Light blue files |

#### Syntax Highlight Colors

| Token              | Value       | Usage                   |
|--------------------|-------------|-------------------------|
| syntax-orange      | `#FEAB78`   | Code highlighting       |
| syntax-pink        | `#FFB7FA`   | Code highlighting       |
| syntax-blue        | `#66BFFF`   | Code highlighting       |
| syntax-red         | `#FF7070`   | Code error highlighting |
| syntax-yellow      | `#FEC55A`   | Code highlighting       |

#### Misc

| Token              | Value                      | Usage                        |
|--------------------|----------------------------|------------------------------|
| tag-bg             | `rgba(252,252,252,0.08)`   | Sub-item tags                |
| hover-subtle       | `rgba(255,255,255,0.05)`   | Toggle hover, subtle hover   |
| hover-light        | `rgba(255,255,255,0.1)`    | Light hover overlay          |
| hover-medium       | `rgba(255,255,255,0.2)`    | Medium hover overlay         |
| dark-green-bg      | `#314214`                  | Green-tinted dark bg         |
| dark-green-alt     | `#6C8A2C`                  | Green accent dark            |
| dark-green-text    | `#0F1503`                  | Very dark green text         |
| orange-accent      | `#D97757`                  | Orange accent                |
| black              | `#000000`                  | Pure black                   |

### Gradients

| Name               | Value                                                                        | Usage           |
|--------------------|------------------------------------------------------------------------------|-----------------|
| cortex-brand       | `linear-gradient(137deg, rgba(77,86,255,1) 0%, rgba(105,71,147,1) 95%)`     | Cortex branding |
| pink-purple        | `linear-gradient(131deg, rgba(236,131,187,1) 8%, rgba(182,100,219,1) 73%)`  | AI Terminal text |

### Typography

| Style Name         | Font Family    | Weight | Size   | Line Height  | Usage                          |
|--------------------|----------------|--------|--------|--------------|--------------------------------|
| Body Large         | Figtree        | 500    | `16px` | `1em`        | Section headers, tab labels    |
| Body Default       | Figtree        | 500    | `14px` | `1em`        | Sidebar items, general text    |
| Body Alt           | Figtree        | 500    | `14px` | `1.143em`    | Alternate body (letter-spacing: -1.5%) |
| Body Regular       | Figtree        | 400    | `14px` | `1.429em`    | Paragraph body text            |
| Body Regular Alt   | Figtree        | 400    | `14px` | `1em`        | Regular weight body            |
| Small Label        | Figtree        | 500    | `12px` | `1em`        | Small labels, tags             |
| Small Text         | Figtree        | 400    | `12px` | `1.167em`    | Dropdown items, metadata       |
| Small Text Alt     | Figtree        | 400    | `12px` | `1.2em`      | Status bar text                |
| Small Text Center  | Figtree        | 400    | `12px` | `1em`        | Centered small text            |
| Code Editor        | JetBrains Mono | 400    | `10px` | `1.32em`     | Editor code text               |
| Code Large         | JetBrains Mono | 400    | `14px` | `1em`        | Inline code, file paths        |
| Code Alt           | Roboto Mono    | 400    | `14px` | `1em`        | Alternative code text          |
| Decorative         | Habibi         | 400    | `12px` | `1.25em`     | Decorative text                |
| Geist Body         | Geist          | 400    | `14px` | `1.143em`    | Geist font body (letter-spacing: -1.5%) |

### Spacing Scale

| Value   | Usage                                                        |
|---------|--------------------------------------------------------------|
| `2px`   | Breadcrumb gap, toggle inner padding, file tree row gap      |
| `4px`   | Activity bar container padding, toggle gap, badge padding    |
| `6px`   | Activity bar item padding, welcome button gap                |
| `8px`   | Activity bar icon gap, sidebar gap, chat padding, footer y   |
| `10px`  | File explorer gap, toggle set padding, tab bar padding       |
| `12px`  | Header left gap, content area gap, chat container padding    |
| `16px`  | Chat inner gap, workspace list padding, sidebar header       |
| `20px`  | Footer icon gap, right section gap                           |
| `24px`  | Footer padding-x, content column gap, status bar padding-x   |
| `32px`  | Chat bubble gap, sub-item indent padding                     |
| `40px`  | Footer gap between sections                                  |
| `44px`  | Header gap                                                   |

### Border Radius Scale

| Value   | Usage                                                        |
|---------|--------------------------------------------------------------|
| `4px`   | Status badges, tags                                          |
| `6px`   | Toggle inactive indicator corners, sidebar tab corners       |
| `8px`   | Sidebar items, model selector, dropdown menu                 |
| `10px`  | Toggle active indicator corners                              |
| `12px`  | Activity bar container, logo, chat input, toggle outer       |
| `16px`  | Chat send button, sidebar panel, main content, chat bubble   |
| `24px`  | Main panel outer                                             |

### Shadows

| Component    | Box Shadow Value                                                                           |
|--------------|--------------------------------------------------------------------------------------------|
| Main Panel   | `0px 4px 26px 15px rgba(38,36,37,0.38), inset 0px 0px 13.1px 6px rgba(26,24,25,0.2)`    |
| Code Glow    | `0px 0px 1.9px 0px rgba(102,191,255,0.4)`                                                |

---

## 2. Activity Bar

**Figma Component:** Sidebar Container (`0:409`)

### Container

| Property        | Value        |
|-----------------|--------------|
| Layout Mode     | `row`        |
| Justify Content | `center`     |
| Gap             | `8px`        |
| Padding         | `4px`        |
| Sizing          | `hug × hug`  |
| Background      | `#1C1C1D`    |
| Border Color    | `#3C3D40`    |
| Border Width    | `1px`        |
| Border Radius   | `12px`       |

### Inner Column

| Property    | Value          |
|-------------|----------------|
| Layout Mode | `column`       |
| Gap         | `8px`          |
| Width       | `32px` (fixed) |
| Sizing V    | `hug`          |

### Icon Button (32×32)

| Property      | Default    | Hover      | Selected   |
|---------------|------------|------------|------------|
| Layout Mode   | `row`      | `row`      | `row`      |
| Align Items   | `center`   | `center`   | `center`   |
| Gap           | `8px`      | `8px`      | `8px`      |
| Padding       | `6px`      | `6px`      | `6px`      |
| Width          | `32px`     | `32px`     | `32px`     |
| Height         | `32px`     | `32px`     | `32px`     |
| Border Radius | `8px`      | `8px`      | `8px`      |
| Background    | none       | `#252628`  | `#252628`  |

### Icon (20×20)

| Property         | Default   | Selected  |
|------------------|-----------|-----------|
| Width            | `20px`    | `20px`    |
| Height           | `20px`    | `20px`    |
| Stroke Color     | `#8C8D8F` | `#FCFCFC` |
| Stroke Weight    | `1px`     | `1px`     |

### Activity Bar Icons

Home, Folder, search-sm, Git, Play, Plugins, Users, Grid, Book, Map, Brush, Account2

---

## 3. Explorer / Sidebar Panel

**Figma Component:** Explorer (`0:581`)

### Panel Container

| Property      | Value              |
|---------------|--------------------|
| Layout Mode   | `column`           |
| Align Self    | `stretch`          |
| Gap           | `8px`              |
| Sizing H      | `fixed`            |
| Sizing V      | `fill`             |
| Background    | `#141415`          |
| Border Color  | `#2E2F31`          |
| Border Width  | `1px`              |
| Border Radius | `16px`             |

### Panel Header Row

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `stretch`          |
| Align Items     | `stretch`          |
| Align Self      | `stretch`          |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

### Tab Item (Explorer / AI Terminal)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `center`           |
| Align Items     | `center`           |
| Gap             | `6px`              |
| Padding         | `10px 16px`        |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |
| Border Radius   | `0px 0px 0px 6px`  |

**Explorer tab text:** Figtree 14px/500, color `#E9E9EA`
**AI Terminal tab text:** Figtree 14px/500, gradient `linear-gradient(131deg, rgba(236,131,187,1) 8%, rgba(182,100,219,1) 73%)`
**AI Terminal tab icon:** MagicWand 16×16, fill `#FFFFFF`

### Section Header

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `211px`            |
| Padding         | `0px 16px`         |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

**Section title:** Figtree 16px/500, color `#E9E9EA`
**Chevron icon:** 16×16, fill `#FFFFFF`

### Action Icons Row

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `8px`    |
| Sizing      | `hug`    |

### File Tree Area

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Align Self  | `stretch`          |
| Gap         | `2px`              |
| Padding     | `8px 0px`          |
| Sizing H    | `fill`             |
| Sizing V    | `fixed`            |
| Height      | `795px`            |

---

## 4. Title Bar / Header

**Figma Component:** Header (`0:482`)
**Variants:** Default, Active

### Header Row

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Gap             | `44px`             |
| Padding         | `0px 0px 0px 8px`  |
| Width           | `1543px` (fixed)   |
| Height          | `56px` (fixed)     |

### Left Section (Logo + Toggle)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `12px`   |
| Sizing      | `hug`    |

### Logo Container

| Property      | Value              |
|---------------|---------------------|
| Width         | `40px` (fixed)      |
| Height        | `40px` (fixed)      |
| Background    | `rgba(255,255,255,0)` |
| Border Radius | `12px`              |

### Logo Icon

| Property | Value    |
|----------|----------|
| X offset | `8.01px` |
| Y offset | `8px`    |
| Width    | `23.99px`|
| Height   | `24px`   |

### Right Section

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `20px`   |
| Sizing      | `hug`    |

### Window Controls

Each control button:

| Property | Value    |
|----------|----------|
| Layout   | `row`    |
| Align    | `center` |
| Gap      | `10px`   |
| Padding  | `16px`   |
| Sizing   | `hug`    |

---

## 5. Editor Area

### Container (from Open File view)

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Justify     | `space-between`    |
| Width       | `1543px` (fixed)   |
| Height      | `831px` (fixed)    |

### Left — File Explorer Column

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Align Items | `center`           |
| Gap         | `10px`             |
| Padding     | `0px 0px 0px 12px` |
| Sizing H    | `hug`              |
| Sizing V    | `fill`             |

### Right — Editor Column

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Gap         | `12px`             |
| Padding     | `0px 12px`         |
| Sizing H    | `hug`              |
| Sizing V    | `hug`              |

---

## 6. Tab Bar

### Container

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Padding         | `0px 12px 0px 0px` |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

### Tab Item

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `center`           |
| Align Items     | `center`           |
| Gap             | `10px`             |
| Padding         | `8px 10px`         |
| Sizing          | `hug`              |

### Tab Label

| Property    | Value    |
|-------------|----------|
| Font Family | Figtree  |
| Font Weight | 500      |
| Font Size   | `14px`   |
| Line Height | `1em`    |
| Color       | `#8C8D8F` (inactive), `#FCFCFC` (active) |

### Active Tab Badge

| Property      | Value                    |
|---------------|--------------------------|
| Padding       | `4px 6px`                |
| Gap           | `8px`                    |
| Border Color  | `rgba(255,255,255,0.05)` |
| Border Width  | `1px`                    |

### Tab Item with Icon

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `6px`    |
| Sizing      | `hug`    |

File type icon: `16×16` (inside tab)

---

## 7. Status Bar / Footer

**Figma Component:** Footer (`0:303`)

### Container

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Gap             | `40px`             |
| Padding         | `8px 24px`         |
| Width           | `1543px` (fixed)   |
| Height          | `42px` (fixed)     |

### Left Section (Status Icons)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `20px`   |
| Sizing      | `hug`    |

**Icon buttons:** `20×20px` outer, `16×16px` inner icon (offset 2px)

### Status Item

| Property    | Value      |
|-------------|------------|
| Layout Mode | `row`      |
| Align Items | `center`   |
| Gap         | `8px`      |
| Padding     | `2px 4px`  |
| Sizing      | `hug`      |

**Status text:** Figtree 12px/400, line-height `1.167em`

### Right Section (Code Navigation Help)

| Property        | Value      |
|-----------------|------------|
| Layout Mode     | `row`      |
| Justify Content | `flex-end` |
| Align Items     | `center`   |
| Gap             | `4px`      |
| Height          | `26px`     |
| Sizing H        | `hug`      |

**Text:** Figtree 14px/500, color `#FCFCFC`

### Status Bar Icons

| Icon             | Size     | Color     |
|------------------|----------|-----------|
| menu-left-off    | `16×16`  | `#FFFFFF` |
| terminal-square  | `16×16`  | `#FFFFFF` |
| git-branch-02    | `16×16`  | `#FFFFFF` |
| info-circle      | `16×16`  | `#FFFFFF` |
| green-tick       | `16×16`  | `#B2FF22` |
| bell-02          | `24×24`  | `#8C8D8F` |
| command          | `24×24`  | `#8C8D8F` |
| terminal         | `24×24`  | `#8C8D8F` |
| message-square   | `24×24`  | `#8C8D8F` |

### Cortex Logo (Status Bar)

| Property      | Value              |
|---------------|---------------------|
| Layout Mode   | `column`            |
| Align Items   | `center`            |
| Gap           | `10px`              |
| Padding       | `1px 1.5px`         |
| Fill          | `linear-gradient(137deg, rgba(77,86,255,1) 0%, rgba(105,71,147,1) 95%)` |

---

## 8. Welcome / Open File Page

### Welcome Content Container

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Align Self  | `stretch`          |
| Gap         | `16px`             |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

### Section Header Row

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Padding         | `0px 16px`         |
| Sizing H        | `fill`             |

**Section title:** Figtree 16px/500, color `#E9E9EA`

### Action Buttons (Open File / Clone Repo)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `center`           |
| Align Items     | `center`           |
| Gap             | `6px`              |
| Padding         | `10px 16px`        |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

**Active variant (fixed height):**

| Property | Value    |
|----------|----------|
| Height   | `36px`   |

**Button icon:** 16×16, fill `#E9E9EA`, stroke `#E9E9EA` 1px
**Button text:** Figtree 14px/500, color `#1C1C1D` (fill_WP6OZV)

### Recent Projects Section

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Gap         | `8px`              |
| Padding     | `0px 16px`         |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

### Recent Project Item

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Gap         | `8px`              |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

**File icon:** 16×16
**Project name:** Figtree 14px/500, color `#8C8D8F`
**Chevron:** 16×16, fill `#FFFFFF`

---

## 9. Context Menu / Dropdown

### Dropdown Container

| Property      | Value              |
|---------------|---------------------|
| Layout Mode   | `column`            |
| Padding       | `4px`               |
| Width         | `243px` (fixed)     |
| Sizing V      | `hug`               |
| Position      | `absolute`          |
| Offset Y      | `40px` (below header) |
| Background    | `#252628`           |
| Border Color  | `#3C3D40`           |
| Border Width  | `1px`               |
| Border Radius | `8px`               |

### Dropdown Item (Default)

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Gap         | `8px`              |
| Padding     | `4px 8px`          |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

**Item icon:** `14×14`
**Item text:** Figtree 12px/400, line-height `1.167em`, color `#FCFCFC`

### Dropdown Item (Recent File)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `column`           |
| Justify Content | `center`           |
| Align Self      | `stretch`          |
| Gap             | `8px`              |
| Padding         | `8px`              |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

**Item name:** Figtree 12px/400, color `#FCFCFC`
**Item path:** Figtree 12px/400, color `#8C8D8F`

### Dropdown Divider

| Property     | Value              |
|--------------|---------------------|
| Layout Mode  | `column`            |
| Align Self   | `stretch`           |
| Gap          | `10px`              |
| Padding      | `4px 0px`           |
| Sizing H     | `fill`              |
| Sizing V     | `hug`               |

**Divider line:** `1px` height, fill, color `#3C3D40`

### Section Label

| Property | Value    |
|----------|----------|
| Padding  | `4px 8px`|
| Sizing H | `fill`   |

**Text:** Figtree 14px/500, color `#8C8D8F`

---

## 10. Vibe / IDE Toggle

### Toggle Container

| Property      | Value          |
|---------------|----------------|
| Layout Mode   | `row`          |
| Align Items   | `center`       |
| Height        | `32px` (fixed) |
| Sizing H      | `hug`          |
| Border Color  | `#3C3D40`      |
| Border Width  | `1px`          |
| Border Radius | `12px`         |

### Left Segment (Vibe)

| Property        | Value          |
|-----------------|----------------|
| Layout Mode     | `row`          |
| Justify Content | `center`       |
| Align Items     | `center`       |
| Gap             | `10px`         |
| Padding         | `8px`          |
| Width           | `46px` (fixed) |
| Height          | `32px` (fixed) |
| Background      | `#1A1B1F`      |

### Right Segment (IDE)

| Property        | Value          |
|-----------------|----------------|
| Layout Mode     | `row`          |
| Justify Content | `stretch`      |
| Align Items     | `stretch`      |
| Gap             | `10px`         |
| Padding         | `2px`          |
| Width           | `46px` (fixed) |
| Height          | `32px` (fixed) |
| Background      | `#1A1B1F`      |

### Active Indicator

| Property | Value          |
|----------|----------------|
| Width    | `42px` (fixed) |
| Height   | `28px` (fixed) |

### Variant States

| State      | Left Fill                       | Right Fill                      |
|------------|----------------------------------|---------------------------------|
| Vibe       | `#266FCF` (radius `10px 0 0 10px`) | none (radius `0 6px 6px 0`)   |
| IDE        | none (radius `6px 0 0 6px`)     | `#266FCF` (radius `0 10px 10px 0`) |
| Vibe Hover | `rgba(255,255,255,0.05)`        | `#266FCF`                       |
| IDE Hover  | `#266FCF`                       | `rgba(255,255,255,0.05)`        |

---

## 11. File Tree

### Tree Item Row

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Gap         | variable           |
| Padding     | `4px 8px`          |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

### Tree Item Content

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `2px`    |
| Sizing      | `hug`    |

### File Name

| Property    | Value    |
|-------------|----------|
| Font Family | Figtree  |
| Font Weight | 500      |
| Font Size   | `14px`   |
| Line Height | `1em`    |

### File Type Icon

| Property | Value  |
|----------|--------|
| Width    | `16px` |
| Height   | `16px` |

### Chevron (Expand/Collapse)

| Property | Value  |
|----------|--------|
| Width    | `14px` |
| Height   | `14px` |

### Indentation Guides

| Property     | Value                      |
|--------------|----------------------------|
| Width        | `1px`                      |
| Color        | `rgba(255,255,255,0.1)`    |

### Line Number Column

| Property | Value    |
|----------|----------|
| Width    | `49px`   |

---

## 12. Code Editor

### Editor Text

| Property    | Value            |
|-------------|------------------|
| Font Family | JetBrains Mono   |
| Font Weight | 400              |
| Font Size   | `10px`           |
| Line Height | `1.32em`         |

### Line Number Text

| Property    | Value            |
|-------------|------------------|
| Font Family | JetBrains Mono   |
| Font Weight | 400              |
| Font Size   | `14px`           |
| Line Height | `1em`            |

### Minimap

| Property | Value              |
|----------|--------------------|
| Width    | `14px`             |
| Height   | `783px`            |

### Minimap Markers

| Property      | Value                      |
|---------------|----------------------------|
| Width         | `13px`                     |
| Height        | `1px`                      |
| Error Color   | `#FF7070`                  |
| Warning Color | `#FEC55A`                  |

### Scrollbar

| Property      | Value              |
|---------------|---------------------|
| Width         | `8px`               |
| Thumb Color   | `#2E2F31`           |
| Thumb Height  | `229px` (varies)    |

### Breadcrumb

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `center`           |
| Align Items     | `center`           |
| Gap             | `4px`              |
| Padding         | `8px 6px 8px 12px` |
| Sizing          | `hug`              |

**Breadcrumb text:** Figtree 14px/500, color `#8C8D8F`
**Breadcrumb separator:** border `#4C4C4D` 1px

### Active Line Indicator

| Property      | Value              |
|---------------|---------------------|
| Width         | `2px`               |
| Color (orange)| `rgba(254,171,120,0.5)` |
| Color (blue)  | `rgba(102,191,255,0.5)` |

---

## 13. Icon Reference

### Icon Sizes by Context

| Context         | Outer Size | Inner Icon | Stroke Weight |
|-----------------|------------|------------|---------------|
| Activity Bar    | `32×32px`  | `20×20px`  | `1px`         |
| Sidebar/File    | —          | `16×16px`  | `1px`         |
| Status Bar (L)  | `20×20px`  | `16×16px`  | `1px`         |
| Status Bar (R)  | `24×24px`  | `16×16px`  | `1.5px`       |
| Tab Bar         | —          | `16×16px`  | —             |
| Dropdown Menu   | —          | `14×14px`  | —             |
| Chevron         | —          | `16×16px`  | —             |
| Tree Chevron    | —          | `14×14px`  | —             |
| MagicWand       | —          | `16×16px`  | —             |

### Icon Categories

| Category      | Icons                                                                                                    |
|---------------|----------------------------------------------------------------------------------------------------------|
| Activity Bar  | home, folder, search-sm, git, play, plugins, users, grid, book, map, brush, account, account2            |
| Navigation    | chevron-down/left/right/up, back, arrow-narrow-down/up/down-left, move-up/down, expand, collapse, menu-left-off/on, hide-panel |
| Actions       | plus, minus, x-close, search-sm, refresh-cw-05, trash-03, switch-horizontal-01, attach, edit-02, upload-01, save-01, flip-backward/forward, filter-lines, reverse-left, file-plus-01 |
| Status Bar    | info-circle, git-branch-02, terminal-square, terminal, command, bell-02, message-square-01, message-text-square-01, green-tick, layout-alt-04 |
| Sidebar       | file, folder, list, git-logo, lock-01, check, check-on, check-off, tag-02, flag-05, eye, clock, star-01, target-02, lightbulb-03, filler, settings-02, user-01, tag-01, pie-chart-01, data, shield-02, magic-wand |
| Chat          | code, palette, brackets-square, debug, more                                                              |
| File Types    | react-ts, rust, toml                                                                                     |

### Key Dimensions Summary

| Element                | Width     | Height   |
|------------------------|-----------|----------|
| Full viewport          | `1920px`  | `1080px` |
| Main panel             | `1543px`  | hug      |
| Main panel offset      | `x:189px` | `y:75px` |
| Main panel radius      | `24px`    | —        |
| Content area height    | —         | `831px`  |
| Title bar height       | —         | `56px`   |
| Status bar height      | —         | `42px`   |
| Activity bar width     | `~46px`   | —        |
| Sidebar panel          | hug       | fill     |
| Sidebar panel radius   | `16px`    | —        |
| File tree height       | —         | `795px`  |
| Logo container         | `40px`    | `40px`   |
| Logo icon              | `24px`    | `24px`   |
| Toggle segment         | `46px`    | `32px`   |
| Toggle indicator       | `42px`    | `28px`   |
| Dropdown menu          | `243px`   | hug      |
