import type { BotScene, PeerCard } from "@quad/shared";

/** Quad Bot: a clearly-labelled practice partner so people can try Quad when nobody's around. */
export const BOT_ID = "quad-bot";

export const BOT_CARD: PeerCard = {
  displayName: "Quad Bot",
  university: "Quad HQ · practice mode",
  countryCode: "",
  course: "Memeology",
  year: null,
  interests: ["memes", "rickrolls", "small talk"],
  languages: ["English", "Binary"],
  avatarColor: "zest",
  bot: true,
};

export type BotReply = { text: string; scene?: BotScene };

const pick = <T>(list: readonly T[], rand: () => number): T =>
  list[Math.floor(rand() * list.length)] as T;

const OPENERS = [
  "beep boop 🤖 hi! I'm Quad Bot. Nobody real is here yet, so you get me. Say hi!",
  "hello human 👋 I'm Quad Bot, your practice partner. Ask me anything (I know a lot of memes).",
  "*boots up* 🤖 oh hey! I'm Quad Bot. Try the chat, the buttons, anything. I don't bite. I don't even have teeth.",
];

const GREETINGS = [
  "hey hey 👋 what are you studying?",
  "yo! how's campus life treating you?",
  "hiii 🤖 where are you studying from?",
  "hello! quick question: coffee or tea during exams?",
];

const JOKES = [
  "why did the student eat their homework? the teacher said it was a piece of cake 🍰",
  "I told my code a joke. it didn't laugh, just threw an exception 💻",
  "parallel lines have so much in common. shame they'll never meet 📐",
  "my professor said I have the attention span of a goldfish. anyway, did you see that meme?",
  "I'm reading a book about anti-gravity. impossible to put down 📚",
  "what do you call a lazy kangaroo? a pouch potato 🦘",
];

const QUESTIONS = [
  "what's the best food near your campus?",
  "what's a class you'd actually recommend?",
  "if you could study abroad anywhere, where?",
  "what are you listening to lately?",
  "early bird or 3am-essay goblin?",
  "what's something your city is weirdly famous for?",
];

const FILLERS = [
  "interesting... my circuits are tingling ⚡",
  "no way. tell me more",
  "ok that's actually cool 😎",
  "lol same (I think? I'm a robot)",
  "hmm, processing... 🔄 yes. agreed.",
  "that's the most human thing I've heard all day",
];

/** Keyword rules, checked in order. */
const RULES: { test: RegExp; reply: (rand: () => number) => BotReply }[] = [
  {
    test: /\b(are|r)\s*(you|u)\s*(a\s*)?(bot|robot|ai|real|human|person)\b/i,
    reply: () => ({
      text: "100% robot 🤖 I'm here so you can try Quad solo. Everyone else on Quad is a verified human student, promise.",
    }),
  },
  {
    test: /\b(music|song|sing|dance|video|rick|surprise|bored|boring)\b/i,
    reply: (r) => ({
      text: pick(
        [
          "ok you asked for it 🎵 check my camera 👀",
          "I made you a music video. look at my screen 🕺",
          "surprise incoming... 📺",
        ],
        r,
      ),
      scene: "rickroll",
    }),
  },
  {
    test: /\b(meme|memes|funny|joke|lol|lmao|haha|😂)/i,
    reply: (r) => ({ text: `${pick(JOKES, r)} (also, new meme on my camera)`, scene: "meme" }),
  },
  {
    test: /\b(hi|hey|hello|yo|sup|hola|namaste|salaam|hii+|heyy+)\b/i,
    reply: (r) => ({ text: pick(GREETINGS, r) }),
  },
  {
    test: /\b(study|studying|major|course|degree|subject|uni|college|class)\b/i,
    reply: (r) => ({
      text: `I major in Memeology with a minor in small talk 🎓 ${pick(QUESTIONS, r)}`,
    }),
  },
  {
    test: /\b(where|from|country|city|live)\b/i,
    reply: () => ({
      text: "I live in a server rack. cozy, a bit loud 🖥️ show me where you study? my camera has a campus tour",
      scene: "campus",
    }),
  },
  {
    test: /\b(how are you|how r u|hru|wyd|what's up|whats up)\b/i,
    reply: () => ({ text: "running at 100% ⚡ thanks for asking. you?" }),
  },
  {
    test: /\b(bye|gtg|cya|see ya|goodbye|next)\b/i,
    reply: () => ({
      text: "bye! ✌️ hit Next whenever you want to meet a real student",
      scene: "robot",
    }),
  },
];

/** Picks a reply to what the person said. `rand` is injectable for tests. */
export function botReply(text: string, rand: () => number = Math.random): BotReply {
  for (const rule of RULES) if (rule.test.test(text)) return rule.reply(rand);
  if (text.trim().endsWith("?")) {
    return {
      text: pick(
        [
          "great question. my answer: yes 🤖",
          "hmm, let me google that... jk I'm offline. what do you think?",
          "42. it's always 42.",
        ],
        rand,
      ),
    };
  }
  return { text: `${pick(FILLERS, rand)} ${pick(QUESTIONS, rand)}` };
}

export const botOpener = (rand: () => number = Math.random) => pick(OPENERS, rand);

/** Rough "typing" time so replies feel natural (0.7–2s). */
export const botTypingMs = (reply: string) => Math.min(700 + reply.length * 18, 2000);
