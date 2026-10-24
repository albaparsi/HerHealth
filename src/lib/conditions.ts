export type Condition = {
  slug: string;
  name: string;
  tagline: string;
  urgent: boolean;
  status: "ready" | "soon";
};

export const CONDITIONS: Condition[] = [
  {
    slug: "heart-attack",
    name: "Heart attack",
    tagline:
      "Not always crushing chest pain. Jaw ache, nausea and sudden tiredness count too.",
    urgent: true,
    status: "ready",
  },
  {
    slug: "endometriosis",
    name: "Endometriosis",
    tagline:
      "Period pain that stops your life is not \"just cramps.\" It takes years to get diagnosed.",
    urgent: false,
    status: "soon",
  },
  {
    slug: "adhd",
    name: "ADHD",
    tagline:
      "Less bouncing off walls, more quiet overwhelm. Many women find out as adults.",
    urgent: false,
    status: "soon",
  },
];

export function getCondition(slug: string) {
  return CONDITIONS.find((c) => c.slug === slug);
}
