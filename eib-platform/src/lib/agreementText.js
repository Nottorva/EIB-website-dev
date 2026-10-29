// Section 13 of the Student Agreement, shown on the onboarding page under
// the PDF, word for word. The signing form follows it. Safe to import on
// client and server.

export const AGREEMENT_VERSION_LABEL = "2026-27";

export const SECTION_13 = {
  heading: "13. Acknowledgement and Signatures",
  intro:
    "This agreement is signed online through the EIB platform. Typed initials count as a signature, and the agreement takes effect once both the student and a parent or legal guardian have signed and the guardian has confirmed by email.",
  parts: [
    {
      title: "Student",
      items: [
        "Confirms they have read and understood this agreement, the EIB syllabus and the EIB MVP Reimbursement Policy.",
        "Types their initials as their signature.",
      ],
    },
    {
      title: "Parent or legal guardian",
      items: [
        "Completes their part personally, either on their own device or with the student typing exactly what they say.",
        "Provides their full name, email address and relationship to the student, and types their initials as their signature.",
        "Confirms they are the student's parent or legal guardian and agree to this agreement on the student's behalf.",
        "Clicks the confirmation link sent to the email address they provided. The signature is complete only after this confirmation.",
      ],
    },
    {
      title: "Program fee",
      text: "The non-refundable $525 CAD fee in Section 9 was acknowledged separately at application. Signing this agreement reaffirms it.",
    },
    {
      title: "Record of consent",
      text: "EIB records the date and time of each signature, the agreement version (2026-27) and the email confirmation. The guardian's name and email are kept only as the record of this consent.",
    },
  ],
};
