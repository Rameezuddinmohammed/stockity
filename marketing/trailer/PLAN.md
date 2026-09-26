# Quad launch trailer: plan

46 seconds, 16:9 (1920×1080, 30fps), 120 BPM (1 beat = 0.5s, 1 bar = 2s).
Everything is in `index.html`: the picture is a pure function of time (`seek(t)`), and the
soundtrack is synthesized with Web Audio from the same timeline, so cuts land on the beat
and the render is identical every time. `render.mjs` turns it into `quad-trailer.mp4`.

## Rules we keep (from CLAUDE.md and docs/DESIGN.md)
- Only features that exist today are shown as live. Play, Tables, Cinema and Global Hour are labelled **coming soon**.
- No invented numbers: no online counts, no user totals, no waitlist figures.
- The safety beat uses the plain style: no tilt, no stickers, no mascot, calm music.
- Quad Bot is always labelled as a bot.
- Tokens, fonts and motifs come from DESIGN.md: Bricolage Grotesque / Figtree / IBM Plex Mono, ink outlines and hard shadows, mode colors, ID card, stickers, holographic strip only on "verified".

## Storyboard

| Time | Scene | Picture | Music |
|---|---|---|---|
| 0–4s | **Somewhere right now** | Night background. "somewhere right now," then a city and flag swapped on every beat (Nairobi, Toronto, Seoul, São Paulo…). | Filtered chord stabs, hats. The kick comes in at 2s. |
| 4–9s | **Title** | "…a student is looking for someone to talk to." Then the QUAD logo slams in as a sticker, Pip pops up, and the tagline reads "meet students from everywhere." | Impact at 7s, then the full groove with bass. |
| 9–15s | **Verified** | The onboarding flow: a college email types in, "Oh hey, University of Nairobi 🇰🇪", the 6-digit code fills, and a holographic "verified" sticker appears. Side captions: college email · 6-digit code · 18+. | Groove. |
| 15–23s | **Just Chat** | Grape background, "Finding someone cool…", a slot machine of flags and universities lands on TU Munich, and the ID card slides up. Then the dark call screen: chat bubbles, an icebreaker, the Connect / Next bar. | Groove, plus an arpeggio. |
| 23–29s | **Safety (plain)** | Quiet dark surface. Four plain lines: report is one tap and blurs instantly · your IP stays hidden · links unlock after 5 minutes · every account is a verified student. | Drums drop out. Warm pad and a soft pulse. |
| 29–33s | **Quad Bot** | "nobody around yet?" A Quad Bot card, clearly labelled as a practice partner, with a greeting bubble. | Hats and bass come back. |
| 33–39s | **What's next** | A bento grid slams in tile by tile on the beat: Just Chat (live now), Quick Play, Tables, Cinema, Global Hour (coming soon). | Build: snare roll and a noise riser. |
| 39–46s | **Finale** | Drop. Three tilted ID cards fly in, then the huge "meet students from everywhere.", the logo and the CTA "Get in with your college email →". | Full drop with lead, then a final hit and tail. |

## Making it / changing it
- Preview: open `index.html` in a browser and press **Play** (space also works). Drag the scrubber to jump around.
- Render: `node marketing/trailer/render.mjs` (needs `playwright` and `ffmpeg-static`, see the header of that file).
- To retime a scene, edit the `SCENES` table in `index.html`; the music lives in `buildMusic()` and uses the same seconds.

## Next ideas
- A 9:16 cut (15s) for Reels/TikTok: the Title, Just Chat and Finale scenes re-laid out for a vertical frame.
- Swap the synthesized track for a licensed one at 120 BPM; the cuts will still land on the beat.
- Replace the video placeholders in the call scene with real, consented footage from the launch campuses.
