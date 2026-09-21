// Static copy for the public site (the marketing page at "/").
//
// Everything that changes rarely lives here as plain data: the reel captions,
// the comparison table, the footer. Things that change often (ticker items,
// testimonials, the curriculum) come from the database and only fall back to
// the entries below when nothing has been published yet.

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
    kicker: "Twelve weeks · Four principles",
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
  headline: "Schools teach business. We run a pre-incubator.",
  lede: "EIB is the pre-seed process a real company runs, compressed into a school term and taught inside the timetable. Students do not study founders. They do the work founders do, on a problem they picked, in front of people who will tell them the truth about it.",
  mission: "A student’s first company should happen while there is still someone around to help them build it.",
  rows: [
    ["A unit about entrepreneurship", "A venture the students own"],
    ["Case studies of other people's companies", "Twenty interviews they ran themselves"],
    ["A business plan marked by a teacher", "A prototype a stranger has used"],
    ["A pitch to the class", "Eight minutes to operators and investors"],
    ["Graded on how well it was presented", "Scored on what was actually proven"],
    ["Ends with a mark", "Ends with something they keep building"],
  ],
  facts: "12 weeks · one 75-minute block · 18–24 students · 6–8 ventures · one faculty sponsor",
};

// Shown while the testimonials collection has no approved rows. These are
// content briefs in brackets, deliberately not written as quotes in invented
// names; they are replaced one by one as real, permissioned quotes are added.
export const PLACEHOLDER_TESTIMONIALS = [
  { id: "ph1", photo: "/site/v-1.jpg", role: "Student", quote: "[Student quote. What they built, and the moment a customer interview changed their mind about it. Two or three sentences.]", name: "Name to come", org: "Cohort 03" },
  { id: "ph2", photo: "/site/v-2.jpg", role: "Faculty sponsor", quote: "[Faculty quote. What the twelve weeks asked of the school, and just as usefully, what it did not ask.]", name: "Name to come", org: "Faculty sponsor" },
  { id: "ph3", photo: "/site/v-3.jpg", role: "Student", quote: "[Student quote. The idea they killed in week three, what replaced it, and how they knew.]", name: "Name to come", org: "Cohort 03" },
  { id: "ph4", photo: "/site/v-4.jpg", role: "Mentor", quote: "[Mentor quote. How the cohort's questions differed from what they expected from sixteen-year-olds.]", name: "Name to come", org: "Operator, mentor pool" },
  { id: "ph5", photo: "/site/v-5.jpg", role: "Head of school", quote: "[Leadership quote. Why the programme earned a block in the timetable rather than a slot after it.]", name: "Name to come", org: "Partner school" },
  { id: "ph6", photo: "/site/v-6.jpg", role: "Demo Day panel", quote: "[Panellist quote. What the evidence behind the pitches actually looked like on the day.]", name: "Name to come", org: "Demo Day panel" },
];

// Shown while no lesson in the Lesson Editor is marked "Show on website".
// Publishing lessons replaces this list entirely.
export const FALLBACK_LESSONS = [
  { id: "f1", number: "1", week: "1", stage: "Foundations", title: "Problem, not product", blurb: "Students arrive with an app idea. They leave the first block holding a problem instead, attached to a named person who actually has it." },
  { id: "f2", number: "2", week: "1", stage: "Foundations", title: "Where ideas actually come from", blurb: "Not brainstorms. Irritation, constraint, and things the student already knows better than the adults in the room." },
  { id: "f3", number: "3", week: "2", stage: "Foundations", title: "Writing a problem statement", blurb: "One sentence naming who, what, and how often. It gets read aloud to the cohort, and the cohort is allowed to say it is vague." },
  { id: "f4", number: "4", week: "3", stage: "Foundations", title: "Killing your first idea", blurb: "The hardest lesson of the term. Teams practise abandoning something they like on evidence, so that doing it later costs them nothing." },
  { id: "f5", number: "5", week: "4", stage: "Validation", title: "Finding the right people to talk to", blurb: "Twenty strangers beats two hundred classmates. Students build a list, write the ask, and send it before they leave the block." },
  { id: "f6", number: "6", week: "4", stage: "Validation", title: "The customer interview", blurb: "Run without pitching once. The discipline is asking what someone did last time instead of what they would do next time." },
  { id: "f7", number: "7", week: "5", stage: "Validation", title: "What people do, not what they say", blurb: "Coding the interview log. Enthusiasm is discarded; behaviour, spend, and workarounds are kept." },
  { id: "f8", number: "8", week: "6", stage: "Validation", title: "Sizing the room", blurb: "Bottom-up market sizing built from their own interviews rather than a figure copied off a consultancy slide." },
  { id: "f9", number: "9", week: "6", stage: "Validation", title: "Unit economics on one page", blurb: "What one customer costs to win and what one customer returns, with every assumption named and defensible." },
  { id: "f10", number: "10", week: "7", stage: "Build", title: "Scoping the smallest thing", blurb: "Cutting the idea down to the one function that tests the riskiest assumption, and cutting everything else." },
  { id: "f11", number: "11", week: "8", stage: "Build", title: "Building without code", blurb: "No-code tools, hardware, or a service run by hand. What matters is that a person can use it, not how it was made." },
  { id: "f12", number: "12", week: "8", stage: "Build", title: "Pricing before you launch", blurb: "Naming a number early, because a price is a hypothesis and it is cheaper to be wrong about it now." },
  { id: "f13", number: "13", week: "9", stage: "Build", title: "In front of a stranger", blurb: "The prototype meets someone outside the cohort. Teams watch without explaining, which is harder than it sounds." },
  { id: "f14", number: "14", week: "10", stage: "Build", title: "Reading your own data", blurb: "Instrumenting what happened, separating signal from one enthusiastic user, and deciding what it licenses them to claim." },
  { id: "f15", number: "15", week: "11", stage: "Demo Day", title: "The shape of a pitch", blurb: "Problem, evidence, product, economics, ask. Eight minutes, and the evidence carries the weight rather than the delivery." },
  { id: "f16", number: "16", week: "11", stage: "Demo Day", title: "Slides that survive questions", blurb: "Built so every claim on screen traces back to something in the interview log or the usage data." },
  { id: "f17", number: "17", week: "12", stage: "Demo Day", title: "Demo Day", blurb: "An external panel of operators and investors, briefed to press. They score what the team proved, not how confident they sounded." },
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

// Group published lessons into stages, in curriculum order, keeping each
// lesson's alternating side stable across stage tags (see the trap about
// :nth-child in the handoff: sides are data, not layout).
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
