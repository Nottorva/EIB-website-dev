// Seed data for the local sandbox. Mirrors the sample data in the four
// reference UI files so the click-through looks populated on first run.
// Delete data/db.json (or run `npm run db:reset`) to start over.

const COHORT_YEAR = 2026;

const USERS = [
  { id: "user_josef", email: "josefm2173@gmail.com", name: "Josef Marshall", role: "superAdmin" },
  { id: "user_jack", email: "jack.harlow@tfs.ca", name: "Jack Harlow", role: "studentLeader" },
  // Students only exist here because their application was approved.
  { id: "user_amara", email: "amara.chen@tfs.ca", name: "Amara Chen", role: "student" },
];

import { APPLICATION_FORM_2026 } from "./applicationForm2026";

const FORM_QUESTIONS = APPLICATION_FORM_2026;

const LESSONS = [
  {
    id: "lesson_1",
    number: "1",
    chapterLabel: "Chapter 1",
    title: "Problem Identification",
    published: true,
    stage: "Foundations",
    week: "1",
    blurb: "Students arrive with an app idea. They leave the first block holding a problem instead, attached to a named person who actually has it.",
    slidesLink: "",
    overviewLink: "",
    teachingPlanLink: "",
    mentorEnabled: true,
    room: "Room 214",
    startTime: "3:30 PM",
    endTime: "4:15 PM",
    overview:
      "This session is about learning to spot problems worth solving. You'll look at your own week for friction points, then start separating real, validated problems from ones you're just assuming exist.",
    deliverables: [
      {
        id: "del_journal",
        type: "text",
        title: "Problem Journal Entry",
        instructions: "Describe one problem you personally experienced this week. Who else experiences it, and how do you know?",
        example: {
          text: "Last week I waited 25 minutes for a bus that never came. I checked the app three times and it kept changing the arrival time. My friend Sam said the same thing happens to her on this route almost every week.",
        },
        points: 10,
        columns: [],
        checklistItems: [],
      },
      {
        id: "del_worksheet",
        type: "table",
        title: "Problem Validation Worksheet",
        instructions: "Complete the worksheet identifying who your problem affects, how often it occurs, and evidence it's worth solving.",
        example: {
          columns: ["Who is affected", "How often", "Evidence"],
          rowLabels: [],
          rows: [
            ["Fellow students", "Daily", "Logged over 3 days running"],
            ["Teachers", "Weekly", "Two informal complaints noted"],
          ],
        },
        points: 10,
        columns: ["Who is affected", "How often", "Evidence"],
        checklistItems: [],
      },
    ],
  },
  {
    id: "lesson_2",
    number: "2",
    chapterLabel: "Chapter 2",
    title: "Customer Discovery",
    published: true,
    stage: "Validation",
    week: "4",
    blurb: "Twenty strangers beats two hundred classmates. Students build a list, write the ask, and run interviews without pitching once.",
    slidesLink: "",
    overviewLink: "",
    teachingPlanLink: "",
    mentorEnabled: true,
    room: "Room 214",
    startTime: "3:30 PM",
    endTime: "4:15 PM",
    overview:
      "You'll run your first real customer interviews this week. The goal is not to pitch, it's to listen for the moments where someone describes the problem in their own words.",
    deliverables: [
      {
        id: "del_interviews",
        type: "checklist",
        title: "Customer Interview Log",
        instructions: "Work through the interview checklist. Check each item off only once you have written evidence for it.",
        example: {
          items: [
            { label: "Interviewed at least 3 people", checked: true },
            { label: "Logged a negative reaction", checked: true },
            { label: "Identified one change for v2", checked: true },
          ],
        },
        points: 10,
        columns: [],
        checklistItems: ["Interviewed at least 3 people", "Logged a negative reaction", "Identified one change for v2"],
      },
      {
        id: "del_memo",
        type: "link",
        title: "Discovery Synthesis Memo",
        instructions: "Write a one-page memo (Google Doc) summarising what you heard across your interviews and what surprised you. Share it so anyone with the link can view, then paste the link here.",
        example: { url: "https://docs.google.com/document/d/1example-discovery-memo/edit" },
        points: 10,
        columns: [],
        checklistItems: [],
      },
    ],
  },
  {
    id: "lesson_3",
    number: "3",
    chapterLabel: "Chapter 3",
    title: "Prototype Feedback",
    published: true,
    stage: "Build",
    week: "9",
    blurb: "The prototype meets someone outside the cohort. Teams watch without explaining, which is harder than it sounds.",
    slidesLink: "",
    overviewLink: "",
    teachingPlanLink: "",
    mentorEnabled: false,
    room: "Room 214",
    startTime: "3:30 PM",
    endTime: "4:15 PM",
    overview: "Bring the roughest version of your idea that someone else can react to. Paper is fine.",
    deliverables: [
      {
        id: "del_proto",
        type: "text",
        title: "Prototype Reaction Notes",
        instructions: "Show your prototype to two people and write down exactly what they said, not what you think they meant.",
        example: null,
        points: 10,
        columns: [],
        checklistItems: [],
      },
    ],
  },
  {
    id: "lesson_4",
    number: "4",
    chapterLabel: "Chapter 4",
    title: "Pitch Practice",
    published: true,
    stage: "Demo Day",
    week: "11",
    blurb: "Problem, evidence, product, economics, ask. Eight minutes, and the evidence carries the weight rather than the delivery.",
    slidesLink: "",
    overviewLink: "",
    teachingPlanLink: "",
    mentorEnabled: true,
    room: "Auditorium",
    startTime: "3:30 PM",
    endTime: "4:30 PM",
    overview: "A mentor joins to hear two-minute pitches and give the kind of feedback you'd get from a real investor.",
    deliverables: [
      {
        id: "del_pitch",
        type: "link",
        title: "Pitch Deck",
        instructions: "Paste a link to your pitch deck (Google Slides or Canva, 5 slides max). Make sure it is shared so anyone with the link can view.",
        example: null,
        points: 10,
        columns: [],
        checklistItems: [],
      },
    ],
  },
];

const MENTORS = [
  {
    id: "mentor_trent",
    name: "Trent Mell",
    status: "confirmed",
    contacts: [{ id: "c_1", method: "Email", value: "trent@example.com", preferred: true, public: true }],
    notes: "Sourced through Josef's network. Happy to do one session per term, prefers a week's notice.",
    lastContactedAt: "2026-09-02",
    assignedLessons: [{ lessonNumber: "1", cohortYear: COHORT_YEAR }],
    publicRole: "CEO, Terra CO2 · EIB Panelist",
    publicBio:
      "Trent Mell is CEO of Terra CO2 and a long-time EIB panelist. He previously built and sold two cleantech ventures before moving into climate investing.",
  },
  {
    id: "mentor_dana",
    name: "Dana Whitfield",
    status: "responsive",
    contacts: [
      { id: "c_2", method: "Email", value: "dana.whitfield@example.com", preferred: false, public: true },
      { id: "c_3", method: "Phone", value: "(416) 555-0182", preferred: true, public: false },
    ],
    notes: "Replied fast to the first email, still confirming which week works.",
    lastContactedAt: "2026-09-08",
    assignedLessons: [{ lessonNumber: "2", cohortYear: COHORT_YEAR }],
    publicRole: "Product Lead, Northbridge Ventures",
    publicBio: "Dana leads product at Northbridge Ventures and has run customer-discovery workshops for three student cohorts.",
  },
  {
    id: "mentor_marcus",
    name: "Marcus Ilunga",
    status: "contacted",
    contacts: [{ id: "c_4", method: "Email", value: "m.ilunga@example.com", preferred: true, public: true }],
    notes: "Intro'd by Jack. First email sent, no reply yet.",
    lastContactedAt: "2026-09-05",
    assignedLessons: [],
    publicRole: "",
    publicBio: "",
  },
  {
    id: "mentor_priya",
    name: "Priya Chandrasekaran",
    status: "unresponsive",
    contacts: [{ id: "c_5", method: "Email", value: "priya.c@example.com", preferred: true, public: false }],
    notes: "Two follow-ups with no response. Try a LinkedIn message next.",
    lastContactedAt: "2026-08-27",
    assignedLessons: [],
    publicRole: "",
    publicBio: "",
  },
  {
    id: "mentor_owen",
    name: "Owen Blackwood",
    status: "confirmed",
    contacts: [
      { id: "c_6", method: "Discord", value: "owen.b", preferred: true, public: true },
      { id: "c_7", method: "Email", value: "owen.blackwood@example.com", preferred: false, public: false },
    ],
    notes: "Prefers Discord for scheduling, keeps his email off-limits to students.",
    lastContactedAt: "2026-09-10",
    assignedLessons: [{ lessonNumber: "4", cohortYear: COHORT_YEAR }],
    publicRole: "Founder, Fieldnote",
    publicBio: "Owen founded Fieldnote after three earlier startups. He's blunt about what doesn't work, which students tend to appreciate.",
  },
];

function application(id, studentId, name, email, status, submittedAt, [grade, why, problem, commit, link]) {
  return {
    id,
    studentId,
    name,
    email,
    status,
    submittedAt,
    // In the sample data, anyone who already has an account had their
    // decision released; everyone else is still waiting.
    decisionReleased: Boolean(studentId),
    releasedAt: studentId ? "2026-10-20T16:00:00.000Z" : null,
    answers: [
      { questionId: "q_grade", answer: grade },
      { questionId: "q_why", answer: why },
      { questionId: "q_problem", answer: problem },
      { questionId: "q_commit", answer: commit },
      { questionId: "q_link", answer: link },
    ],
  };
}

const APPLICATIONS = [
  application("app_amara", "user_amara", "Amara Chen", "amara.chen@tfs.ca", "approved", "2026-10-02", [
    "11",
    "I keep starting side projects and never know if they're any good until it's too late. I want a structured way to test ideas before sinking months into them.",
    "Half my grade uses a study-group app that's basically five separate group chats. Nobody knows which one has the actual notes.",
    "Yes",
    "https://drive.google.com/file/d/amara-resume/view",
  ]),
  application("app_liam", null, "Liam Osei", "liam.osei@tfs.ca", "interview", "2026-10-05", [
    "10",
    "Business always felt like something adults do. I want to find out if I actually have an idea worth building, not just a fun elective.",
    "The cafeteria line during lunch rush wastes ten minutes every single day and nobody has fixed it in three years.",
    "Yes",
    "",
  ]),
  application("app_priya", null, "Priya Nair", "priya.nair@tfs.ca", "waitlist", "2026-10-08", [
    "12",
    "I'm applying to business school next year and want real evidence I can build something, not just a good essay about wanting to.",
    "Younger students at TFS don't have an easy way to find a tutor they actually trust, versus just whoever's available.",
    "Depends on the week",
    "https://priyanair.myportfolio.com",
  ]),
  application("app_ethan", null, "Ethan Walsh", "ethan.walsh@tfs.ca", "pending", "2026-10-09", [
    "9",
    "My older sibling did EIB last year and said it was the first class where being wrong actually taught you something.",
    "Parents at pickup double park because there's no clear system, and it backs up the whole street.",
    "Yes",
    "",
  ]),
  application("app_sofia", null, "Sofia Marchetti", "sofia.marchetti@tfs.ca", "denied", "2026-10-10", [
    "9",
    "I want to build an app. I think this class will teach me to code.",
    "Not sure yet, I was hoping the class would help me figure that out.",
    "No",
    "",
  ]),
  application("app_noah", null, "Noah Bergeron", "noah.bergeron@tfs.ca", "pending", "2026-10-11", [
    "11",
    "I run a small lawn care operation in the summer and want to understand pricing and margins better than I do now.",
    "My own business: I undercharge because I don't actually know what a fair markup is.",
    "Yes",
    "https://drive.google.com/file/d/noah-resume/view",
  ]),
  application("app_zara", null, "Zara Malik", "zara.malik@tfs.ca", "interview", "2026-10-12", [
    "12",
    "I've read every startup book I can find and want to test whether any of it holds up when I actually have to build something.",
    "Club sign-ups at TFS all happen on paper sheets that go missing. There's no single record of who signed up for what.",
    "Yes",
    "",
  ]),
];

const SUBMISSIONS = [
  {
    id: "sub_1",
    studentId: "user_amara",
    lessonId: "lesson_1",
    deliverableId: "del_journal",
    payload: {
      text: "I noticed the same issue show up across three separate group chats this week, nobody could agree on which one had the real notes.",
    },
    grade: "9",
    feedback: "Clear and specific, good use of your own observation.",
    released: true,
    releasedAt: "2026-11-06T15:00:00.000Z",
    submittedAt: "2026-11-04T20:12:00.000Z",
  },
  {
    id: "sub_2",
    studentId: "user_amara",
    lessonId: "lesson_1",
    deliverableId: "del_worksheet",
    payload: {
      columns: ["Who is affected", "How often", "Evidence"],
      rows: [
        ["Fellow students", "Daily", "Logged over 3 days running"],
        ["Teachers", "Weekly", "Informal complaints noted"],
      ],
    },
    grade: "8",
    released: true,
    releasedAt: "2026-11-07T15:00:00.000Z",
    feedback: "Solid start, Amara. Your evidence section is strong, but push further on quantifying how often this problem actually occurs.",
    submittedAt: "2026-11-05T21:40:00.000Z",
  },
  {
    id: "sub_3",
    studentId: "user_amara",
    lessonId: "lesson_2",
    deliverableId: "del_interviews",
    payload: {
      items: [
        { label: "Interviewed at least 3 people", checked: true },
        { label: "Logged a negative reaction", checked: true },
        { label: "Identified one change for v2", checked: false },
      ],
    },
    grade: null,
    feedback: "",
    released: false,
    releasedAt: null,
    submittedAt: "2026-11-12T19:05:00.000Z",
  },
];

// Full sample data: what the local sandbox opens with.
export function sampleSeed() {
  return {
    users: USERS,
    lessons: LESSONS,
    submissions: SUBMISSIONS,
    mentors: MENTORS,
    applications: APPLICATIONS,
    settings: {
      applicationForm: FORM_QUESTIONS,
      currentCohortYear: COHORT_YEAR,
      classSizeCap: 23,
      applicationWindow: {
        opensAt: "2026-09-01T04:00:00.000Z",
        closesAt: "2026-10-31T03:59:00.000Z",
        applicantDomain: "tfs.ca",
      },
    },
  };
}

// What a fresh production database gets: the super admin from the
// environment, the default form, and program settings. No sample students,
// mentors, lessons or applications.
export function minimalSeed({ adminEmail, adminName }) {
  return {
    users: adminEmail ? [{ id: "user_admin", email: adminEmail.toLowerCase(), name: adminName || adminEmail, role: "superAdmin" }] : [],
    lessons: [],
    submissions: [],
    mentors: [],
    applications: [],
    settings: {
      applicationForm: FORM_QUESTIONS,
      currentCohortYear: new Date().getFullYear(),
      classSizeCap: 23,
      applicationWindow: { opensAt: null, closesAt: null, applicantDomain: "tfs.ca" },
    },
  };
}
