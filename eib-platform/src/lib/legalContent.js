// The legal pages (/privacy, /terms, /cookies). Plain data so the wording
// lives in one place. Everything here describes what the site actually does:
// Google sign-in, an application form with server-saved drafts, a student
// platform, a mentor CRM for staff, hosting on Vercel, a MongoDB Atlas
// database, and a PDF viewer script loaded from Cloudflare's cdnjs on two
// pages. There are no analytics, ad or social trackers.

export const LEGAL = {
  operator: "Nemosyne LTD",
  program: "EIB (Entrepreneurship, Innovation & Business)",
  school: "Toronto French School (TFS)",
  // Who answers privacy and terms questions. Change in one place.
  contactName: "Josef Marshall",
  contactEmail: "josefm2173@gmail.com",
  site: "joineib.ca",
  updated: "October 29, 2026",
  jurisdiction: "Ontario, Canada",
};

const c = LEGAL;

export const PRIVACY = {
  title: "Privacy Policy",
  blurb: `How ${c.program} collects, uses and protects personal information on ${c.site}.`,
  sections: [
    {
      h: "Who we are",
      p: [
        `${c.site} is run by ${c.operator}, which operates the ${c.program} program in partnership with ${c.school}. This policy explains what personal information we collect through the website and the EIB platform, why, and what your choices are. It follows Canada's Personal Information Protection and Electronic Documents Act (PIPEDA).`,
        `Questions about this policy go to ${c.contactName} at ${c.contactEmail}.`,
      ],
    },
    {
      h: "What we collect, and why",
      list: [
        "Sign-in details. When you sign in with Google we receive your name and email address from your Google account. We use them to identify you and to decide what you may open. We never see your Google password.",
        "Application answers. If you apply to EIB, we keep the answers you type into the application form. While you are writing, the form saves your answers on our server as you type, so you can come back and finish later and so the EIB team can see that an application was started.",
        "Student records. If you join EIB we keep your lesson submissions, grades and feedback, your attendance in the program, and your signed Student Agreement.",
        "Parent or legal guardian details. The Student Agreement asks for the name, email address, relationship and typed initials of a parent or legal guardian. We keep these as the record of their consent.",
        "Mentor and community member details. Staff keep contact details and notes about mentors in the EIB platform. Only EIB staff can see them; students only ever see a mentor's name, title, a short bio and whichever contact method the mentor has agreed to share.",
        "Technical information. Our hosting provider records standard server logs (such as IP address, browser type and the pages requested) to run and secure the service. We do not use analytics, advertising or social-media trackers.",
      ],
    },
    {
      h: "How we use it",
      list: [
        "To run the application process: receive applications, interview, decide, and tell applicants the outcome.",
        "To run the program: give students their lessons, collect and grade their work, and keep the record of each cohort.",
        "To find and organise mentors for sessions and events.",
        "To keep the service secure and to fix problems.",
      ],
      p: ["We do not sell personal information and we do not use it for advertising."],
    },
    {
      h: "Who else sees it",
      p: [
        "A small number of service providers process data on our behalf, each only for the purpose named here:",
      ],
      list: [
        "Google (sign-in). Google tells us who you are when you sign in. Google's own privacy policy governs your Google account.",
        "Vercel (hosting). The website and platform run on Vercel, which keeps server logs for the service.",
        "MongoDB Atlas (database). Applications, student records, mentor records and settings are stored in a MongoDB Atlas database.",
        "Cloudflare cdnjs (PDF viewer). The EIB Night slides page and the student onboarding page load a PDF-viewer script from cdnjs.cloudflare.com. Loading it tells Cloudflare your browser is requesting that file; no personal information from our site is sent with it.",
      ],
      p2: [
        `We share student information with ${c.school} where the program requires it, for example to confirm enrolment, and with mentors only to the extent needed for a session. We will disclose information if the law requires it.`,
      ],
    },
    {
      h: "Students under 18",
      p: [
        "Most EIB students are under 18. We rely on the student's school account for sign-in and on a parent or legal guardian's consent, given through the Student Agreement, before a student's lessons open. Parents and guardians can ask us about their child's information at any time using the contact below.",
      ],
    },
    {
      h: "How long we keep it",
      p: [
        "Unfinished applications are kept until they are submitted or cleared by the EIB team. Submitted applications and student records are kept for the program year and for a reasonable period afterwards so that we can keep records of each cohort, answer questions about grades, and plan future years. You can ask us to delete your information sooner (see Your choices). Server logs are kept by our hosting provider for a short time on their standard schedule.",
      ],
    },
    {
      h: "Security",
      p: [
        "Data travels over HTTPS. Access to the platform is limited by role: students see only their own work, staff see what their role needs, and mentor contact details never leave the server on student-facing pages. No system is perfectly secure, so please keep your school account's password safe and sign out on shared devices.",
      ],
    },
    {
      h: "Your choices",
      list: [
        "Access and correction. You can ask what personal information we hold about you and ask us to correct it.",
        "Withdrawing. An applicant can ask us to clear their application; a student or guardian can ask about leaving the program and what happens to their records.",
        "Deletion. You can ask us to delete your information. We may keep what we are required to keep for records of the program.",
        "Complaints. If you are not satisfied with our answer you can contact the Office of the Privacy Commissioner of Canada.",
      ],
      p: [`Send any request to ${c.contactName} at ${c.contactEmail}. We will reply within 30 days.`],
    },
    {
      h: "Changes",
      p: [`We may update this policy as the program changes. The date at the top shows the current version. Significant changes will be announced on the platform.`],
    },
  ],
};

export const TERMS = {
  title: "Terms and Conditions",
  blurb: `The terms for using ${c.site} and the EIB platform.`,
  sections: [
    {
      h: "The service",
      p: [
        `${c.site} and the EIB platform are provided by ${c.operator} for the ${c.program} program, run in partnership with ${c.school}. By using the site, applying, or signing in to the platform you agree to these terms and to the Privacy Policy. If you are under 18, your parent or legal guardian agrees on your behalf through the Student Agreement.`,
      ],
    },
    {
      h: "Accounts",
      list: [
        "You sign in with a school Google account. Keep it secure and do not let anyone else use it to access EIB.",
        "Access is by role. Staff, student leaders, mentors and students each see only what their role needs. Do not try to reach other people's information or to get around the access rules.",
        "We may suspend an account that breaks these terms or that is no longer entitled to access, for example when a student leaves the program.",
      ],
    },
    {
      h: "Applying",
      list: [
        "One application per person. Answers must be your own work and truthful.",
        "The program fee and its refund terms are stated in the application itself and in your offer. Admission decisions are made by the EIB team and are final.",
        "An application does not guarantee a place.",
      ],
    },
    {
      h: "Acceptable use",
      list: [
        "Use the platform for the program only. Do not upload anything unlawful, harmful, abusive or infringing.",
        "Do not interfere with the service, probe it for weaknesses, or load it in ways designed to disrupt it.",
        "Treat mentors, staff and other students with respect, in the platform and in sessions.",
      ],
    },
    {
      h: "Your work and our content",
      list: [
        "What you build in EIB is yours. Students own their ventures and the work they submit. By submitting work you give EIB permission to store it, grade it, and show it to the staff and mentors involved in the program.",
        "Lesson content, slides, the curriculum and the design of the site and platform belong to EIB and its contributors. You may use them for your participation in the program and not republish them.",
        "With permission we may describe student ventures in EIB materials. We will ask first.",
      ],
    },
    {
      h: "Availability and changes",
      p: [
        "We aim to keep the platform available but do not promise uninterrupted service. We may change, suspend or stop parts of the site or platform, and we may change these terms. The date at the top is the current version; continuing to use the service after a change means you accept it.",
      ],
    },
    {
      h: "Liability",
      p: [
        "The site and platform are provided as they are. To the extent the law allows, we are not liable for indirect or consequential loss arising from use of the service. Nothing in these terms limits liability that cannot be limited by law.",
      ],
    },
    {
      h: "Governing law",
      p: [`These terms are governed by the laws of ${c.jurisdiction}, and the courts of Ontario have jurisdiction over any dispute.`],
    },
    {
      h: "Contact",
      p: [`${c.contactName}, ${c.operator}: ${c.contactEmail}.`],
    },
  ],
};

export const COOKIES = {
  title: "Cookie Policy",
  blurb: `What ${c.site} stores in your browser, and why no consent banner is needed.`,
  sections: [
    {
      h: "In short",
      p: [
        "This site uses only the cookies it needs to keep you signed in. There are no analytics cookies, no advertising cookies and no social-media cookies, and we do not track you across other sites. Because every cookie we set is strictly necessary for the service you asked for, we do not show a cookie consent banner.",
      ],
    },
    {
      h: "The cookies we set",
      list: [
        "Sign-in session (named authjs.session-token, with a __Secure- or __Host- prefix on the live site). Set when you sign in with Google; it is how the platform knows who you are on each page. It cannot be read by scripts and is removed when you sign out or when it expires.",
        "Sign-in protection (authjs.csrf-token and authjs.callback-url). Short-lived cookies that protect the sign-in step from forgery and return you to the page you were opening.",
      ],
      p: [
        "The application form saves your draft answers on our server, not in your browser, so nothing is stored locally for that. We do not use local storage for tracking.",
      ],
    },
    {
      h: "Third-party requests",
      p: [
        "Signing in sends you to Google, which sets its own cookies under its own policy. The EIB Night slides page and the student onboarding page load a PDF-viewer script from cdnjs.cloudflare.com; that request does not set cookies for our site.",
      ],
    },
    {
      h: "Managing cookies",
      p: [
        "You can clear or block cookies in your browser settings. If you block the sign-in cookie you will not be able to sign in to the platform or apply.",
      ],
    },
    {
      h: "Contact",
      p: [`${c.contactName}, ${c.operator}: ${c.contactEmail}.`],
    },
  ],
};
