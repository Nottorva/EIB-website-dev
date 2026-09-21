// Static copy for the public site (the marketing page at "/").
//
// Everything that changes rarely lives here as plain data: the reel captions,
// the card copy, the quotes, the curriculum, the footer. The ticker items
// come from the database (edited on the Website page).

// Per photo: `position` is the CSS background-position (which part of the
// photo to keep when it is cropped), `size` optionally zooms in on wide
// screens ("113% auto" = 113% of the stage WIDTH, so it always covers; phones use cover),
// and `shade` (0–1) is extra darkening on the left, under the caption. The
// aim in every case: the subject sits to the right of the text, the text sits
// over the darkest part of the frame.
export const REEL = {
  hero: {
    photo: "/site/stage-0.jpg",
    position: "0% 40%",
    mobilePosition: "48% 40%",
    size: "113% auto",
    shade: 0.35,
    tint: "#0A0A0C",
    kicker: "Sixteen sessions · Four principles",
    // Each value is a word in its own pastel; the four panels that follow
    // take those colours in the same order.
    // One word per line ("\n"), so the block stays narrow and never crosses
    // the presenter on wide screens.
    headline: [
      { text: "Agency.", color: "#FFB3A7" },
      "\n",
      { text: "Judgment.", color: "#C8B6FF" },
      "\n",
      { text: "Consequence.", color: "#9EE7D4" },
      "\n",
      { text: "Community.", color: "#FFD59E" },
    ],
    body: "",
  },
  stages: [
    {
      photo: "/site/stage-1.jpg",
      position: "100% 42%",
      mobilePosition: "62% 45%",
      size: "108% auto",
      shade: 0.62,
      tint: "#2A2D2E",
      accent: "#FFB3A7",
      kicker: "01 — Agency",
      headline: "Work on something you care about.",
      body: "Students choose the problem themselves. No assigned case, no brief handed down, no invented company to practise on. What a student picks in week one is what they try and solve for twelve weeks.",
      meta: "In practice · every venture starts from a problem the student named",
    },
    {
      photo: "/site/stage-2.jpg",
      position: "50% 45%",
      mobilePosition: "62% 45%",
      size: "cover",
      shade: 0.45,
      tint: "#1A1B22",
      accent: "#C8B6FF",
      kicker: "02 — Judgment",
      headline: "Take a real risk while it is cheap.",
      body: "Students learn to size a bet, test it cheaply, and operate with imperfect information. A wrong business decision during high school is the cheapest one they will ever make and the one they learn most from.",
      meta: "In practice · a working budget each student decides how to spend",
    },
    {
      photo: "/site/stage-3.jpg",
      position: "0% 50%",
      mobilePosition: "45% 50%",
      size: "117% auto",
      shade: 0.3,
      tint: "#0A0A0C",
      accent: "#9EE7D4",
      kicker: "03 — Consequence",
      headline: "Leave a mark before you leave school.",
      body: "The work goes outside the building. EIB ventures have real customers, a real budget, and judgment from people with no reason to be kind about it. What students build here is theirs to keep building.",
      meta: "In practice · the prototype is used by someone outside the school",
    },
    {
      // The Demo Day room: the panel and audience, a bright warm frame, so
      // it gets the heaviest shade and a crop that keeps faces right of the text.
      photo: "/site/stage-4.jpg",
      position: "0% 50%",
      mobilePosition: "55% 50%",
      size: "122% auto",
      shade: 0.72,
      tint: "#3A2E22",
      accent: "#FFD59E",
      kicker: "04 — Community",
      headline: "Get the network ten years early.",
      body: "Founders, operators and investors sit with each venture during the term, then a panel of them judges it at the end. Students leave the twelve weeks with top business people already knowing their name.",
      meta: "In practice · operators and investors in the room give feedback on student ventures",
    },
  ],
};

export const DIFFERENCE = {
  eyebrow: "The EIB difference",
  headline: "A reason to walk back into the building.",
  lede: "Every mentor in an EIB room comes out of the school's own community, bringing with them years of experience. By pressing student teams on their ventures, they pass hard-won knowledge to the next generation of founders while closing the distance between the classroom and the real world.",
  mission: "A student's first company should happen while there is still someone around to help them build it.",
};

// Student quotes that rotate under the card copy, in this order. Verbatim;
// nothing here is attributed to a name.
export const CARD_QUOTES = [
  "My dad uses business words I didn't know, and now I know all of them, so I can eavesdrop better.",
  "Mentors don't just tell you your idea is great. They give constructive criticism to turn your idea into an actual venture.",
  "Other programs will be done in three to six months. EIB feels like something I can keep.",
  "It's a platform to fail smart and learn.",
  "It's a good way to get your foot in the door meeting real people outside of parents. It's nice to see perspectives outside of TFS as well.",
];

// The curriculum drawn under the card, in order. A `note` entry is a break
// that sits on the trunk between sessions; a `label` replaces the
// "Lesson NN" line (the showcase is dated, not numbered).
export const CURRICULUM = [
  { id: "c1", stage: "Identify", title: "Problem Identification" },
  { id: "c2", stage: "Identify", title: "Problem Validation" },
  { id: "c3", stage: "Identify", title: "Ideation and Solutions" },
  { id: "c4", stage: "Plan", title: "Exit Strategy and What Success Looks Like" },
  { id: "c5", stage: "Plan", title: "Building the MVP" },
  { id: "b1", stage: "Plan", note: "Winter break · Dec 18 to Jan 4 · no sessions" },
  { id: "c6", stage: "Plan", title: "Monetization and the Business Model" },
  { id: "c7", stage: "Plan", title: "Legal Basics" },
  { id: "c8", stage: "Plan", title: "Traction and Go-to-Market" },
  { id: "c9", stage: "Build", title: "Prototyping Day, physical" },
  { id: "c10", stage: "Build", title: "Prototyping Day, digital" },
  { id: "c11", stage: "Build", title: "Data Collection and Feedback" },
  { id: "c12", stage: "Build", title: "Value Extraction" },
  { id: "c13", stage: "Convince", title: "Narrative Construction and Investment" },
  { id: "c14", stage: "Convince", title: "Founder Journey" },
  { id: "b2", stage: "Convince", note: "March break · Mar 8 to 19 · no sessions" },
  { id: "c15", stage: "Convince", title: "Pitch Refinement" },
  { id: "c16", stage: "Convince", title: "Pitch Prep and Showcase Briefing" },
  { id: "c17", stage: "Launch", label: "April 23", title: "Student Showcase and Cougars Den" },
];

// What a cohort actually builds; drawn as the field of rising words ahead of
// the white card.
export const LEXICON = [
  "wearables", "cyber security", "medical devices", "food and beverage", "services",
  "consumer tech", "robotics", "health tech", "fintech", "clean energy", "logistics", "e-commerce",
  "tutoring", "accessibility", "sports tech", "packaging", "agriculture", "fashion", "gaming",
  "marketplaces", "hardware", "local delivery", "education", "sustainability", "apps", "media",
];

export const FOOTER = {
  tagline: "Entrepreneurship, Innovation & Business",
  meta: [
    ["Operated by", "Nemosyne LTD · est. 2024"],
    ["Partner school", "Toronto French School"],
    ["Based in", "Toronto, Ontario"],
  ],
};

// Group the curriculum into stages, in order, keeping each session's
// alternating side stable across stage tags and break notes (see the trap
// about :nth-child in the handoff: sides are data, not layout). Only
// numbered sessions take an index.
export function groupLessons(lessons) {
  const stages = [];
  let side = "l";
  let index = 0;
  for (const lesson of lessons) {
    const stageName = lesson.stage || "";
    let stage = stages[stages.length - 1];
    if (!stage || stage.name !== stageName) {
      stage = { name: stageName, lessons: [] };
      stages.push(stage);
    }
    if (lesson.note) {
      stage.lessons.push({ ...lesson });
      continue;
    }
    if (lesson.label) {
      stage.lessons.push({ ...lesson, side });
      side = side === "l" ? "r" : "l";
      continue;
    }
    index += 1;
    stage.lessons.push({ ...lesson, side, index });
    side = side === "l" ? "r" : "l";
  }
  return stages.map((s, i) => ({ ...s, label: stageLabel(s, i) }));
}

function stageLabel(stage, i) {
  if (!stage.name) return "";
  const weeks = stage.lessons.map((l) => parseInt(l.week, 10)).filter(Number.isFinite);
  const weekPart = weeks.length ? (Math.min(...weeks) === Math.max(...weeks) ? `Week ${weeks[0]}` : `Weeks ${Math.min(...weeks)}–${Math.max(...weeks)}`) : "";
  return [`Stage ${String(i + 1).padStart(2, "0")}`, stage.name, weekPart].filter(Boolean).join(" · ");
}
