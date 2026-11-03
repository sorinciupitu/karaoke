---
name: Karaoke Dark Pulse
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#e7bcbd'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#ad8788'
  outline-variant: '#5d3f40'
  surface-tint: '#ffb3b5'
  primary: '#ffb3b5'
  on-primary: '#680019'
  primary-container: '#ff5166'
  on-primary-container: '#5b0014'
  inverse-primary: '#be0035'
  secondary: '#ffb2bd'
  on-secondary: '#670024'
  secondary-container: '#af0043'
  on-secondary-container: '#ffbcc5'
  tertiary: '#deb7ff'
  on-tertiary: '#4a007f'
  tertiary-container: '#b76dfd'
  on-tertiary-container: '#400070'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffdada'
  primary-fixed-dim: '#ffb3b5'
  on-primary-fixed: '#40000c'
  on-primary-fixed-variant: '#920027'
  secondary-fixed: '#ffd9dd'
  secondary-fixed-dim: '#ffb2bd'
  on-secondary-fixed: '#400013'
  on-secondary-fixed-variant: '#900036'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#deb7ff'
  on-tertiary-fixed: '#2c0050'
  on-tertiary-fixed-variant: '#670fac'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 44px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.005em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system channels the electrifying energy of late-night Tokyo vocal booths merged with the precision and restraint of modern high-fidelity audio interfaces. Designed for high-immersion entertainment and generative audio interaction, it emphasizes performance, focus, and social celebration.

The visual style blends deep obsidian minimalism with frosted glassmorphism and tactile neon luminescence:
- **Base Aesthetic:** Pitch-black and obsidian surfaces eliminate eye fatigue in low-light environments, directing all visual hierarchy to vibrant playback elements, waveform visualizations, and active lyrics.
- **Luminous Energy:** A core vibrant crimson-neon tone anchors interactive focus, radiating subtle atmospheric glows across scrubbers, active states, and real-time AI status indicators.
- **Glass & Depth:** Translucent dark membranes with backdrop blur elevate playback sheets and vocal isolation consoles above live feeds and playlist rows without cluttering the screen.
- **Micro-Interactions:** Snappy, tactile scale shifts on click/touch with soft spring releases convey the feel of premium audio hardware toggles.

## Colors

The palette establishes an absolute contrast hierarchy optimized for dim environments and dynamic stage or living room playback:

- **Primary (`#F71E4D`):** Electric crimson-pink. Reserved for active playback controls, primary conversion actions, current lyric highlight tracking, and live vocal recording states.
- **Secondary (`#FF4D79`):** Lighter neon rose. Used for hover rings, gradient stops on vocal waveforms, active mic feedback, and live pitch-tracking ribbons.
- **Tertiary (`#9B51E0`):** Electric violet. Used exclusively for AI features, indicating stem extraction, dynamic harmony generation, and vocal pitch synthesis.
- **Neutral Stack:**
  - `Canvas / Root`: `#000000` (Pure pitch black for hardware frame blending)
  - `Surface Base`: `#121212` (Spotify-grade obsidian foundational container)
  - `Surface Elevated`: `#181818` (Card components, playlist entries, dialogs)
  - `Surface Raised`: `#242424` (Hover rows, chip containers, input backings)
  - `Text Primary`: `#FFFFFF` (Headlines, track names, sung lyrics)
  - `Text Secondary`: `#B3B3B3` (Artist names, duration timestamps, secondary menus)
  - `Text Tertiary / Muted`: `#71717A` (Track queue placeholders, key signatures, disabled states)
  - `Border / Hairline`: `rgba(255, 255, 255, 0.08)`

## Typography

The type system pairs the geometric modernism of **Plus Jakarta Sans** for prominent musical titles, headers, and lyrics with the technical neutrality of **Inter** for data metrics, queues, audio routing, and settings.

- **Lyrics Typography:** Active lyrics use `display-lg` in `fontWeight: 800` transitioning to pure white with text glow. Inactive lyrics render in `title-lg` with `color: #71717A` and a blur filter of `blur(1px)`.
- **Numbers & Metrics:** Vocal scores, BPM counters, and track timestamps must utilize `font-feature-settings: 'tnum' on, 'zero' on` to prevent layout jitter during live playback.
- **Labels & Badges:** `label-md` and `label-sm` employ uppercase tracking (`letterSpacing: 0.04em` to `0.06em`) to ensure legibility on dark glass pill chips and stems.

## Layout & Spacing

The layout is structured around an adaptive 12-column grid system built for continuous media playback:

- **Desktop (1024px+):** Fixed structural layout featuring a collapsible left sidebar (navigation and playlists, `260px` to `320px`), a fluid central stage (lyric teleprompter, pitch graphs, and AI stem mixers), and an optional right panel for party queues and performance ratings (`300px`). The bottom persistent audio player has a fixed height of `88px` docking edge-to-edge.
- **Tablet (768px - 1023px):** 8-column layout. The left sidebar collapses into an icon rail (`72px`), prioritizing dual views of lyrics and queue side-by-side.
- **Mobile (< 768px):** 4-column layout. Full-bleed immersive screen. The bottom player collapses into a floating `64px` frosted pill resting `12px` above system safe areas. Expanding the player opens a full-screen modal viewport with locked aspect ratio for lyrics and camera effects.
- **Vertical Rhythm:** Strict multiples of 4px and 8px enforce clean visual flow across rapid-scrolling song catalogues and dynamic waveform panels.

## Elevation & Depth

Visual hierarchy does not rely on traditional muddy drop shadows; instead, it utilizes physical surface luminescence, variable opacity sheets, and chromatic glow.

- **Level 0 (Base Canvas):** `#000000` flat solid base.
- **Level 1 (Sub-Panels & Cards):** `#121212` background bordered by a fine stroke `rgba(255, 255, 255, 0.05)`.
- **Level 2 (Hovered Cards & Drawers):** `#181818` with a diffused ambient shadow: `0 8px 24px rgba(0, 0, 0, 0.6)`.
- **Level 3 (Frosted Floating Modules & Modals):** Translucent surface `rgba(24, 24, 24, 0.72)` supported by hardware-accelerated `backdrop-filter: blur(20px) saturate(180%)` and a highlight rim: `inset 0 1px 0 rgba(255, 255, 255, 0.12)`.
- **Glow & Interactive Emphasis:** Active primary controls (Play/Pause, Record, Vocals On) introduce an electric crimson radiance: `box-shadow: 0 0 24px rgba(247, 30, 77, 0.45), 0 0 4px rgba(247, 30, 77, 0.8)`.
- **AI Stem Accent Glow:** AI-powered elements carry a dual-tone violet halo: `box-shadow: 0 0 20px rgba(155, 81, 224, 0.35)`.

## Shapes

The design system adopts a Spotify-inspired fluid geometry dominated by pill shapes and generous curves:

- **Capsule / Pill Philosophy:** All interactable badges, buttons, category filters, and scrub knobs are fully rounded (`border-radius: 9999px`) creating an inviting, thumb-friendly touch target.
- **Containers & Surfaces:** Media cards, modal dialogs, and waveform monitors use `rounded-xl` (`1.5rem` / `24px`) to preserve a modern, friendly consumer-hardware aesthetic.
- **Album Artwork & Miniatures:** Scaled at `rounded-md` (`0.5rem` / `8px`) to keep image content legible and undistorted.
- **Active Lyric Focus:** Dynamic karaoke lyric line containers highlight into smooth `rounded-lg` (`1rem` / `16px`) frosted pills when active.

## Components

### Buttons
- **Primary Playback Button:** Fully rounded pill or circle. Background `#F71E4D`, text `#FFFFFF`. On hover: scale `1.05`, background `#FF4D79`, with an active crimson glow (`rgba(247, 30, 77, 0.4)`). Active tap: scale `0.96`.
- **Secondary / Ghost Button:** Transparent background, hairline border `rgba(255, 255, 255, 0.2)`, text `#FFFFFF`. Hover: border `rgba(255, 255, 255, 0.5)`, background `rgba(255, 255, 255, 0.05)`.
- **Icon Buttons:** Pure black/transparent circular buttons with `#B3B3B3` icons that shift to `#FFFFFF` with scale `1.1` on hover.

### Chips & Filter Pills
- Fully rounded pills. Height `32px`, typography `label-md`.
- **Default State:** Background `#242424`, text `#FFFFFF`.
- **Active State:** Background `#FFFFFF`, text `#000000`, font-weight `700`.

### Lists & Queue Rows
- **Layout:** Height `56px` to `64px`, horizontal flexbox with image thumbnail, title/artist column, duration, and trailing actions.
- **Hover State:** Background `#181818` with subtle transition `150ms ease`. Track title changes from `#FFFFFF` to `#F71E4D` on active playing state.
- **Playing Indicator:** An animated 3-bar soundwave icon colored `#F71E4D` replaces the track index number.

### Input Fields & Search Bars
- Pill-shaped (`border-radius: 9999px`) or `rounded-lg` with background `#242424`, height `48px`, and padding `0 16px`.
- Placeholder text in `#71717A`.
- Active focus state features an internal glow and subtle border `1px solid #F71E4D`.

### Checkboxes, Radios, and Toggles
- **Toggles:** Track background `#3F3F46`, shifting to `#F71E4D` when enabled. Thumb is pure white `#FFFFFF` with seamless spring sliding.
- **Selection Rings:** Circular outline `#71717A` turning to `#F71E4D` fill with white checkmark when selected.

### Media Cards
- Deep surface card `#181818`, `border-radius: 12px`, padding `16px`.
- High-contrast album artwork with subtle overlay on hover. Hovering unveils a floating floating crimson circular play button at the bottom-right corner of the image with a subtle slide-and-fade animation.

### Specialized Karaoke & AI Components
- **Fluid Progress & Pitch Scrubbers:**
  - Track: `4px` height, background `rgba(255, 255, 255, 0.1)`.
  - Elapsed Fill: `#F71E4D` with hover transition to `#FF4D79`.
  - Scrub Handle: Hidden until card hover, `12px` circle `#FFFFFF` with shadow `0 2px 8px rgba(0, 0, 0, 0.5)`.
- **AI Vocal Isolation Badge:**
  - Pill chip using `tertiary_color_hex` (`#9B51E0`) border and `rgba(155, 81, 224, 0.15)` frosted fill.
  - Features an animated pulse dot indicating live stem splitting (e.g., "AI VOCALS REMOVED").
- **Real-Time Lyric Teleprompter:**
  - Centered or left-aligned continuous scroll container.
  - Active line scales to `1.08`, transitions from `#71717A` to `#FFFFFF` with smooth horizontal neon gradient fill tracking the sung syllables in real time.