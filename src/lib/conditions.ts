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
    status: "ready",
  },
  {
    slug: "adhd",
    name: "ADHD",
    tagline:
      "Often inattentive rather than hyperactive, so many women are diagnosed only as adults.",
    urgent: false,
    status: "soon",
  },
];

export function getCondition(slug: string) {
  return CONDITIONS.find((c) => c.slug === slug);
}

/** A true-or-false statement the learner answers before and after the lesson. */
export type CheckItem = { statement: string; answer: boolean; why: string; sourceOrg: string; sourceUrl: string };

/** The same quick check runs before and after a lesson, so the change in score shows what was learned. */
export const QUICK_CHECKS: Record<string, CheckItem[]> = {
  "heart-attack": [
    {
      statement: "A heart attack in a woman almost always feels like crushing chest pain.",
      answer: false,
      why: "Chest pain is common, but women are more likely to also have shortness of breath, nausea, or pain in the back or jaw.",
      sourceOrg: "NIH NHLBI",
      sourceUrl: "https://www.nhlbi.nih.gov/health/heart-attack/symptoms",
    },
    {
      statement: "Pain in the jaw, neck or back can be a sign of a heart attack.",
      answer: true,
      why: "Pain or discomfort in the jaw, neck or back is a listed warning sign.",
      sourceOrg: "CDC",
      sourceUrl: "https://www.cdc.gov/heart-disease/about/heart-attack.html",
    },
    {
      statement: "Heart disease is the leading cause of death for women in the United States.",
      answer: true,
      why: "It kills more women in the U.S. than any other cause.",
      sourceOrg: "CDC",
      sourceUrl: "https://www.cdc.gov/heart-disease/about/women-and-heart-disease.html",
    },
    {
      statement: "If you think you are having a heart attack, it's fine to drive yourself to the hospital.",
      answer: false,
      why: "Call 911. Emergency crews can start treatment on the way.",
      sourceOrg: "MedlinePlus",
      sourceUrl: "https://medlineplus.gov/heartattack.html",
    },
  ],
  endometriosis: [
    {
      statement: "Period pain that stops you from doing everyday things is a normal part of having a period.",
      answer: false,
      why: "Pain that gets in the way of daily life is not normal and can be a sign of endometriosis.",
      sourceOrg: "womenshealth.gov",
      sourceUrl: "https://www.womenshealth.gov/a-z-topics/endometriosis",
    },
    {
      statement: "Endometriosis can cause pain during sex or when going to the bathroom.",
      answer: true,
      why: "Pain with sex, bowel movements or urination are common symptoms.",
      sourceOrg: "NIH NICHD",
      sourceUrl: "https://www.nichd.nih.gov/health/topics/endometri/conditioninfo/symptoms",
    },
    {
      statement: "Endometriosis can make it harder to get pregnant.",
      answer: true,
      why: "Infertility is one of the main problems endometriosis can cause.",
      sourceOrg: "ACOG",
      sourceUrl: "https://www.acog.org/womens-health/faqs/endometriosis",
    },
    {
      statement: "A routine ultrasound can always rule out endometriosis.",
      answer: false,
      why: "Imaging can miss it. Surgery (laparoscopy) is the only way to know for sure.",
      sourceOrg: "NIH NICHD",
      sourceUrl: "https://www.nichd.nih.gov/health/topics/endometri/conditioninfo/diagnose",
    },
  ],
};
