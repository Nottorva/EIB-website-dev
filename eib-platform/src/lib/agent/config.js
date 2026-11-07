// EIB Email Agent: every setting in one place. Read from the environment; nothing here is hard-coded
// to a person or a domain. See README "EIB Email Agent" for what each variable is.

const list = (v) =>
  String(v || "")
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

export const agentConfig = () => ({
  address: String(process.env.AGENT_ADDRESS || "").trim().toLowerCase(),
  displayName: process.env.AGENT_NAME || "EIB Assistant",
  // Josef's own addresses: the only senders who may edit. Defaults to the super admin's address.
  josefAddresses: list(process.env.JOSEF_ADDRESSES || process.env.SUPER_ADMIN_EMAIL || "josefm2173@gmail.com"),
  josefName: process.env.SUPER_ADMIN_NAME || "Josef Marshall",
  whitelistAddresses: list(process.env.TFS_WHITELIST_ADDRESSES),
  resendKey: process.env.RESEND_API_KEY || "",
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET || "",
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  // Planning document edits is the hardest thing the agent does; Opus is the default. AGENT_MODEL overrides.
  model: process.env.AGENT_MODEL || "claude-opus-5-5",
  driveFolderId: process.env.EIB_DRIVE_FOLDER_ID || "",
  serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "",
  readUri: process.env.MONGODB_AGENT_READ_URI || "",
  writeUri: process.env.MONGODB_AGENT_WRITE_URI || "",
  cronSecret: process.env.CRON_SECRET || "",
});

/** Local sandbox: no Resend key. Webhooks may carry the email inline and nothing is sent. */
export const agentSandbox = () => !process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production";

export const SIGNATURE = (josefName) => `EIB Assistant (AI) for ${josefName}. Reply to Josef directly anytime.`;

/** Backstop against loops: at most this many agent replies in one thread per hour. */
export const MAX_REPLIES_PER_THREAD_PER_HOUR = 5;
/** Escalations open this long get one reminder to Josef, then nothing more. */
export const ESCALATION_REMINDER_DAYS = 3;
/** An unconfirmed edit draft is discarded after this long. */
export const DRAFT_EXPIRY_DAYS = 7;
/** A proposed change ticket nobody approved or rejected expires after this long. */
export const CHANGE_EXPIRY_DAYS = 7;
/** Model loop: at most this many tool rounds per email. */
export const MAX_TOOL_ROUNDS = 8;
/** Keep this many recent messages of a thread as context for the model. */
export const THREAD_CONTEXT_MESSAGES = 12;
