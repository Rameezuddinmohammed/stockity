# Quad: Design Doc

> "Quad" is a **working name** (the campus quad is where students hang out, and this one is global). Swap it freely; nothing below depends on the name.
> Visual preview: `docs/design/preview.html` (open it in a browser).

**One-line brief:** A global student lounge that feels like a sticker-covered laptop, a student ID card, and a cinema ticket stub. It should feel tactile, loud, and fun around the edges. It gets calm when two people are actually talking, and plain and serious whenever safety comes up.

---

## 1. Research: what Gen Z responds to (and what they reject)

| Finding | What it means for us | Source |
|---|---|---|
| **Tactile maximalism.** Bold color, motion, layered, "touchable" UI. Gen Z prefers something real and expressive over something perfect and minimal. | Chunky shapes you want to press, a sticker-bomb layout, rich color. We don't build a white-and-grey SaaS app. | [aufaitux](https://www.aufaitux.com/blog/tactile-maximalism-gen-z-ui/), [Supercharged](https://www.supercharged.studio/blog/gen-z-design-trends) |
| **Neubrutalism + kawaii.** Thick outlines, hard offset shadows, clashing brights, with cute elements inside. It suits social and education startups. | Our core visual style: ink outlines, hard shadows, rounded corners, a cute mascot. | [neubrutalism.com](https://neubrutalism.com/), [Graphic Eagle](https://www.graphiceagle.com/neubrutalism-bold-and-raw-interfaces-redefining-ui-design-in-2025/), [Fuselab](https://fuselabcreative.com/mobile-app-design-trends-for-2025/) |
| **Dopamine colors + expressive animation + meme culture** (Partiful). It turned boring party planning into something people share. | Every mode gets its own bright color. Signature animations for key moments. Make things people want to screenshot (tickets, ID cards). | [Wikipedia: Partiful](https://en.wikipedia.org/wiki/Partiful), [App Store: app aesthetics](https://apps.apple.com/us/iphone/story/id1888002859) |
| **Microinteractions + a character** (Duolingo + Rive). Small movements celebrate progress, and state-machine animation reacts to what the user does. | A mascot for empty, loading, and waiting states. Small celebrations on match, connect, and win. Rive later. | [Duolingo × Rive](https://dev.to/uianimation/how-duolingo-uses-rive-for-their-character-animation-and-how-you-can-build-a-similar-rive-mascot-5d19), [60fps.design](https://60fpsdesign.substack.com/p/fun-in-every-frame) |
| **Dark mode is expected** (~82% of Gen Z). | Dark and light modes are both first-class. The call screen is always dark. | [aufaitux](https://www.aufaitux.com/blog/tactile-maximalism-gen-z-ui/) |
| **Bento grids** scan fast. **Glassmorphism** is back, used with restraint. **Holographic/iridescent** accents read as Gen Z. | Home screen is a bento grid. Frosted glass only for controls over video. One holographic accent (the verified badge). | [index.dev](https://www.index.dev/blog/ui-ux-design-trends), [Muzli](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/) |
| **Intimate, authentic social** (BeReal, Locket). No public comparison, no pressure to perform, no algorithmic feed. | No follower counts, likes, or leaderboards of people. Show people and moments, not metrics. | [The Up and Up](https://www.theupandup.us/p/locket-app-genz-social-media-internet), [TechCrunch](https://techcrunch.com/2025/11/03/lockets-social-app-is-picking-up-steam-with-gen-alpha/) |
| **Onboarding friction.** Each extra sign-up field costs about 10 points of completion. Collect profile details gradually. | Sign-up is email → code → name + date of birth. Everything else is asked later, only when needed. | [Stream: chat UX](https://getstream.io/blog/chat-ux/) |
| **Honest safety cues.** Present reporting as a real safety tool without claiming moderation catches everything. Remind people not to overshare early. | Safety copy is plain and honest. The report button is always visible. Links and numbers are blocked early in a chat. | [knot.chat](https://knot.chat/), [Besedo](https://besedo.com/blog/creating-trust-and-safety-in-ux-design/) |
| **Neurodivergent-friendly.** High contrast, clarity, less mental load. | "Calm mode": less motion and saturation, no sounds. Strong contrast everywhere. | [index.dev](https://www.index.dev/blog/ui-ux-design-trends) |
| **Brands trying too hard get mocked.** Discord made its palette more playful while staying readable. | Friendly and casual, but no forced slang. Playful visuals, clear words. | [Discord: Blurpthday](https://discord.com/blog/happy-blurpthday-to-discord-a-place-for-everything-you-can-imagine) |

---

## 2. Design principles

1. **It should feel like somewhere you hang out.** Home is a lounge you walk into, with rooms, events, and people online. There's no infinite feed to scroll.
2. **Loud around the edges, quiet in the middle.** Menus, lobbies, and celebrations are playful. During a call or a movie the UI steps back and the person or the film is the focus.
3. **Everything is pressable.** Buttons have weight: an ink outline and a hard shadow, and they sink when pressed. Anything tappable looks tappable.
4. **Safety is calm, direct, and one tap away.** When safety comes up, the playful style switches off: no jokes, no mascot, plain words, one clear action.
5. **Real over perfect.** No beauty filters and no follower counts. Show the university and a passport of the countries you've met. Status comes from curiosity, not popularity.
6. **Global from day one.** Flags, time zones, and many languages. Fonts and layouts must handle names in any script.

---

## 3. Brand concept and motifs

The visual world is **student life objects, remixed.** Every motif is a real object students already carry or collect:

| Motif | Used for |
|---|---|
| **Student ID card** (lanyard, photo, uni crest area, holographic strip) | Profile card, the other person's card when you match, shareable profile |
| **Passport + stamps** | Countries and universities you've chatted with; the "stamp" animation after a good chat |
| **Cinema ticket stub** (perforated edge, seat number in mono) | Cinema reservations; a story-ready image to share |
| **Stickers** (slightly rotated, white die-cut border) | Badges, labels, reactions, empty-state decoration |
| **Noticeboard flyer** | Events (Global Hour, game nights, screenings) |
| **Game pieces** (dice, cards, tokens) | Play and Tables sections |

**Mascot: "Pip"** (placeholder name). A small, squishy lime creature with a sticker outline and big eyes. It appears in loading, matchmaking, empty, and error states, plus onboarding and celebrations. **It never appears in the call screen or in safety flows.** v1 uses static SVG and CSS animation; later it moves to a Rive state machine (idle / searching / cheering / sleepy).

---

## 4. Voice and tone

Write like a friendly upperclassman: warm, quick, a little cheeky, never cringe.

| Do | Don't |
|---|---|
| "Finding someone cool…" | "Initiating matchmaking sequence" |
| "Say hi to Aisha from Nairobi 🇰🇪" | "User connected." |
| "No one's around right now. Global Hour starts in 2h 14m, set a reminder?" | "No users available. Please try again later." |
| "You both hit Connect 🎉 Socials unlocked." | "Mutual connection established." |
| "Something went wrong on our side. Try again?" | "Oopsie woopsie!! 🙈" |
| Lowercase is fine in playful spots ("next →") | Forced slang: "no cap fr fr bestie" |

**Safety voice is different: plain, calm, direct.** For example: "Report sent. You won't be matched with this person again. Our team reviews every report." No emoji, no jokes, no mascot.

Emoji are fine in casual copy and reactions, but never as the only way something is labelled.

---

## 5. Design tokens

### 5.1 Color

**Core**
| Token | Light | Dark | Role |
|---|---|---|---|
| `--ink` | `#16131F` | `#F7F4FF` | Text |
| `--bg` | `#F7F4FF` "Chalk" (lilac-tinted off-white) | `#120F1C` "Night" | Page background |
| `--surface` | `#FFFFFF` | `#1E1A2E` | Cards, sheets |
| `--muted` | `#5E5873` | `#A8A1BF` | Secondary text (≥ 6:1 contrast) |
| `--line` | `#16131F` | `#EDE8FF` | Outlines + hard shadows on interactive things (light outlines give dark mode its punch) |
| `--hairline` | `#D9D3EA` | `#3A3450` | Quiet dividers, table rows |
| `--on-bright` | `#16131F` | `#16131F` | Text on bright fills; stays dark in both modes |

**Mode colors** (each mode owns one; used as **fills with ink text**, never as text on the page background)
| Token | Hex | Mode | Ink-on-fill contrast |
|---|---|---|---|
| `--grape` | `#7B5CFF` (text-bearing fills use `--grape-strong #6A45FF` with white text, 5.4:1) | **Just Chat** + brand primary | white on `#6A45FF`: 5.4:1 |
| `--zest` | `#D4FF3A` | **Play** (Quick Play) | 15.8:1 |
| `--tang` | `#FF9142` | **Tables** | 8.2:1 |
| `--gum` | `#FF5FA2` | **Cinema** | 6.5:1 |
| `--sky` | `#4FC3FF` | **Global / Passport / events** | 9.2:1 |

Grape used as *text* on the page: `#5B3BF0` in light mode (5.8:1), `#A48BFF` in dark mode (7:1).

**Semantic** (kept separate from the fun palette so they always read as serious)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--danger` | `#C81E2A` | `#FF6B6B` | Report, block, ban, destructive actions **only** |
| `--success` | `#127A4A` | `#4ADE9A` | Verified, saved |
| `--warn` | `#9A5B00` | `#FFC04D` | Warnings, strike notices |

**Rules**
- Brights are **surfaces**. Text on them is always `--on-bright` (or white on `--grape-strong`/`--danger`).
- **Don't put two brights next to each other without an ink outline between them.** The outline is what keeps the look from turning into a mess.
- **Holographic** gradient (`conic-gradient` of grape → sky → zest → gum), used **only** on the verified badge and the ID-card strip. Scarcity keeps it special.
- Red is reserved for safety. Never use red for "fun" or "hot" or "trending".

### 5.2 Typography

| Role | Face | Why |
|---|---|---|
| **Display** | **Bricolage Grotesque** (Google Fonts, OFL, variable weight + optical size) | Quirky grotesque with character; widely cited as a Gen Z-friendly free face. Headlines at 700–800 with tight tracking. |
| **Body / UI** | **Figtree** (Google Fonts, OFL) | Friendly geometric sans, very readable at small sizes, less generic than Inter. |
| **Utility** | **IBM Plex Mono** | Ticket stubs, seat numbers, ID numbers, timers, and codes. Suggests printed tickets and ID cards. |
| **Fallbacks** | `Noto Sans` + the matching `Noto Sans {Devanagari, Arabic, JP, KR, SC…}` + `system-ui` | Names and chat come from every script. Never render tofu (empty boxes). |

**Scale** (1.25 ratio, rem): `12 / 14 / 16 (body) / 20 / 25 / 31 / 39 / 49 / 61`
- Display XL 61/0.95, weight 800, tracking −0.03em. Used on the landing page and in celebrations only.
- H1 39/1.05 800 · H2 31/1.1 700 · H3 25/1.15 700 · Body 16/1.5 · Small 14/1.45 · Label 12 uppercase +0.08em (Plex Mono)
- Minimum body size is 16px on mobile. Headings use `text-wrap: balance`.

### 5.3 Shape, borders, shadows, space

| Token | Value |
|---|---|
| Border | `2px solid var(--line)` (3px on hero stickers) |
| Radius | `--r-sm 10px` (chips), `--r-md 16px` (buttons, inputs), `--r-lg 24px` (cards), `--r-xl 32px` (sheets), `999px` (pills, avatars) |
| Hard shadow | `--shadow: 4px 4px 0 var(--line)`, `--shadow-lg: 6px 6px 0 var(--line)`. **No blur.** |
| Press | On `:active`: `transform: translate(4px,4px); box-shadow: 0 0 0` (the button sinks into its shadow) |
| Hover (desktop) | Lift `translate(-1px,-1px)` + `--shadow-lg` |
| Sticker tilt | `rotate(-3deg … 3deg)`, random per instance but stable (seeded by id) |
| Spacing | 4-pt scale: `4 8 12 16 20 24 32 40 56 72` |
| Texture | Very subtle grain overlay (2–3% opacity SVG noise) on backgrounds only, never behind text blocks |
| Glass | Only for controls over video: `backdrop-filter: blur(16px)`, `rgba(18,15,28,.55)`, 1px white/15% border |

### 5.4 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120ms | Press and toggle feedback |
| `--dur-2` | 220ms | Most transitions |
| `--dur-3` | 400ms | Sheets, page transitions |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | Default |
| `--spring` | Motion spring `{ stiffness: 500, damping: 28 }` | Stickers, cards popping in, the dice |

**Signature moments.** These are the only places allowed to be flashy.
1. **Match found:** a slot machine of flags and university names spins, lands on theirs, and their ID card slides up (~1.2s total, skippable).
2. **Connect:** both cards bump together, confetti in both people's mode colors, then "Socials unlocked".
3. **Passport stamp:** after a chat longer than 2 minutes with a new country, a stamp thunks onto the passport with a short haptic.
4. **Seat pick:** the seat bounces, then a ticket stub "prints" out from the bottom of the screen.
5. **Dice roll / card flip:** physical, springy, and the result is always legible within 600ms.

**Rules:** animate only `transform` and `opacity`. Honor `prefers-reduced-motion` by swapping animations for fades. **Calm mode** (an in-app toggle) turns motion down to fades, desaturates brights by 30%, and mutes sounds.

### 5.5 Iconography, illustration, sound

- **Icons:** [Phosphor](https://phosphoricons.com/) *Bold* weight for UI, *Fill* for active states. Chunky, friendly, and consistent with 2px outlines. 24px default, 44px minimum touch target.
- **Illustration:** flat color + ink outline + stickers. No 3D blobs and no "corporate Memphis" people.
- **Flags:** native emoji flags with an SVG fallback for platforms that don't render them (Windows).
- **Sound (optional, off in Calm mode):** short soft UI sounds for match found, connect, stamp, dice. Every sound is under 300ms and not played during calls, except the match sound.
- **Haptics (mobile):** light on press, medium on match, success pattern on connect.

---

## 6. Components

| Component | Spec |
|---|---|
| **Button: primary** | `--grape-strong` fill, white text, 2px ink border, hard shadow, press-sink. Height 52 (mobile) / 44 (desktop). Label in Figtree 600. |
| **Button: mode** | Mode-color fill + ink text (e.g. zest "Play"). |
| **Button: secondary** | Surface fill, ink text, border + shadow. |
| **Button: ghost** | No border or shadow. Only for tertiary actions. |
| **Button: danger** | `--danger` fill, white text, **no tilt, no bounce**. |
| **Chip / tag** | Pill, 2px border, 14px text; selected = mode-color fill. Interests and filters. |
| **Sticker** | Die-cut white border (3px) + ink outline, slight tilt. Badges ("verified", "new", "Global Hour"). |
| **Bento tile** | `--r-lg`, border + shadow, mode-color fill or surface. Contains a title, one line of info, and a live element (online count, countdown, a table filling up). |
| **ID card** | 85.6:54 ratio (real ID-1 card size). Avatar, display name (Bricolage), university + flag, course/year, 3 interest chips, holographic verified strip. Used for profile, match intro, and sharing. |
| **Ticket stub** | Perforated divider (radial-gradient notches), film title, time, seat (Plex Mono), barcode-style decoration, mode color gum. |
| **Passport** | Spread of stamps (rotated circles or rectangles with country and date), count of countries and universities. |
| **Input / OTP** | 2px border, `--r-md`; focus = 3px grape outline offset 2px. OTP = 6 separate boxes that auto-advance and accept a paste. |
| **Sheet / modal** | Bottom sheet on mobile (`--r-xl` top corners, drag handle), centered modal on desktop. |
| **Toast** | Sticker-style, slides from the top, auto-dismisses after 4s. Safety toasts are plain surface with an icon, no tilt. |
| **Avatar** | Circle, 2px border, an optional mode-color ring when online. A default avatar is generated from the name, so a photo is never required. |
| **Verified badge** | Small holographic sticker + "Verified · University of X". Tooltip explains how verification works. |
| **Online counter** | Live-dot pulse + "2,481 students online", tabular numerals. |

Focus states: every interactive element gets a **3px grape (or ink in dark mode) outline with a 2px offset**, styled to match the brand and never removed.

---

## 7. Key screens

### 7.1 Landing (web)
- Hero: huge Bricolage headline ("meet students from everywhere."), a stack of three tilted ID cards from different countries, a live online counter, and a Global Hour countdown.
- Sections: four mode tiles, how verification works (in 3 steps), safety promise (plain-voice), campus waitlist progress ("UoT: 212/300 to unlock 🔓"), FAQ.
- Primary CTA: "Get in with your college email".

### 7.2 Onboarding (progressive, under 60 seconds)
1. College email → recognizes the university: "Oh hey, University of Toronto 🇨🇦"
2. 6-digit code (auto-advance, paste, resend timer)
3. Name + date of birth (the 18+ check happens here, with plain copy explaining why)
4. "The vibe check": 3 guideline cards the user swipes through (be kind · no nudity · no sharing personal info too early). Tap "I'm in".
5. Straight to Home. **Interests, about, socials, avatar are asked for later**: the first time the user taps Connect, or through a profile-completion sticker on Home.

### 7.3 Home: "the Quad" (bento grid)
```
┌───────────────────────────┬─────────────┐
│  JUST CHAT (grape, big)   │  QUICK PLAY │
│  2,481 online · [Start →] │  (zest)     │
├─────────────┬─────────────┴─────────────┤
│ TABLES      │ CINEMA (gum)              │
│ (tang)      │ Tonight 9pm · Spirited…   │
│ Ludo 3/4 ●  │ 38/60 seats · [Reserve]   │
├─────────────┴──────────┬────────────────┤
│ GLOBAL HOUR in 2:14:07 │ PASSPORT 12 🌍 │
│ (sky, flyer style)     │ stamps preview │
└────────────────────────┴────────────────┘
```
- Top bar: avatar (→ profile), Calm mode toggle, notifications.
- On mobile the bento stacks into two columns, with Just Chat full width.
- Bottom nav on mobile: **Quad · Play · Cinema · Friends · Me**.

### 7.4 Matching
- Full-screen, mode color background. Pip "searching" animation, plus a rotating globe or flag carousel.
- Shows live filters as chips ("anywhere · English · 🎬 film nerd") and a timer. After 10s: "Widening to everywhere…"
- Pre-call self-camera preview in a rounded frame, so you can check yourself before a stranger sees you.

### 7.5 Call screen (always dark, the quietest screen)
```
┌─────────────────────────────────────┐
│ [ID chip: Aisha · U of Nairobi 🇰🇪] [🛡]│ ← shield = Report, ALWAYS visible
│                                     │
│          THEIR VIDEO (full)         │
│                         ┌────────┐  │
│                         │  you   │  │ ← draggable self preview
│                         └────────┘  │
│  chat bubbles float up here ↑       │
│ ┌─────────────────────────────────┐ │
│ │ 🎮  💬  🎤  📷   [Connect ✦] [Next →]│ ← glass bar, thumb zone
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```
- Desktop: video on the left (16:9), chat panel on the right (360px).
- Chat bubbles: theirs = surface, yours = grape-strong. Links and phone numbers are blurred during the first 5 minutes, with the tooltip "Links unlock after 5 min, for safety".
- 🎮 opens the **Quick Play tray** (sheet): tic-tac-toe, would-you-rather, trivia, two truths. The game renders as a floating card over the bottom half; the video stays visible.
- **Next** needs one tap. **Report** (shield) opens the sheet immediately and blurs their video at the same moment.
- An **icebreaker prompt** appears if nobody has typed or spoken for 8 seconds ("Ask them: best food near campus?").

### 7.6 Safety flows (plain mode)
- Report sheet: category list (big tap rows) → optional note → "Report and leave". Their video is blurred from the first tap.
- Afterwards: "Report sent. You won't see them again." plus a short "Need to talk to someone?" link to support resources.
- Auto-blur (NSFW detected): their video blurs, with a small label "Blurred for your safety" and options to [Keep blurred] [Report] [Next].
- Strike notice to the offender: a clear rule reference, the consequence, and how to appeal. No shaming language.

### 7.7 Tables
- Lobby: list of table cards (game art, 3/4 seats filled with avatars, voice/video icon). Tables that are **filling up are sorted first**. "Quick join" is the big button.
- Table: board center stage, player seats around the edge with small video or voice tiles, turn indicator = mode-color glow + timer ring. Emoji reactions fly across the board.

### 7.8 Cinema
- Schedule: a column of flyer-style posters (title, time in the user's time zone, seats left, host club).
- Seat map: a curved screen at the top, seats as rounded squares (free = surface, taken = avatar, yours = gum). Rows labelled A–H in Plex Mono. **Your row** is highlighted (voice/video with your row neighbors).
- Confirmation: the ticket stub prints out, with [Add to calendar] and [Share to story] (exports a 1080×1920 PNG).
- In the room: dark, the film fills the screen, the room chat collapses to a slim rail, reactions float up, and your row's tiles sit in a small dock.

### 7.9 Profile ("Me")
- The ID card at top (tap to flip: the back shows interests, languages, socials visibility).
- Passport section, connections, settings. There's no public follower count anywhere.

### 7.10 Empty and error states
- Always Pip plus one line plus one action. For example, empty friends: Pip holding a sign, "no friends yet, go make some →" [Start chatting].

### 7.11 Admin panel
- **Deliberately plain** (the same tokens, no stickers or tilt). It's a work tool: tables, filters, keyboard shortcuts for the report queue (A = action, S = skip, B = ban).

---

## 8. Things people will share (design for growth)
- **Ticket stub** → Instagram story (1080×1920) with the app handle.
- **ID card** → "find me on Quad" card.
- **Passport** → "I've met students from 14 countries".
- **Quad Wrapped** (end of semester) → countries, hours in Cinema, favorite game, top interest. Spotify Wrapped-style swipe story.
Every shareable image has the handle and URL in the corner and never shows another user's face or name unless they agreed to it.

---

## 9. Accessibility and inclusivity (non-negotiable)
- WCAG 2.2 AA: text ≥ 4.5:1, large text and UI ≥ 3:1 (the palette in §5.1 is already checked).
- Color is never the only signal: mode tiles also carry an icon and a label; turn state has a timer ring **and** text.
- Touch targets ≥ 44×44px; key call controls ≥ 56px.
- Full keyboard support on web, visible focus, logical tab order; call controls have shortcuts (N = next, M = mute, R = report).
- `prefers-reduced-motion` and **Calm mode** (see §5.4).
- Screen reader labels on every icon button; live regions announce "Matched with Aisha from University of Nairobi".
- Captions: later, optional live captions on calls (on-device speech-to-text where supported), which also helps with language barriers.
- i18n: all strings externalized; RTL layout support (Arabic, Hebrew); Noto fallbacks; dates and times in the user's locale and time zone.
- Gender-neutral copy; pronouns field optional; avatars never required to be photos.

---

## 10. Anti-patterns (don't ship these)
- Generic SaaS: white background, grey cards, blue buttons, Inter everywhere.
- Purple-to-blue gradient heroes, soft blurry drop shadows, `rounded-lg` everything.
- Glassmorphism outside the video controls; neumorphism anywhere.
- Follower counts, public likes, "hot" leaderboards of people, streak guilt ("You'll lose your streak!!").
- Dark patterns: hidden unsubscribe, confirm-shaming ("No thanks, I hate fun"), fake online counts.
- Mascot or jokes near safety, reports, bans, or age checks.
- Autoplaying sounds, or motion that can't be turned off.

---

## 11. Implementation notes (fits the $0 stack)
- **Tokens:** CSS custom properties in `packages/ui/tokens.css` (light + dark + calm), exposed to **Tailwind v4** via `@theme`. The mode color is set per section with `data-mode="chat|play|tables|cinema"` → `--mode` variable.
- **Primitives:** **shadcn/ui** (Radix-based, accessible) restyled to our tokens: Dialog, Sheet, Popover, Tabs, Toast, Tooltip, Slider, Switch.
- **Motion:** **Motion** (motion.dev, formerly Framer Motion) for springs and layout animations; **canvas-confetti** for Connect; CSS keyframes for simple things.
- **Mascot:** v1 SVG + CSS; v2 **Rive** (free tier, small files, state machines).
- **Icons:** `@phosphor-icons/react`.
- **Fonts:** self-hosted via `next/font/google` (Bricolage Grotesque, Figtree, IBM Plex Mono) with `display: swap`; subset Latin first and load Noto script fallbacks on demand.
- **Share images:** render with `@vercel/og`/Satori (runs anywhere) or client-side `html-to-image`.
- **Component preview:** Ladle or Storybook in `packages/ui` so every component is reviewed in light, dark, and calm modes.
- **Performance budget:** call screen JS < 200KB gzip, 60fps on a mid-range Android phone. Overlays over video use only `transform` and `opacity`.

---

## 12. Sources
- [Tactile Maximalism: The Gen-Z UI Trend Explained (aufaitux)](https://www.aufaitux.com/blog/tactile-maximalism-gen-z-ui/)
- [What Gen Z Design Aesthetics Say About Modern Branding & UX (Supercharged Studio)](https://www.supercharged.studio/blog/gen-z-design-trends)
- [12 UI/UX Design Trends That Will Dominate 2026 (index.dev)](https://www.index.dev/blog/ui-ux-design-trends)
- [Mobile App Design Trends 2026 (Muzli)](https://muz.li/blog/whats-changing-in-mobile-app-design-ui-patterns-that-matter-in-2026/)
- [Neubrutalism: The Definitive Guide](https://neubrutalism.com/)
- [Neubrutalism: Bold and Raw Interfaces (Graphic Eagle)](https://www.graphiceagle.com/neubrutalism-bold-and-raw-interfaces-redefining-ui-design-in-2025/)
- [Future of App Design: Trends for 2026 (Fuselab)](https://fuselabcreative.com/mobile-app-design-trends-for-2025/)
- [Partiful (Wikipedia)](https://en.wikipedia.org/wiki/Partiful)
- [5 App Aesthetics We're Loving (App Store)](https://apps.apple.com/us/iphone/story/id1888002859)
- [How Duolingo Uses Rive for Character Animation (DEV)](https://dev.to/uianimation/how-duolingo-uses-rive-for-their-character-animation-and-how-you-can-build-a-similar-rive-mascot-5d19)
- [Fun in Every Frame (60fps.design)](https://60fpsdesign.substack.com/p/fun-in-every-frame)
- [A more intimate internet: Locket (The Up and Up)](https://www.theupandup.us/p/locket-app-genz-social-media-internet)
- [Locket picking up steam with Gen Alpha (TechCrunch)](https://techcrunch.com/2025/11/03/lockets-social-app-is-picking-up-steam-with-gen-alpha/)
- [Happy Blurpthday to Discord (Discord)](https://discord.com/blog/happy-blurpthday-to-discord-a-place-for-everything-you-can-imagine)
- [Chat UX Best Practices (Stream)](https://getstream.io/blog/chat-ux/)
- [Creating Trust and Safety in UX Design (Besedo)](https://besedo.com/blog/creating-trust-and-safety-in-ux-design/)
- [Best free Google Fonts 2026 (Typewolf)](https://www.typewolf.com/google-fonts)
