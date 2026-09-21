// The 2026-27 application, exactly as specified. This is what a fresh
// database is seeded with, and what the "Load the 2026-27 application"
// button in the Forms tab writes over whatever is currently saved.
//
// Field notes: `help` is the smaller line under a prompt; `maxWords` caps a
// long answer (counted on both sides); a `notice` is a bold statement the
// applicant must tick (`ack`) before the form will submit.

export const APPLICATION_TITLE = "EIB Application 2026-27";

export const APPLICATION_FORM_2026 = [
  {
    id: "q_intro",
    type: "notice",
    label: "This application takes about 20 minutes. You can apply with a venture that's already running, a rough idea, or nothing at all. We read for thinking, so spelling and grammar are not graded. Write in your own words: rough and real beats polished.",
    detail: "",
    ack: "I understand",
    required: true,
    options: [],
  },
  { id: "q_level", type: "choice", label: "What Level are you in?", required: true, options: ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  {
    id: "q_start",
    type: "choice",
    label: "Where are you starting from?",
    help: "This is not scored. It helps us understand where you're coming in.",
    required: true,
    options: ["I have a venture already running", "I have an idea I'm working on", "I have a problem I care about, but no idea yet", "I'm starting fresh"],
  },
  { id: "q_started", type: "short", label: "If you've already started something, what was it?", help: "A business, a project, a club, anything. Skip this if it doesn't apply.", required: false, options: [] },
  {
    id: "q_problem",
    type: "long",
    label: "Describe a problem you've noticed, anywhere in your life, that bothers you more than it seems to bother other people. Who does it affect, and why do you think it hasn't been fixed?",
    help: "About 150 words.",
    maxWords: 250,
    required: true,
    options: [],
  },
  {
    id: "q_skill",
    type: "long",
    label: "Tell us about something you got good at without anyone making you. How did you learn it?",
    help: "About 150 words. Anything counts: a sport, a game, cooking, an instrument, fixing things.",
    maxWords: 250,
    required: true,
    options: [],
  },
  { id: "q_failed", type: "long", label: "Tell us about a time something you tried didn't work. What did you do next?", help: "About 150 words.", maxWords: 250, required: true, options: [] },
  { id: "q_field", type: "short", label: "If you could explore any field or industry this year, which one would it be?", required: true, options: [] },
  { id: "q_learn", type: "short", label: "What are you hoping to learn in EIB?", required: true, options: [] },
  { id: "q_true", type: "short", label: "What do you want to be true about yourself by April that isn't true now?", required: true, options: [] },
  {
    id: "q_schedule",
    type: "notice",
    label: "EIB runs every Tuesday from 4:00 to 5:30pm, November 17 to March 30. There are two pitch rehearsals on Saturday April 10 and Saturday April 17, 1:00 to 4:00pm. The Student Showcase and Cougars Den are both on Friday April 23.",
    detail: "",
    ack: "I understand",
    required: true,
    options: [],
  },
  {
    id: "q_fee",
    type: "notice",
    label: "The program fee is $525. $350 of that comes back to you as your working budget to build your venture.",
    detail: "",
    ack: "I understand",
    required: true,
    options: [],
  },
];
