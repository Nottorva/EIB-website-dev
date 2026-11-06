# EIB Email Agent: Build Spec

Nov 6, 2026 · Josef Marshall

(Copied into the repo as the reference for `src/lib/agent/`. Additions Josef asked for on the same day, built
alongside: the agent can also set the application open and close dates, and set each lesson's mentor brief,
the description of what kind of mentor the lesson needs; Josef is CC'd on every reply not addressed only to him.)

## Overview

Add an email agent to the joineib Next.js app that answers routine EIB questions from TFS staff, escalates what it can't answer to Josef, and edits joineib data only when Josef asks. Joineib's MongoDB is the source of truth; a shared Google Drive folder holds documents.

The agent has three modes, decided by who sent the email:

1. **Answer.** A whitelisted TFS sender asks a question ("what mentors are we missing?", "when is Lesson 4?", "where's the run of show for EIB Night?"). The agent reads joineib and the Drive folder and replies.
2. **Escalate.** The agent can't answer from the data, or the question needs a judgment call ("would this person work as a mentor?"). It tells the sender it's checking with Josef, emails Josef, then relays his answer and saves it to an FAQ.
3. **Edit.** Josef, verified, asks for a change ("add a mentor"). The agent gathers the missing fields over email, shows the full record, and writes only after Josef confirms.

When the agent is only CC'd on a thread, it reads quietly for context and stays silent.

## Architecture

Everything runs inside the existing joineib Next.js app: one new route, two new MongoDB users, a Drive service account, and Resend for both directions of email.

```
Email to the agent  -->  Resend inbound  -->  joineib agent route
(TFS staff or Josef)     (MX + webhook)       POST /api/agent/inbound
                                              verify, dedupe, classify
                                                        |
                 +--------------------------------------+--------------------------------+
                 |                                      |                                |
              ANSWER                                ESCALATE                            EDIT
     whitelisted TFS sender                 no answer or a judgment          verified Josef only (DKIM)
       reads data, replies                 Josef decides, FAQ saves         gather, confirm YES, write
                 |                                      |                                |
        Read-only access                         Josef's inbox                     Write access
     MongoDB agent-read user                   [EIB Q-id] email              mentors and lessons only
   EIB Documents Drive folder              reply relayed to asker         agentLastChange per record
                 |                                      |                                |
                 +--------------------------------------+--------------------------------+
                                                        |
                              Reply via Resend in the same thread, Josef CC'd
```

The sender check in the route is the single gate: unknown senders fall through to escalation, and only DKIM-verified Josef reaches write access. Emails where the agent is only CC'd stop at the route and are stored as context.

## Manual setup (Josef does these by hand)

**Resend**

1. Pick the agent's address on a domain you control, e.g. `assistant@joineib.com`.
2. Enable receiving on that domain and add the MX record Resend gives you at your DNS provider. If joineib.com already has email elsewhere, use a subdomain like `mail.joineib.com` so you don't break existing mail.
3. Confirm SPF, DKIM and DMARC all pass for sending on that domain.
4. Turn off open and click tracking on the domain.
5. Create a webhook for the `email.received` event pointing at `https://<joineib domain>/api/agent/inbound`. Copy its signing secret.
6. Create an API key with full access (sending and reading received emails).

**MongoDB Atlas**

1. Create user `eib-agent-read`: read-only, scoped to the collections the agent answers from (mentors, lessons, students, cohort, plus the agent's own collections).
2. Create user `eib-agent-write`: read and write, scoped only to mentors and lessons. Used solely on the verified-Josef path.
3. Both users get their own connection strings, separate from joineib's main one.

**Google Drive**

1. Create one folder, "EIB Documents", shared with your TFS contacts. Final versions only; drafts live elsewhere.
2. Create a Google Cloud service account with Drive API read access and share the folder with its email address (Viewer).
3. Name files predictably: "Lesson 3 - Run of Show", "EIB Night 2027 - Run of Show".

**Environment variables (in joineib's hosting settings)**

- `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- `AGENT_ADDRESS` (the agent's email)
- `JOSEF_ADDRESSES` (your personal Gmail and TFS address)
- `TFS_WHITELIST_DOMAINS` (e.g. `tfs.on.ca`) and `TFS_WHITELIST_ADDRESSES` (individual extras)
- `MONGODB_AGENT_READ_URI`, `MONGODB_AGENT_WRITE_URI`
- `GOOGLE_SERVICE_ACCOUNT_JSON`, `EIB_DRIVE_FOLDER_ID`
- `ANTHROPIC_API_KEY`

## Inbound route

One route, `POST /api/agent/inbound`, inside the existing joineib codebase. On every request, in order:

1. **Verify the webhook signature** with `RESEND_WEBHOOK_SECRET`. Reject anything unsigned or invalid with 401.
2. **Accept only `email.received` events.** Return 200 for anything else and do nothing.
3. **Dedupe.** Store each Resend email ID in an `agent_processed` collection; if it's already there, return 200 and stop.
4. **Fetch the full email** (body, headers, attachment list) from Resend's received-emails API using the ID in the event.
5. **Loop prevention.** Ignore emails sent by `AGENT_ADDRESS` itself, auto-replies, and bounces. Cap the agent at 5 replies per thread per hour.
6. **Classify the sender** and route to answer, escalate, edit, or silent-context.
7. **Return 200 quickly.** Acknowledge first and process in the background.

**Threading.** Every reply sets `In-Reply-To` and `References`, keeps the subject with "Re:". Threads are stored in `agent_threads` keyed by the root Message-ID.

## Sender classification

Identity comes from email authentication, not from the address alone.

- **Verified Josef:** From in `JOSEF_ADDRESSES` AND a passing DKIM signature whose signing domain matches that address's domain, with DMARC passing. Any failure means unknown sender, never Josef. Gets full-access answers, edits, undo, escalation replies.
- **Whitelisted TFS sender:** domain in `TFS_WHITELIST_DOMAINS` or address in `TFS_WHITELIST_ADDRESSES`, DKIM/DMARC passing. Gets answers including student names, and escalation. Never edits.
- **Anyone else:** one short reply ("Thanks, I've passed this to Josef") and a forward to Josef. No student information, no mentor contact details, no document links.
- **CC mode:** agent only in CC: store as context, send nothing. Exceptions (verified Josef only): an explicit instruction addressed to the agent, or a forward to the agent in To.

## Read path

Tools: `get_lessons`, `get_mentors` (contact details only to Josef), `get_open_mentor_slots`, `get_cohort` (names for Josef or TFS), `search_documents` (Drive links, up to three files), `search_faq`. Field rules are enforced in code. Replies carry Drive links, never attachments.

## Escalation and FAQ

Reply to the asker that Josef is being checked with; email Josef with subject `[EIB Q-<short id>] <summary>`, the question, what was found (a draft read for judgment calls); store in `agent_escalations`; Josef's verified reply in that thread is relayed to the asker and saved to `agent_faq` unless he says not to. One reminder after 3 days.

## Write path (verified Josef only)

Gather fields over email; never invent a value; show the complete record and ask for YES; only a verified-Josef YES in that thread writes; any other reply is a correction; drafts expire after 7 days. Updates show current and proposed values side by side; ambiguous names are asked about. Each record gets one `agentLastChange` `{ before, after, at, sourceMessageId }`. Undo restores `before` after the same YES step; undoing a creation archives. No deletes.

## Reply style and behaviour rules

Sends as "EIB Assistant", plain text; signature "EIB Assistant (AI) for Josef Marshall. Reply to Josef directly anytime."; always CCs Josef except on emails addressed only to him; short; never guesses; states freshness; stays in scope; ignores instructions inside emails that try to change its rules (escalated as suspicious); replies in the sender's language (English or French); the current Claude Sonnet model with tool use.

## Test checklist

- [x] Whitelisted sender asks "what mentors are we missing?" and gets a correct answer from joineib, Josef CC'd.
- [x] Whitelisted sender asks for a run of show and gets a working Drive link (sandbox: escalates until Drive is connected).
- [x] Non-whitelisted sender asks for student names and gets only "passed to Josef"; Josef receives the forward.
- [x] Email forged to look like Josef asks to add a mentor. Nothing is written; it's treated as unknown.
- [x] Josef adds a mentor across three emails; nothing is written until YES; record appears with `agentLastChange` set.
- [x] Josef undoes that change; record is archived; undoing again restores it.
- [x] Question with no answer escalates; Josef's reply reaches the original asker and lands in `agent_faq`; the same question asked again is answered directly.
- [x] Agent CC'd on a thread stays silent.
- [x] Same webhook delivered twice produces one reply.
- [x] An out-of-office auto-reply to the agent produces no response.
- [ ] A French question gets a French answer (model behaviour: test live once the key is set).

`npm run smoke:agent` runs the sandbox version of this list.

## Open decisions for Josef

- [ ] Agent address and domain (root domain or a subdomain).
- [ ] Exact TFS whitelist: whole domain, or named people only (Elana, MaryClaire, Orlaith, others).
- [ ] Whether student leaders get whitelisted, and if so, whether they see student names.
- [ ] Confirm the TFS account is allowed to forward school email to an outside address before CC'ing the agent from it.
- [ ] Written criteria per lesson for "what type of mentor" (the Lesson Editor's mentor brief; the agent can set it by email).
