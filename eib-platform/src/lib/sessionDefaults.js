// Where and when a mentor comes for a mentor-led lesson, when the lesson
// itself does not say. Students see the lesson's own room and times; the
// mentor side (Mentor CRM, advancement team) sees these mentor fields, and
// these defaults fill any that are blank. Safe to import on client and server.

export const MENTOR_DEFAULTS = {
  mentorLocation: "TFS Sr. School",
  mentorStartTime: "4:30 PM",
  mentorEndTime: "5:30 PM",
};

export const STUDENT_DEFAULTS = {
  room: "Room 106",
  startTime: "4:00 PM",
  endTime: "5:30 PM",
};

export const mentorWhere = (l) => l.mentorLocation || MENTOR_DEFAULTS.mentorLocation;
export const mentorStart = (l) => l.mentorStartTime || MENTOR_DEFAULTS.mentorStartTime;
export const mentorEnd = (l) => l.mentorEndTime || MENTOR_DEFAULTS.mentorEndTime;
export const mentorWhen = (l) => `${mentorStart(l)} to ${mentorEnd(l)}`;
