/** The three "vibe check" cards shown during onboarding come first. */
export const VIBE_CHECK = [
  {
    emoji: "🤝",
    title: "Be kind",
    body: "Everyone here is a student somewhere, a long way from home or not. Treat them like a classmate.",
    color: "sky",
  },
  {
    emoji: "👕",
    title: "Keep it clothed, keep it chill",
    body: "No nudity or sexual stuff, ever. It's an instant ban, and your ban follows your university email.",
    color: "gum",
  },
  {
    emoji: "🔒",
    title: "Don't overshare early",
    body: "Keep your number, address and socials to yourself until you trust someone. Use Connect when you both want to stay in touch.",
    color: "zest",
  },
] as const;

export const GUIDELINES = [
  { title: VIBE_CHECK[0].title, body: VIBE_CHECK[0].body },
  { title: "No nudity or sexual content", body: VIBE_CHECK[1].body },
  { title: VIBE_CHECK[2].title, body: VIBE_CHECK[2].body },
  {
    title: "No harassment or hate",
    body: "No slurs, threats, bullying or targeting people for who they are, where they're from or what they believe.",
  },
  {
    title: "18+ and a real student",
    body: "You must be 18 or older and use your own university email. Report anyone who seems under 18.",
  },
  {
    title: "No spam or selling",
    body: "Don't promote products, services, crypto or other apps. Quad is for hanging out.",
  },
  {
    title: "No recording without consent",
    body: "Don't screenshot or record people without asking, and never share recordings of someone.",
  },
];
