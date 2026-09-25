import {
  asteriskCensorStrategy,
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
  TextCensor,
} from "obscenity";

/** Everyday swearing is fine between adults; slurs and sexual terms get masked. */
const ALLOWED_SWEARS = new Set(["fuck", "shit", "ass", "piss", "bastard"]);

const matcher = new RegExpMatcher({
  ...new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .removePhrasesIf((phrase) => ALLOWED_SWEARS.has(phrase.metadata?.originalWord ?? ""))
    .build(),
  ...englishRecommendedTransformers,
});
const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

export function censorText(text: string): string {
  const matches = matcher.getAllMatches(text);
  return matches.length === 0 ? text : censor.applyTo(text, matches);
}

const TLDS =
  "com|net|org|io|me|app|co|gg|ly|xyz|link|ai|dev|tv|in|uk|us|ca|de|fr|es|it|nl|jp|kr|cn|ru|br|au|edu|info|biz|site|online|shop|club|live|chat|page|to|bio|lol";
const CONTACT_PATTERNS = [
  /\b(?:https?:\/\/|www\.)\S+/i,
  new RegExp(`\\b[a-z0-9-]{2,}\\.(?:${TLDS})\\b`, "i"),
  /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  /(?:^|\s)@[a-z0-9._]{2,}/i,
  /(?:\+?\d[\s().-]*){7,}/,
];

/** Links, emails, @handles and phone numbers: held back during the first minutes of a chat. */
export const containsContactInfo = (text: string) => CONTACT_PATTERNS.some((re) => re.test(text));
