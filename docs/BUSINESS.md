# Campus Chat: Business Analysis

Verified university students (18+) meeting worldwide through random chat, games, and watch parties.

**Summary:** This can work as a focused product. The aim is to become *the* place students worldwide hang out, not to reach Omegle's size. The technology and cost are the easy part. Four things decide whether it works: **enough people online at the same time**, **gender balance**, **retention after the novelty wears off**, and **safety**.

---

## 1. Why earlier products failed

| Product | What happened | Root cause |
|---|---|---|
| **Omegle** (2009–2023) | Still had huge traffic (tens of millions of visits/month) when it shut down in Nov 2023. | Anonymity meant bad behaviour had no consequences, so nudity, predators, and trolls took over. In *A.M. v. Omegle*, the court let a claim proceed arguing the product's *design* was defective, getting around the usual legal immunity platforms have for what users post. The founder cited the stress and cost of fighting misuse. Advertisers avoided it, so it barely made money. |
| **Chatroulette** (2009–10) | Grew very fast, then collapsed within months. | Nudity flooded the site and ordinary users left. |
| **Monkey** (teen video chat) | Pulled from app stores. | Child-safety concerns. |
| **Yik Yak** (anonymous college app) | Shut down in 2017 (relaunched later). | Bullying and threats enabled by anonymity. |
| **Houseparty** (group video + games) | Bought by Epic Games in 2019. Usage spiked during the pandemic. Shut down in 2021. | Games plus video brought people in, but they stopped coming back once the novelty (and lockdown) ended. Nothing kept people connected over time. |

**The pattern:** anonymous random chat attracts the worst users. They drive out everyone else, and then legal liability finishes the product off. Adding games alone doesn't keep people. Technology and infrastructure cost were never the reason.

---

## 2. Why this could work
1. **Every user is verified.** A university email or ID, plus bans that stick to the person, directly fixes what killed Omegle.
2. **The model is proven.** Facebook started college-only. Sidechat and Fizz grew on verified college emails. Being exclusive gives people a reason to join.
3. **Students share a lot of context:** majors, exams, study abroad, campus life. It is easier to start a conversation than with a random stranger.
4. **Clean content means advertisers will pay.** Student brands, edtech companies, study-abroad agencies, and internship platforms all want this audience.
5. **Omegle's shutdown left a gap** that no one has filled with a clean alternative.
6. **Running costs are almost zero** (see PLAN.md §9), so there is time to experiment.
7. **Activities (games, cinema) make it easier to talk.** They cut awkwardness and give people reasons to come back (see §5).

## 3. Why it might not work
1. **Not enough people online at once (the biggest risk).** Random matching feels dead if a match takes more than ~10 seconds, which needs roughly 100+ people online at the same moment. Users spread across time zones make this harder, not easier.
2. **Sign-up friction.** Omegle took one click. Every step (OTP, profile, date of birth) loses some users.
3. **Taking out NSFW content removes a lot of demand.** Much of Omegle's traffic was sexual or trolling. The clean market is real but smaller.
4. **Gender imbalance.** Random-chat apps skew heavily male. When women have bad experiences they leave, which makes the ratio worse. Many social apps have died this way.
5. **Novelty fades.** Without lasting connections and recurring activities, people stop coming back.
6. **Students have little money.** Subscriptions are hard to sell, and ads only pay at scale.
7. **Liability is lower, but not zero.** A college email does not prove someone is 18+. One serious incident can end the product. Stored personal data could be breached.
8. **App stores are strict about random video chat.** Apple requires filter, report, and block features. Launching web-first avoids this at the start.
9. **Competition for attention.** Instagram, Discord, other random-chat apps, and Discord Activities (watch-together and games). The difference has to be **"verified students worldwide"**.

---

## 4. Product structure with activities

Position it as a **global student lounge** ("Omegle for students" is too narrow). There are four things to do:

| Mode | What it is | Why it matters |
|---|---|---|
| **Just Chat** | Random 1:1 video and text, as originally planned. | The core product and quickest way to meet people. |
| **Quick Play** | Short 1v1 games *inside* a chat: tic-tac-toe, four-in-a-row, chess, trivia, would-you-rather, two truths and a lie, draw-and-guess. | Breaks the ice and cuts down on instant skipping. **No separate queue.** |
| **Tables** | Social games for 2–6 players: Ludo, a crazy-eights-style card game, Mafia/Werewolf, trivia nights. Join a public table or invite people you've connected with. | Group settings feel safer (which helps get more women on the platform). People spend longer and come back to play again. |
| **Cinema** | Scheduled screenings where you reserve a virtual seat. Text chat and reactions for the whole room, voice/video with the people in your row. | Gives people a time to show up for, which solves the "not enough people online" problem. Works well for clubs and events. |

### Biggest implication: every extra mode splits your users
Each separate queue has fewer people in it, which makes the biggest risk worse. The rules:
- Quick Play happens **inside** Just Chat, so it doesn't split the queue.
- Tables fill from a lobby. Show only the tables that are filling up, not an empty list.
- Cinema is **scheduled**, so users gather at one time instead of spreading out.
- Add modes one at a time, and only once the current ones feel busy.

---

## 5. Business impact of games and cinema

### Upside
- **Retention:** people have a reason to come back, not just novelty. This is what Houseparty was missing, and verified identity plus mutual connections are what it lacked.
- **Longer sessions and less skipping.** Doing an activity takes the pressure off talking to a stranger.
- **Safer for women and introverts.** People can join with voice or text only and still take part.
- **Scheduled screenings bring people online at the same time.**
- **Monetization** gets much better (see §7).
- **University clubs and societies** can run screenings and game nights. That's a way into campuses and a possible business customer.

### Risks
| Risk | Details | Mitigation |
|---|---|---|
| **Copyright: cinema** | Streaming movies you don't hold rights to is piracy (public performance). Screen-sharing Netflix etc. is also blocked by DRM. It can get the domain and hosting shut down. | Legal sources only: **synced YouTube embeds** (each viewer streams from YouTube, costs you $0), **public-domain films** (Internet Archive), **Creative Commons films** (e.g. Blender open movies), **student and indie film festivals** (good fit for the audience), and later licensed content or a "bring your own subscription" sync approach like Teleparty. |
| **Trademarks: games** | UNO (Mattel), Scrabble, Pictionary, Connect Four (Hasbro), Codenames, etc. are trademarked. | Use public-domain games (Ludo, chess, checkers, Mafia/Werewolf) and **your own names and artwork** for similar mechanics (e.g. a "crazy eights" card game, "Four in a Row", a draw-and-guess game). Rules are generally not protected; names and visual design are. |
| **Gambling rules** | Real-money stakes or loot boxes are regulated or banned in many countries. | No real-money games and no paid random rewards. Cosmetics are sold at a fixed price. |
| **Moderation in groups** | One bad actor ruins it for 4–50 people. | Host controls, kick, vote-kick, mute, slow mode, and the same strike system. Text chat in cinema is filtered. |
| **Scope creep** | Four modes means roughly 3× the build work. | Build in stages (§8). The core chat has to work first. |
| **Bandwidth** | Group video costs much more than 1:1. | Voice and small low-resolution video tiles only for Tables. In Cinema, video only with your row (≤4 people). Movies never pass through your server. |

---

## 6. How to improve the odds
- **Give people a purpose beyond random chat.** Offer language exchange, same-major chats, "talk to a student from the country I'm moving to", career chats, and study buddies.
- **Scheduled events.** A daily "Global Hour" plus weekly cinema and game nights, to get people online at the same time.
- **Mutual Connect** turns one-off chats into lasting friendships, so people have a reason to return.
- **Make it safe for women first.** Safe defaults, invite-based growth through women's societies, and fast action on reports. The safety record *is* the product.
- **Launch one campus at a time** until there are enough active users there (the Facebook approach), then connect campuses across countries.

## 7. Monetization (most realistic first)
1. **Business customers (B2B):** universities (buddy programs before international students arrive, events for clubs), study-abroad agencies, language schools, and sponsored film festivals and screenings.
2. **Cosmetics:** card backs, dice and board skins, avatar frames, seat themes, reactions. Fixed prices, no randomness. This works in games (it's the Plato model) and doesn't affect fairness.
3. **Freemium:** country, major, and language filters; more connects; private tables and private screenings with friends.
4. **Brand-safe sponsorships and ads,** once there is scale.
5. **Tournaments** sponsored by brands, with prizes that aren't cash or are legally compliant.
- **Avoid:** a paid gender filter. It makes the creepy behaviour worse.

## 8. Rollout order
1. **Just Chat + Quick Play** (in-chat icebreaker games). A few extra weeks for a large retention gain.
2. **Scheduled Global Hour + Cinema v1:** synced YouTube and public-domain or Creative Commons films, seat reservation, text chat for the room. Costs $0 in bandwidth.
3. **Tables:** Ludo first (public domain, easy to understand), then the card game, Mafia/Werewolf, and trivia nights.
4. **Clubs and events** (hosted screenings and game nights) and cosmetics.

## 9. Validate before building everything
Launch a landing page and waitlist. Get **300–500 sign-ups from 3–5 campuses**. Run **one scheduled Global Hour**, and add a screening or game night if it's ready. Measure:
- how long a match takes (target under 10 seconds)
- share of chats longer than 2 minutes
- share of users who come back after 7 days
- gender ratio
- reports per 1,000 sessions
- connect rate
- attendance at screenings and game nights

If fewer than ~100 people show up for one scheduled hour, the tech doesn't matter. If they show up and come back, there's a product.
