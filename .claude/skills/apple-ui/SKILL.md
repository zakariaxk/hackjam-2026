---
name: apple-ui
description: Apple-inspired UI design language (typography, color, spacing, radii, frosted glass, motion, restraint). Use for every UI decision in this repo's frontend. Inspired-by only — never use Apple logos, product images, SF Pro font files or other trademarked assets.
---

# apple-ui — design skill

Derived on 2026-11-21 from studying apple.com (homepage, /iphone, /macbook-pro) and their
shipped CSS (`globalheader.css`, `homepage main.built.css`, `iphone overview.built.css`).
Values marked *(measured)* were read directly from that CSS. Everything else is a rule
derived from the pages' layout.

**Never** copy logos, product photos, icons, wordmarks or font files. We use the
system font stack, which resolves to San Francisco on Apple devices on its own.

## 1. Typography

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
             "Helvetica Neue", Helvetica, Arial, sans-serif;
-webkit-font-smoothing: antialiased;
```

| Role      | Size (desktop / mobile) | Weight | Line-height | Letter-spacing |
|-----------|-------------------------|--------|-------------|----------------|
| Hero      | 56 / 40px *(measured)*  | 600    | 1.07        | -0.005em       |
| Section   | 48 / 32px *(measured)*  | 600    | 1.08        | -0.003em       |
| Title     | 28 / 24px               | 600    | 1.14        | 0.007em        |
| Eyebrow   | 21 / 19px               | 600    | 1.19        | 0.011em        |
| Body      | 17px *(measured)*       | 400    | 1.47        | -0.022em       |
| Callout   | 14px                    | 400/500| 1.43        | -0.016em       |
| Caption   | 12px                    | 400    | 1.33        | -0.01em        |

Rules:
- Two weights carry everything: 400 and 600. 500 only for small UI labels. Never 800/900.
- Headlines are short, declarative, and end with a period ("Early warning.").
- Numbers in UI (time, battery, confidence) use `font-variant-numeric: tabular-nums`.
- Uppercase only for tiny eyebrow labels (11–12px, +0.06em tracking), sparingly.

## 2. Color

Light surfaces *(measured)*:
- Page `#ffffff`, section gray `#f5f5f7`, near-white `#fbfbfd`
- Text primary `#1d1d1f`, secondary `#6e6e73`, tertiary `#86868b`
- Separators `#d2d2d7` / `rgba(0,0,0,0.08)`, fills `#e8e8ed`

Dark surfaces *(measured)*:
- `#000000`, elevated `#161617`, `#1d1d1f`, `#272729`, `#333336`
- Text primary `#f5f5f7`, secondary `#a1a1a6`, tertiary `#6e6e73`
- Separators `rgba(255,255,255,0.12)`

Accent — **one** blue *(measured)*: `#0071e3` (buttons), `#0066cc` (links on light),
`#2997ff` (links on dark). Hover `#0077ed`.

Status colors (system-style, used only for meaning, never decoration):
- Alert red `#ff3b30` (dark: `#ff453a`)
- Warning orange `#ff9f0a`
- Success green `#30d158`

Rules: no gradients for decoration, no purple, no neon glows. Color = meaning.
At most one saturated color visible per focal area.

## 3. Spacing

4px base. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 120.
- Gutters 22px desktop, 16–20px mobile. Panel inner padding 20–24px.
- Text column max 980px. Nav height 44px (desktop) / 48px (mobile).
- Section padding 80–120px desktop, 48–64px mobile.
- Generous whitespace beats more content. When in doubt, remove.

## 4. Corner radii *(measured)*

- Pills / buttons / badges: `980px`
- Large cards / sheets: `28px`
- Medium cards / panels: `18px`
- Small controls / inputs: `10–12px`
- Thumbnails: `12px`

## 5. Buttons

- Primary: pill, `#0071e3` fill, white 17px/400 text, padding `11px 22px`,
  hover `#0077ed`, active scale 0.98.
- Secondary: pill, `rgba(0,0,0,0.06)` fill (dark: `rgba(255,255,255,0.1)`), primary text color.
- Tertiary: text link in accent blue, optional chevron `›`.
- Destructive: red text on secondary fill. Never a red-filled button unless it's the single focal action.
- Disabled: opacity 0.4, no pointer.
- Min touch target 44×44px.

## 6. Frosted glass *(measured on the global nav)*

```css
/* dark glass (default over imagery/maps) */
background: rgba(22, 22, 23, 0.72);      /* nav uses .8 */
backdrop-filter: saturate(180%) blur(20px);
-webkit-backdrop-filter: saturate(180%) blur(20px);
border: 1px solid rgba(255, 255, 255, 0.08);

/* light glass */
background: rgba(250, 250, 252, 0.8);
backdrop-filter: saturate(180%) blur(20px);
```

Use glass only for things that float over content (nav, panels over a map, sheets).

## 7. Shadow & elevation

Apple uses almost no shadow; separation comes from surface color and blur.
- Floating panel: `0 8px 32px rgba(0,0,0,0.24)` over imagery; on flat surfaces `0 2px 12px rgba(0,0,0,0.06)`.
- Never stack shadows, never colored shadows.

## 8. Motion *(easings measured)*

- Standard: `cubic-bezier(0.4, 0, 0.6, 1)` — 240–400ms.
- Entrances: `cubic-bezier(0.25, 0.1, 0.3, 1)` — 400–600ms.
- Framer Motion spring for panels/sheets: `{ type: "spring", stiffness: 300, damping: 34, mass: 1 }` (no overshoot you can see).
- Fade + 8–16px translate for entrances. Never bounce, never spin, never shake.
- Status pulse: slow (2–2.4s) opacity/scale ring, ease-out, low contrast.
- Respect `prefers-reduced-motion`.

## 9. Restraint rules

1. One focal point per section/panel. Everything else steps back (secondary gray text).
2. Lots of whitespace. Short copy. Sentence case.
3. No emoji, no clip-art icons, no stock dashboard grids of metric cards.
4. Icons: thin 1.5px-stroke line icons (inline SVG) at 16–20px, only when they add meaning.
5. No gradients-for-the-sake-of-it, no glow, no drop-shadowed text.
6. Labels say exactly what things are ("Simulated", "LIVE · LoRa"). Honesty is a design value.
7. Hierarchy via size and weight, not color.
8. Align to a grid; consistent padding inside every panel.

## 10. Tailwind mapping (this repo)

Tailwind v4: tokens live in the `@theme` block of `frontend/src/index.css`:
`text-ink` / `text-mute` / `text-faint`, `bg-fill`, `bg-accent`, `text-link` (#2997ff),
`text-alert` (#ff453a), `text-warn`, `text-ok`; `.glass` / `.glass-strong` for frosted panels;
radii `rounded-panel` (18px), `rounded-sheet` (28px), `rounded-pill` (980px);
easings `ease-apple`, `ease-enter`. Framer Motion spring lives in `components/ui.tsx`.
