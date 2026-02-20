# Figma Design Specs — Core Layout Components

> **Source:** Figma file `twVc2ATkqHp84b1LNOSEaj` (IDE)
> **Extracted:** Automated via Figma MCP
> **Purpose:** Structured reference for implementation tasks. All values are exact from Figma.

---

## Table of Contents

1. [Sidebar Container](#1-sidebar-container)
2. [Header](#2-header)
3. [Footer](#3-footer)
4. [IDE Main Screen](#4-ide-main-screen)
5. [Vibe / IDE Toggle](#5-vibe--ide-toggle)
6. [Chat](#6-chat)
7. [Vibe Mode Screen](#7-vibe-mode-screen)

---

## 1. Sidebar Container

**Figma Node:** `37:893` · Type: `COMPONENT`

### Container

| Property        | Value        |
|-----------------|--------------|
| Layout Mode     | `row`        |
| Justify Content | `center`     |
| Gap             | `8px`        |
| Padding         | `4px`        |
| Sizing H        | `hug`        |
| Sizing V        | `hug`        |
| Background      | `#1C1C1D`    |
| Border Color    | `#3C3D40`    |
| Border Width    | `1px`        |
| Border Radius   | `12px`       |

### Inner SVG Container (`29:715`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `column` |
| Gap         | `8px`    |
| Width       | `32px` (fixed) |
| Sizing V    | `hug`    |

### Sidebar Item (Component Set `37:795`)

**Variants:** Default, Hover, Selected

| Property      | Default    | Hover      | Selected   |
|---------------|------------|------------|------------|
| Layout Mode   | `row`      | `row`      | `row`      |
| Align Items   | `center`   | `center`   | `center`   |
| Gap           | `8px`      | `8px`      | `8px`      |
| Padding       | `6px`      | `6px`      | `6px`      |
| Width          | `32px` (fixed) | `32px` (fixed) | `32px` (fixed) |
| Height         | `32px` (fixed) | `32px` (fixed) | `32px` (fixed) |
| Border Radius | `8px`      | `8px`      | `8px`      |
| Background    | none       | `#252628`  | `#252628`  |

### Sidebar Icons (Component Set `37:775`)

| Property | Value  |
|----------|--------|
| Width    | `20px` |
| Height   | `20px` |

**Icon variants:** Home, Folder, search-sm, Git, Play, Plugins, Users, Grid, Book, Map, Brush, Account2

| Property             | Default State | Selected State |
|----------------------|---------------|----------------|
| Stroke Color         | `#8C8D8F`     | `#FCFCFC`      |
| Stroke Weight        | `1px`         | `1px`          |

---

## 2. Header

**Figma Node:** `443:7609` · Type: `COMPONENT_SET`

**Variants:** Default (`443:7608`), Active (`443:7607`)

### Component Set Container

| Property   | Value           |
|------------|-----------------|
| Width      | `1583px`        |
| Height     | `175px`         |
| Radius     | `5px`           |

### Header Row (both variants)

| Property        | Value                    |
|-----------------|--------------------------|
| Layout Mode     | `row`                    |
| Justify Content | `space-between`          |
| Align Items     | `center`                 |
| Gap             | `44px`                   |
| Padding         | `0px 0px 0px 8px`        |
| Width            | `1543px` (fixed)         |
| Sizing V        | `hug`                    |

### Left Section — Logo + Toggle (`Frame 2147230592/593`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `12px`   |
| Sizing      | `hug` / `hug` |

#### Logo Container (`Frame 2147230408`)

| Property      | Value                  |
|---------------|------------------------|
| Width         | `40px` (fixed)         |
| Height        | `40px` (fixed)         |
| Background    | `rgba(255,255,255,0)` (transparent) |
| Border Radius | `12px`                 |

#### Logo Icon (Group inside)

| Property | Value  |
|----------|--------|
| X offset | `8.01` |
| Y offset | `8`    |
| Width    | `23.99px` |
| Height   | `24px` |

#### Toggle Area (`Frame 2147230370`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `4px`    |
| Sizing      | `hug` / `hug` |

##### Toggle Sub-frames

- **Frame 2147230664:** row, align center, gap `8px`, hug/hug
- **Frame 2147230670:** row, align center, hug/hug

### Right Section (`Frame 2147230395`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `20px`   |
| Sizing      | `hug` / `hug` |

#### Active Variant — Action Bar (`Frame 2147230391`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `8px`    |
| Sizing      | `hug` / `hug` |

**Action items in Active variant:**

| Item            | Component         | Size    | Fill      |
|-----------------|-------------------|---------|-----------|
| Config          | `68:2108`         | hug     | `#FFFFFF` |
| Icon Button ×3  | `43:1009`         | `24×24px` | —       |
| Start/Pause     | `43:1515`         | `16×16px` | `#FFFFFF` |

#### Config Badge

| Property | Value            |
|----------|------------------|
| Layout   | row, align center |
| Gap      | `8px`            |
| Padding  | `2px 4px`        |

#### Window Controls (`Frame 2147230388`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Sizing      | `hug` / `hug` |

Each control button (`Frame 2147230383/382/381`):

| Property | Value            |
|----------|------------------|
| Layout   | row, align center |
| Gap      | `10px`           |
| Padding  | `16px`           |
| Sizing   | `hug` / `hug`   |

---

## 3. Footer

**Figma Node:** `443:7673` · Type: `COMPONENT_SET`

**Variants:** Default (`443:7671`), Active (`443:7672`)

### Component Set Container

| Property | Value    |
|----------|----------|
| Width    | `1583px` |
| Height   | `147px`  |
| Radius   | `5px`    |

### Footer Row (both variants)

| Property        | Value                    |
|-----------------|--------------------------|
| Layout Mode     | `row`                    |
| Justify Content | `space-between`          |
| Align Items     | `center`                 |
| Gap             | `40px`                   |
| Padding         | `8px 24px`               |
| Width            | `1543px` (fixed)         |
| Sizing V        | `hug`                    |

### Left Section — Status Icons (`Frame 2147230597`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `20px`   |
| Sizing      | `hug` / `hug` |

**Icon Buttons (×4):** Each `20×20px` (Icons Hover component `43:1009`)

**Default variant icon instances:**

| Icon            | Component ID | Fill      |
|-----------------|-------------|-----------|
| Sidebar toggle  | `43:908`    | `#FFFFFF` |
| Terminal        | `43:907`    | `#FFFFFF` |
| Git             | `43:906`    | `#FFFFFF` |
| Info            | `43:905`    | `#FFFFFF` |

Inner icon size: `16×16px` (offset `2px, 2px` inside `20×20` container)

### Center Section — Breadcrumbs (Active variant only)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `row`    |
| Align Items | `center` |
| Gap         | `2px`    |
| Sizing      | `hug` / `hug` |

**Breadcrumb items:**

| Element   | Type     | Font         | Color     |
|-----------|----------|--------------|-----------|
| Text      | TEXT     | Figtree 14px 500 | `#8C8D8F` |
| Chevron   | INSTANCE | —            | `#FFFFFF` |

Chevron icon: `16×16px`

**Breadcrumb text style:**

| Property    | Value   |
|-------------|---------|
| Font Family | Figtree |
| Font Weight | 500     |
| Font Size   | `14px`  |
| Line Height | `1em`   |
| Text Align  | LEFT    |

### Right Section — Code Navigation Help

| Property        | Value       |
|-----------------|-------------|
| Layout Mode     | `row`       |
| Justify Content | `flex-end`  |
| Align Items     | `center`    |
| Gap             | `4px`       |
| Height          | `26px` (fixed) |
| Sizing H        | `hug`       |

| Element              | Font         | Color     |
|----------------------|--------------|-----------|
| "Code Navigation Help" | Figtree 14px 500 | `#FCFCFC` |
| Chevron (left)       | —            | `#FFFFFF` |

---

## 4. IDE Main Screen

**Figma Node:** `5:6732` · Type: `FRAME` · Name: "Code + project"

### Overall Frame

| Property   | Value                      |
|------------|----------------------------|
| Width      | `1920px`                   |
| Height     | `1080px`                   |
| Background | `rgba(255,255,255,0.11)`   |

### Main Panel (`5:10352` — Frame 2147230361)

| Property        | Value                      |
|-----------------|----------------------------|
| Layout Mode     | `column`                   |
| Align Items     | `flex-end`                 |
| Width            | `1543px` (fixed)           |
| Sizing V        | `hug`                      |
| Position        | x: `189px`, y: `75px`     |
| Background      | `#141415`                  |
| Border Color    | `#2E2F31`                  |
| Border Width    | `1px`                      |
| Border Radius   | `24px`                     |
| Box Shadow      | `0px 4px 26px 15px rgba(38,36,37,0.38), inset 0px 0px 13.1px 6px rgba(26,24,25,0.2)` |

### Header Instance (inside main panel)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `44px`             |
| Padding         | `0px 0px 0px 8px`  |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

### Content Area (`445:12719` — Frame 2147230991)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

#### Left — File Explorer (`5:10610`)

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Align Items | `center`           |
| Gap         | `10px`             |
| Padding     | `0px 0px 0px 12px` |
| Height      | `831px` (fixed)    |
| Sizing H    | `hug`              |

#### Right — Editor Area (`5:12349`)

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Gap         | `12px`             |
| Padding     | `0px 12px`         |
| Width       | `1491px` (fixed)   |
| Sizing V    | `hug`              |

### Footer Instance (inside main panel)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `40px`             |
| Padding         | `8px 24px`         |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

### Layout Summary — Gaps & Margins

| Between                    | Value   |
|----------------------------|---------|
| Sidebar to main panel      | Sidebar ends at `x=189`, implied by sidebar width + gap |
| Main panel left offset     | `189px` from viewport left |
| Main panel top offset      | `75px` from viewport top |
| File explorer left padding | `12px`  |
| Editor area horizontal pad | `12px`  |
| Editor area internal gap   | `12px`  |
| File explorer internal gap | `10px`  |
| Content area height        | `831px` |

---

## 5. Vibe / IDE Toggle

**Figma Node:** `20:3251` · Type: `COMPONENT_SET` · Name: "Vibe / IDE"

**Variants:** IDE (`20:3219`), Vibe (`20:3220`), IDE Hover (`20:3221`), Vibe Hover (`20:3218`)

### Component Set Container

| Property | Value          |
|----------|----------------|
| Layout   | `column`       |
| Gap      | `12px`         |
| Padding  | `10px`         |
| Width    | `113px` (fixed)|
| Sizing V | `hug`          |

### Toggle Button (all variants)

| Property      | Value          |
|---------------|----------------|
| Layout Mode   | `row`          |
| Align Items   | `center`       |
| Height        | `32px` (fixed) |
| Sizing H      | `hug`          |
| Border Color  | `#3C3D40`      |
| Border Width  | `1px`          |
| Border Radius | `12px`         |

### Left Segment ("Vibe" side) — Frame 2147230368

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

#### Inner Indicator (Frame 2147230704)

| Property        | Value          |
|-----------------|----------------|
| Layout Mode     | `row`          |
| Justify Content | `center`       |
| Align Items     | `center`       |
| Gap             | `10px`         |
| Width           | `42px` (fixed) |
| Height          | `28px` (fixed) |

### Right Segment ("IDE" side) — Frame 2147230379

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

### Variant Colors

| State      | Left Segment BG | Left Indicator | Right Segment BG | Right Indicator |
|------------|-----------------|----------------|-------------------|-----------------|
| **Vibe**   | `#1A1B1F`       | `#266FCF` (active, radius `10px 0 0 10px`) | `#1A1B1F` | none (radius `0 6px 6px 0`) |
| **IDE**    | `#1A1B1F`       | none (radius `6px 0 0 6px`) | `#1A1B1F` | `#266FCF` (active, radius `0 10px 10px 0`) |
| **Vibe Hover** | `#1A1B1F`   | `rgba(255,255,255,0.05)` (radius `6px 0 0 6px`) | `#1A1B1F` | `#266FCF` (radius `0 10px 10px 0`) |
| **IDE Hover**  | `#1A1B1F`   | `#266FCF` (radius `10px 0 0 10px`) | `#1A1B1F` | `rgba(255,255,255,0.05)` (radius `0 6px 6px 0`) |

### Key Colors

| Token              | Value                     |
|--------------------|---------------------------|
| Segment Background | `#1A1B1F`                 |
| Active Fill        | `#266FCF`                 |
| Hover Fill         | `rgba(255,255,255,0.05)`  |
| Border             | `#3C3D40`                 |

---

## 6. Chat

**Figma Node:** `590:12283` · Type: `COMPONENT_SET`

**Variants:** Chat (`590:12282`), Add context files (`590:12281`), Selected context (`590:12394`)

### Component Set Container

| Property | Value    |
|----------|----------|
| Width    | `399px`  |
| Height   | `557px`  |

### Chat Variant — Outer Wrapper

| Property    | Value          |
|-------------|----------------|
| Layout Mode | `column`       |
| Gap         | `10px`         |
| Padding     | `8px`          |
| Width       | `359px` (fixed)|
| Sizing V    | `hug`          |

### Chat Input Container (`590:12165`)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `column`           |
| Justify Content | `center`           |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `8px`              |
| Padding         | `12px`             |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |
| Background      | `#1C1C1D`          |
| Border Color    | `#2E2F31`          |
| Border Width    | `1px`              |
| Border Radius   | `12px`             |

### Chat Input Inner (`590:12166`)

| Property    | Value    |
|-------------|----------|
| Layout Mode | `column` |
| Align Self  | `stretch`|
| Gap         | `16px`   |
| Sizing H    | `fill`   |
| Sizing V    | `hug`    |

### Prompt Row (`590:12167`)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `52px`             |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

#### Prompt Placeholder Text

| Property    | Value              |
|-------------|--------------------|
| Text        | "Analysing prompt..." |
| Font Family | Figtree            |
| Font Weight | 500                |
| Font Size   | `16px`             |
| Line Height | `1em`              |
| Color       | `#E9E9EA`          |

#### Send Button

| Property      | Value                      |
|---------------|----------------------------|
| Width         | `24px` (fixed)             |
| Height        | `24px` (fixed)             |
| Padding       | `8px`                      |
| Gap           | `8px`                      |
| Background    | `#FCFCFC`                  |
| Border Color  | `rgba(255,255,255,0.16)`   |
| Border Width  | `1px`                      |
| Border Radius | `16px`                     |

Stop icon inside: `16×16px`

### Action Row (`590:12171`)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `100px`            |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

#### Attach Button

| Property | Value    |
|----------|----------|
| Size     | `20×20px`|
| Icon     | `16×16px`|
| Fill     | `#FFFFFF`|

#### Model Selectors

| Property      | Value                      |
|---------------|----------------------------|
| Layout Mode   | `row`                      |
| Gap           | `4px`                      |
| Sizing        | `hug` / `hug`             |

Each Model Selector Container:

| Property      | Value                      |
|---------------|----------------------------|
| Padding       | `8px 8px 8px 12px` (first) / `8px` (second) |
| Background    | `#1C1C1D`                  |
| Border Color  | `rgba(255,255,255,0.05)`   |
| Border Width  | `1px`                      |
| Border Radius | `8px`                      |
| Height        | `32px` (second, fixed)     |

### Add Context Files Variant

Outer container: same as Chat variant but `width: 359px`

Inner container:

| Property | Value              |
|----------|--------------------|
| Width    | `343px` (fixed)    |
| Height   | `265px` (fixed)    |

Dropdown items (`20:2748`):

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Gap         | `4px`              |
| Padding     | `8px 12px`         |
| Sizing H    | `fill`             |
| Sizing V    | `hug`              |

Section dividers:

| Property     | Value                  |
|--------------|------------------------|
| Border Color | `#2E2F31`              |
| Border Width | `0px 0px 1px` (bottom) |

---

## 7. Vibe Mode Screen

**Figma Node:** `262:7669` · Type: `FRAME` · Name: "Vibe"

### Overall Frame

| Property   | Value                      |
|------------|----------------------------|
| Width      | `1920px`                   |
| Height     | `1080px`                   |
| Background | `rgba(255,255,255,0.11)`   |

### Main Panel (`262:7670`)

| Property      | Value              |
|---------------|---------------------|
| Layout Mode   | `column`            |
| Width         | `1543px` (fixed)    |
| Sizing V      | `hug`               |
| Position      | x: `189px`, y: `76px` |
| Background    | `#141415`           |
| Border Color  | `#2E2F31`           |
| Border Width  | `1px`               |
| Border Radius | `24px`              |
| Box Shadow    | `0px 4px 26px 15px rgba(38,36,37,0.38), inset 0px 0px 13.1px 6px rgba(26,24,25,0.2)` |

### Header Instance

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `44px`             |
| Padding         | `0px 0px 0px 8px`  |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

### Content Area (`277:4909`)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `12px`             |
| Padding         | `0px 12px`         |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

#### Left — Chat Sidebar (`262:7671`)

| Property      | Value              |
|---------------|--------------------|
| Layout Mode   | `column`           |
| Width         | `326px` (fixed)    |
| Height        | `831px` (fixed)    |
| Background    | `#141415`          |
| Border Color  | `#2E2F31`          |
| Border Width  | `1px`              |
| Border Radius | `16px`             |

##### Sidebar Header

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Align Items | `center`           |
| Gap         | `10px`             |
| Padding     | `16px`             |
| Width       | `326px` (fixed)    |
| Height      | `48px` (fixed)     |
| Border      | `0px 0px 1px` bottom `#2E2F31` |

Title text:

| Property    | Value    |
|-------------|----------|
| Font Family | Figtree  |
| Font Weight | 500      |
| Font Size   | `18px`   |
| Line Height | `1.333em`|
| Color       | `#FCFCFC`|

##### Workspace List Section

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Gap         | `16px`             |
| Padding     | `16px`             |
| Width       | `326px` (fixed)    |

Workspace row:

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Gap             | `133px`            |
| Width           | `294px` (fixed)    |

Status badge:

| Property      | Value                       |
|---------------|-----------------------------|
| Padding       | `4px 6px`                   |
| Background    | `rgba(141,95,42,0.22)`      |
| Border Radius | `4px`                       |

Sub-items:

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Justify     | `space-between`    |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Gap         | `8px`              |
| Padding     | `0px 0px 0px 32px` |

Sub-item tag:

| Property      | Value                       |
|---------------|-----------------------------|
| Padding       | `0px 8px`                   |
| Height        | `16px` (fixed)              |
| Background    | `rgba(252,252,252,0.08)`    |
| Border Radius | `4px`                       |

##### New Workspace Section

| Property    | Value              |
|-------------|--------------------|
| Border      | `1px 0px 0px` top `#2E2F31` |
| Padding     | `16px`             |
| Gap         | `16px`             |

| Element         | Font         | Color     |
|-----------------|--------------|-----------|
| "New workspace" | Figtree 14px 500 | `#8C8D8F` |
| Plus icon       | `16×16px`    | —         |

#### Right — Main Content Panel (`277:6605`)

| Property      | Value              |
|---------------|--------------------|
| Layout Mode   | `row`              |
| Height        | `831px` (fixed)    |
| Sizing H      | `fill`             |
| Background    | `#1C1C1D`          |
| Border Color  | `#2E2F31`          |
| Border Width  | `1px`              |
| Border Radius | `16px`             |

##### Left Column (Chat/Editor)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `column`           |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Gap             | `24px`             |
| Width           | `738px` (fixed)    |
| Height          | `831px` (fixed)    |
| Border          | `0px 1px 1px 0px` `#2E2F31` |

Tab bar:

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `16px`             |
| Padding         | `0px 12px 0px 0px` |
| Border          | `0px 1px 1px 0px` `#2E2F31` |

Active tab badge:

| Property      | Value                       |
|---------------|-----------------------------|
| Padding       | `4px 6px`                   |
| Background    | `rgba(148,145,255,0.15)`    |
| Border Radius | `4px`                       |

Chat area:

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `column`           |
| Align Self  | `stretch`          |
| Gap         | `10px`             |
| Padding     | `12px`             |

Inner chat bubble:

| Property      | Value              |
|---------------|--------------------|
| Layout Mode   | `column`           |
| Align Self    | `stretch`          |
| Gap           | `32px`             |
| Padding       | `16px`             |
| Background    | `#2E2F31`          |
| Border Color  | `#2E2F31`          |
| Border Width  | `1px`              |
| Border Radius | `16px`             |

##### Right Column (Preview/Terminal)

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `column`           |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Gap             | `24px`             |
| Padding         | `0px 0px 12px`     |
| Sizing H        | `fill`             |
| Height          | `831px` (fixed, via parent) |

Preview tab bar:

| Property    | Value              |
|-------------|--------------------|
| Layout Mode | `row`              |
| Justify     | `space-between`    |
| Align Items | `center`           |
| Align Self  | `stretch`          |
| Padding     | `0px 8px 0px 0px`  |
| Border      | `0px 0px 1px` bottom `#2E2F31` |

Terminal panel:

| Property      | Value              |
|---------------|--------------------|
| Layout Mode   | `column`           |
| Width         | `419px` (fixed)    |
| Height        | `186px` (fixed)    |
| Background    | `#2E2F31`          |
| Border Color  | `#2E2F31`          |
| Border Width  | `1px`              |
| Border Radius | `16px`             |

Terminal inner sections divider: `1px 0px 0px` top `#4E4F54`

### Footer Instance

| Property        | Value              |
|-----------------|--------------------|
| Layout Mode     | `row`              |
| Justify Content | `space-between`    |
| Align Items     | `center`           |
| Align Self      | `stretch`          |
| Gap             | `40px`             |
| Padding         | `8px 24px`         |
| Sizing H        | `fill`             |
| Sizing V        | `hug`              |

---

## Common Design Tokens Reference

### Colors (from Figma)

| Token Name          | Hex Value                    | Usage                        |
|---------------------|------------------------------|------------------------------|
| bg-primary          | `#141415`                    | Main panel, sidebar backgrounds |
| bg-surface          | `#1C1C1D`                    | Sidebar container, chat input, cards |
| bg-elevated         | `#252628`                    | Sidebar item hover/selected  |
| bg-segment          | `#1A1B1F`                    | Toggle segment background    |
| accent-blue         | `#266FCF`                    | Active toggle segment        |
| border-default      | `#2E2F31`                    | Panel borders, dividers      |
| border-hover        | `#3C3D40`                    | Sidebar container border, toggle border |
| border-alt          | `#4E4F54`                    | Terminal section dividers     |
| text-primary        | `#FCFCFC`                    | Primary text, labels         |
| text-secondary      | `#8C8D8F`                    | Breadcrumbs, secondary labels |
| text-input          | `#E9E9EA`                    | Input placeholder text       |
| icon-default        | `#8C8D8F`                    | Sidebar icons (default)      |
| icon-selected       | `#FCFCFC`                    | Sidebar icons (selected)     |
| icon-action         | `#FFFFFF`                    | Footer icons, action buttons |
| send-button-bg      | `#FCFCFC`                    | Chat send button             |
| send-button-border  | `rgba(255,255,255,0.16)`     | Chat send button border      |
| hover-subtle        | `rgba(255,255,255,0.05)`     | Toggle hover, model selector border |
| tag-bg              | `rgba(252,252,252,0.08)`     | Sub-item tags                |
| status-badge        | `rgba(141,95,42,0.22)`       | Workspace status badge       |
| tab-active-badge    | `rgba(148,145,255,0.15)`     | Active tab indicator         |
| overlay-bg          | `rgba(255,255,255,0.11)`     | Screen background overlay    |
| chat-bubble-bg      | `#2E2F31`                    | Chat message bubble          |

### Typography

| Style          | Font    | Weight | Size   | Line Height |
|----------------|---------|--------|--------|-------------|
| Body / Default | Figtree | 500    | `14px` | `1em`       |
| Body Large     | Figtree | 500    | `16px` | `1em`       |
| Heading        | Figtree | 500    | `18px` | `1.333em`   |

### Spacing Scale (common values from components)

| Value  | Usage                                        |
|--------|----------------------------------------------|
| `2px`  | Breadcrumb gap, toggle inner padding         |
| `4px`  | Sidebar container padding, toggle gap, badge padding |
| `8px`  | Sidebar gap, header gap, chat padding/gap, footer padding-y |
| `10px` | File explorer gap, toggle set padding        |
| `12px` | Header left gap, content area gap, chat container padding, editor padding |
| `16px` | Chat inner gap, workspace list padding, sidebar header padding, terminal padding |
| `20px` | Footer icon gap, right section gap           |
| `24px` | Footer padding-x, content column gap         |
| `32px` | Chat bubble gap, sub-item indent padding     |
| `40px` | Footer gap                                   |
| `44px` | Header gap                                   |
| `52px` | Prompt row gap                               |
| `100px`| Action row gap                               |

### Border Radius Scale

| Value  | Usage                                        |
|--------|----------------------------------------------|
| `4px`  | Status badges, tags                          |
| `6px`  | Toggle inactive indicator corners            |
| `8px`  | Sidebar items, model selector                |
| `10px` | Toggle active indicator corners              |
| `12px` | Sidebar container, logo, chat input, toggle outer |
| `16px` | Chat send button, sidebar panel, main content panel, chat bubble, terminal |
| `24px` | Main panel outer                             |

### Shadows

| Component    | Box Shadow Value                                                                           |
|--------------|--------------------------------------------------------------------------------------------|
| Main Panel   | `0px 4px 26px 15px rgba(38,36,37,0.38), inset 0px 0px 13.1px 6px rgba(26,24,25,0.2)`    |

### Key Dimensions

| Element                | Width     | Height   |
|------------------------|-----------|----------|
| Full viewport          | `1920px`  | `1080px` |
| Main panel             | `1543px`  | hug      |
| Content area height    | —         | `831px`  |
| Vibe chat sidebar      | `326px`   | `831px`  |
| Vibe left column       | `738px`   | `831px`  |
| Terminal panel         | `419px`   | `186px`  |
| Sidebar container      | hug       | hug      |
| Sidebar item           | `32px`    | `32px`   |
| Sidebar icon           | `20px`    | `20px`   |
| Logo container         | `40px`    | `40px`   |
| Logo icon              | `24px`    | `24px`   |
| Toggle height          | `32px`    | —        |
| Toggle segment width   | `46px`    | `32px`   |
| Toggle indicator       | `42×28px` | —        |
| Icon button (header)   | `24px`    | `24px`   |
| Icon button (footer)   | `20px`    | `20px`   |
| Inner icon             | `16px`    | `16px`   |
| Send button            | `24px`    | `24px`   |
| Chat input width       | `359px`   | hug      |
| Sidebar header height  | `48px`    | —        |
| Code nav help height   | `26px`    | —        |
| Main panel offset X    | `189px`   | —        |
| Main panel offset Y    | `75–76px` | —        |
