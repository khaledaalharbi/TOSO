export type ArabicDialect = "msa" | "egyptian" | "gulf" | "levantine" | "maghrebi" | "undetermined";

const markers: Record<Exclude<ArabicDialect, "msa" | "undetermined">, string[]> = {
  egyptian: ["عايز", "عاوز", "إزاي", "ازاي", "دلوقتي", "ده", "دي"],
  gulf: ["شلون", "وايد", "أبي", "ابي", "وشلون", "الحين"],
  levantine: ["شو", "هيك", "بدي", "هلأ", "هلق", "كتير"],
  maghrebi: ["واش", "بزاف", "دابا", "شنو", "بغيت", "هاد"],
};

export function detectDialect(text: string): ArabicDialect {
  const scores = Object.entries(markers).map(([dialect, words]) => ({
    dialect: dialect as keyof typeof markers,
    score: words.reduce((total, word) => {
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return total + [...text.matchAll(new RegExp(`(?:^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, "gu"))].length;
    }, 0),
  }));
  const highest = Math.max(...scores.map(({ score }) => score));
  if (!highest) return /[\u0621-\u064A]/.test(text) ? "msa" : "undetermined";
  const matches = scores.filter(({ score }) => score === highest);
  return matches.length === 1 ? matches[0].dialect : "undetermined";
}
