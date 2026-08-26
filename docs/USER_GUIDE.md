# CareLink User Guide

Welcome to CareLink. This guide explains everything the platform does in
plain language. No technical background needed. If a section gets a little
technical (like the security section), it still avoids jargon wherever it
can, and explains any term it has to use.

CareLink connects everyone involved in home care: the hospital that refers a
patient, the office team that organizes care, the manager who oversees
caregivers, the caregivers who visit, the clients receiving care, and their
families.

---

## Signing in

1. You receive an invite link from your administrator.
2. Open the link, choose a password of at least 8 characters, and you are in.
3. Next time, go to the sign in page and use your email and password.
4. Click the eye icon in the password box to see what you are typing.

Forgot your password? Use "Forgot password?" on the sign in page. You'll get
a 6 digit code by email that expires in 10 minutes, then you can set a new
password. If you never get the email, ask your administrator to check
whether the platform's email sending is configured (see "Email" under
Integrations, below) — either way, they can copy you a fresh invite link
manually, which works the same way.

---

## The chat bubble

Every signed in page has a floating chat button. What it does depends on
your role:

- **Hospital partners** get a support bubble that starts as a conversation
  with the AI assistant. Ask it anything about referrals or the platform. If
  it can't fully help, or you'd rather talk to a person, an option appears
  after a couple of questions to connect you with a real customer service
  representative — a random available agent, picked automatically. Once
  you're connected, the same window becomes that live conversation. There is
  no separate "Messages" section for this role; everything happens here.
- **Family members** get the AI assistant only, since this role is read
  only for everything else on the platform too.
- **Everyone else** (admin, manager, customer service, field staff, client)
  gets a bubble with two tabs: **Assistant** (the AI) and **Messages** (real
  conversations with real people). There's also a full page version of
  Messages in the sidebar for anyone who wants more room.

---

## The bell

The bell near your name shows notifications: new messages, schedule changes,
referral updates, approvals, and emergencies. A red number means unread items.

You decide what you get notified about. Go to Settings, then Notifications,
and switch each category on or off. For example, you can keep message alerts
on while muting news announcements.

---

## How it works, in plain English

This section explains the mechanics behind the features people ask about
most: messaging, the location check when caregivers clock in, how secure
the whole thing is, what's connected to outside systems, and what happens
to your data.

### How messaging works

Think of every conversation as a private, two person room. Nobody else can
see what's said inside it — not other users, not (currently) any admin
screen. There's no group chat; it's always exactly two people.

Who's allowed to open a room with whom follows a simple set of rules:

- **Customer service can message anyone**, and anyone can message customer
  service. They're the platform's front desk.
- **Clients and field staff** can message each other only if they've ever
  shared a visit — past, present, or future. If you've never had a shift
  together, you won't show up in each other's contact list. Once you have,
  that stays true even if the visit gets rescheduled or cancelled later.
- **Managers and their field staff** can message each other directly.
- **Admins and hospital partners** can message each other directly (the
  "chat with hospital" option customer service also has).
- **Hospital partners** don't pick a specific person to message at all.
  They talk to the AI assistant, and when they ask to be connected to a
  person, the platform picks an available customer service agent for them
  automatically. If they've talked to CS before, asking again reconnects
  them to that same ongoing conversation rather than starting a new one
  with someone different each time.
- **Family members** can't message anyone. Their access to the platform is
  read only by design.

When a message is sent, it appears instantly for the other person if
they're online (through a live connection called a WebSocket — think of it
as a phone line that stays open between your browser and the server, so
messages arrive the moment they're sent rather than the page needing a
refresh). If they're not online, it waits for them and also creates a
notification, so the bell still lights up when they're back.

**Is chat history saved?** Yes. Every message is stored permanently in the
database, the same as any other CareLink record — there's currently no
automatic deletion or "disappearing messages" feature. Only the two people
in a conversation can read its contents through the app. There's no admin
screen that lists out what people said to each other; the only thing an
admin can see platform-wide is a count of how many messages each person
sent (in Reports), never the content.

### How geofencing works (the clock-in location check)

"Geofencing" just means checking whether someone's phone is inside an
invisible circle drawn around a specific address.

Here's exactly what happens when a caregiver taps "Clock in":

1. The app asks the phone's browser for its current GPS location (the same
   permission prompt any maps app uses).
2. The server compares that location to the client's saved home address
   (also stored as GPS coordinates) and calculates the straight-line
   distance between the two points.
3. If that distance is 100 meters or less, the clock-in goes through
   immediately.
4. If it's more than 100 meters, the caregiver has to type a reason before
   they can continue — for example, "parking was full, parked across the
   street." That reason, along with exactly how far away they were, gets
   saved on the shift record, and their manager gets notified right away.
   It also shows up in a dedicated report ("Clock-in location overrides")
   so a manager or admin can spot patterns — the same person overriding
   constantly, or always giving a vague reason — instead of each one being
   an isolated notification that's easy to lose track of.
5. There's also a time check, separate from location: clock-in only works
   starting 15 minutes before the visit's scheduled start. Arriving earlier
   than that won't let you clock in yet.
6. On the other end of the visit, clock-out only becomes available in the
   last 7 minutes before the scheduled end time. There's no override for
   this one — it exists specifically to stop a visit from being ended
   early, so it's a hard rule with no exceptions built in.

If a caregiver's phone can't provide a location at all (GPS turned off, or
they said no to the permission prompt), the location check is simply
skipped and the clock-in goes through on the time check alone — it's not
designed to lock anyone out entirely over a phone setting.

### How secure the platform is

In plain terms, here's what protects your information:

- **No public sign up.** The only way to get an account is an administrator
  inviting you by email. There's no "create an account" button anyone
  could stumble onto.
- **Passwords are never stored as typed.** They go through one-way
  scrambling (called hashing) before being saved, using a method Django
  (the framework this platform is built on) has used for years. Nobody —
  not even an administrator with full database access — can look up your
  actual password.
- **Sessions expire.** Being signed in relies on a temporary digital pass
  (called a token) that expires after 12 hours, with a longer-lived pass
  behind it that renews things for up to 14 days. After that, you'll need
  to sign in again. This limits how long a stolen device or session could
  be misused.
- **Everyone only sees what their role allows**, and that's checked on the
  server every single time, not just hidden in the app's design. Even the
  AI assistant follows this: it's only ever given the data your role could
  already see, so two people with different roles asking the exact same
  question can get different answers.
- **Everything travels encrypted.** Once deployed, all traffic (the app
  itself, the API, the live chat connection) runs over HTTPS, the same
  padlock-icon encryption your bank's website uses.
- **Uploaded files are capped at 10MB** and are served through the backend
  rather than sitting in a public folder anyone could stumble onto with the
  right link.
- **Content can be restricted by role.** Resources (care guides) and news
  posts can be set to show only to specific roles, so, for example, an
  internal company policy never shows up for clients.
- **Cross-site restrictions.** The backend only accepts requests from the
  official CareLink website address, not from some other random site
  pretending to be it.

Nothing here makes CareLink immune to every possible attack — no system
is — but these are the concrete measures actually built into it today.

### What CareLink is prepared to connect to (integrations)

- **Email (SendGrid)** — sends invite links, bulk invite emails, and
  password reset codes. Fully working once an API key is added to the
  server's configuration. Without a key, those emails are printed to the
  server's own log instead of actually sent, so the platform still works
  for testing, you just copy the link manually.
- **AI (Google Gemini)** — powers the assistant bubble and AI search.
  Fully working once an API key is added. Without one, the AI features
  give a polite "not connected yet" message instead of an answer.
- **Outlook / Microsoft 365 email intake** — not active yet. The plan: once
  your Microsoft 365 administrator approves the right permissions, incoming
  referral emails would be automatically read, sorted using rules you set
  up in Integrations, and turned into referrals with AI pulling out the
  key details. The rules panel and the "how it'll work" plumbing already
  exist; only the actual connection to Microsoft's mail servers is pending
  on their side.
- **Procura / AlayaCare** — not active yet. The plan: your team maps
  Procura's field names to CareLink's in the Integrations panel now, so the
  moment your vendor confirms how you're allowed to connect (an export
  file, an API, etc.), the sync can start using that mapping immediately
  rather than being built from scratch.
- **Excel import and export** — fully working today, no external account
  needed. Bulk-inviting users, bulk-creating programs, and every report all
  support Excel (.xlsx) upload or download directly.

---

## Messaging

Open Messages in the menu, or use the chat bubble (see "The chat bubble"
above — hospital partners work differently, through the AI-first support
panel instead).

- Click New chat to start a conversation. You will only see people you are
  allowed to message, following the rules explained in "How messaging
  works" above.
- Messages arrive instantly, no refresh needed.
- Unread counts appear in the list and on the bubble.

---

## If you are a Hospital Partner

You refer patients into CareLink and follow their progress.

- **My referrals** lists everything you have submitted and its current
  status: new, accepted, in progress, on hold, completed, or declined.
  Click any row to open the full detail in a side panel — client details,
  clinical intake, your submitted notes, and every document attached.
- **Add documents any time.** From that same detail panel, you can attach
  more files whenever you need to, not just when you first submit —
  useful if a discharge summary or updated chart comes in later.
- **New referral** is a simple form: the client's name, age, contact,
  diagnosis, care needs, urgency, notes, and any documents such as discharge
  summaries. Files up to 10MB each.
- The office team is alerted the moment you submit, and you get a
  notification whenever the status changes.
- Questions about a referral? Open the chat bubble, ask the assistant, and
  if you need a person, ask to be connected — you'll be paired with an
  available customer service representative automatically.

---

## If you are Customer Service

You are the operational heart: triaging referrals, building the schedule,
and responding to emergencies.

- **Dashboard** shows today at a glance: new referrals, high urgency cases,
  shifts today, and open emergencies. Click any tile to jump in.
- **Referral queue** lists every referral. Click one to read the details,
  open attached documents, change the status, and assign a caregiver. The
  hospital partner is notified automatically when the status changes.
- **Schedule** shows shifts grouped by employee. At the top you have:
  - a **search bar** to find any employee by name or email,
  - a **program filter** to show only staff in one program,
  - a **sort by program** switch to group the list by program.
  Click New shift to schedule a visit. Both the caregiver and the client are
  notified automatically.
- **Emergencies** lists requests from clients and reports from caregivers.
  Acknowledge them so the team knows someone is on it, then resolve them.
- **Change requests** shows every reschedule and cancellation request from
  field staff and clients, with the reason they gave. You (like the
  assigned manager, or an admin) can approve or decline these directly —
  it's not limited to whichever manager the request was originally routed
  to, so nothing sits stuck if that manager is unavailable. Approving a
  reschedule doesn't move the shift by itself; you apply the actual new
  time from this screen once you've confirmed it. Approving a cancellation
  gives you a "Cancel shift" button that marks the shift cancelled and
  notifies everyone involved.
- If a request sits unanswered as its shift start time gets close, the
  system automatically re-notifies the manager and pings customer service
  and admins directly too, so it doesn't just quietly expire with nobody
  covering the visit.

---

## If you are a Manager

You oversee a team of caregivers and decide on their shift change requests.

- **Approvals** is your queue. Each card shows who is asking, whether it's
  a reschedule or a cancellation, which shift, their reason (chosen from a
  predefined list so you get consistent, useful detail instead of vague
  free text), and their preferred new time if they gave one.
- **Approve** sends the request to customer service, who update the
  schedule (or cancel the shift, for cancellation requests). The caregiver
  is told it was approved.
- **Decline** notifies the caregiver directly. You can attach a short note
  either way.
- If you don't get to a request in time, customer service and admins can
  also step in and decide it — you're not the only person who can act on
  it, and you'll both be re-notified if it's still pending as the shift
  gets close.
- You'll also be notified whenever one of your staff clocks in from
  outside the normal 100 meter radius of a client's address, along with
  the reason they gave. The full history of these shows up in Reports
  under "Clock-in location overrides."
- You can also see the team schedule and message your caregivers and the
  office team.

---

## If you are Field Staff (a caregiver)

Your day runs from My schedule.

- **Upcoming** shows your next visits with the time and address.
- **On my way** sends the client a friendly heads up that you are en route.
- **Clock in** opens 15 minutes before the visit starts. CareLink checks you
  are within 100 meters of the client's address using your phone's location.
  If you're further away — say, parking was full and you had to park down
  the block — you'll be asked to explain why before you can clock in. That
  reason is saved, sent to your manager right away, and shows up in a
  report, so be specific and honest; it's meant to explain legitimate
  situations, not be brushed past.
- **Clock out** only becomes available in the last 7 minutes before your
  shift is scheduled to end. There's no way around this one — it's there
  to make sure visits run their full scheduled length.
- **Request change** lets you ask for a reschedule or a cancellation. Pick
  which one, then pick a reason from the list:
  - Sick and can't safely provide care
  - Transportation problem
  - Personal emergency
  - Family emergency
  - Double booked / scheduling conflict
  - Weather or unsafe travel conditions
  - Client no longer needs this visit
  - Other (with a text box to explain)

  Two of the options work differently: **a safety concern at the client's
  location** or **a medical emergency happening right now**. Picking either
  of these does not let you submit a normal request — instead you're
  pointed straight to the red Emergency button, because those situations
  need customer service alerted immediately, not a request that waits for
  a manager to open their queue.

  Everything else goes to your manager, who can approve or decline it (and
  if they don't get to it in time, customer service or an admin can step
  in too). You're notified either way.
- **Add documentation** on past visits: notes about how it went, plus an
  optional file.
- Message your clients, the office team, and your manager any time.

---

## If you are a Client

- **Home** shows your upcoming visits and who is coming. When your caregiver
  taps On my way, you see it live.
- **Request change** on any visit lets you pick Reschedule or Cancel, then
  a reason from the same list field staff use. Picking a reason about an
  active safety or medical emergency routes you to Emergency request
  instead of a regular request, since that needs the office team's
  attention right away.
- The red **Emergency request** button alerts the care team immediately.
  For life threatening emergencies always call 911 first.
- **Family access** lets you add family members by name and email. They get
  a read only view of your visit schedule. You can remove access any time.
- **Resources** has care guides written in plain language.
- Message any caregiver who has visited you.

---

## If you are a Family Member

- **Care overview** shows your loved one's upcoming and recent visits, read
  only. If there is an active emergency you see it flagged at the top.
- **Resources** includes guides for family caregivers too, like recognizing
  caregiver burnout.
- You don't have access to messaging on this role; you can still ask the AI
  assistant questions any time.

---

## If you are an Administrator

You run the platform.

- **Users and invites**: create accounts for every role. Each new account
  gives you an invite link to share, and you can copy a fresh link any time
  someone loses theirs. Edit anyone's role, manager, programs, or deactivate
  an account.
- **Programs**: create the service programs your organization runs, for
  example Palliative Care. Assign employees to programs from their edit
  screen. Customer service can then filter and sort staff by program.
- **News posts**: publish announcements to everyone, or target specific
  roles only.
- **Integrations**:
  - **Procura field mapping**: prepare the mapping between Procura field
    names and CareLink fields. The live sync switches on once vendor access
    is confirmed.
  - **Outlook and efax intake**: write the sorting rules for incoming
    referral emails, for example subject contains "referral". Once your
    Microsoft 365 administrator grants access, matching emails will be read
    and turned into referrals automatically, marked with source outlook.
- **Reports**: every report available to managers, plus referral,
  emergency, and per-user messaging logs. Filter by date range or staff
  member and export to Excel.
- You also see the operations dashboard, referral queue, schedule,
  approvals, and change requests, and can decide any pending change
  request the same way a manager or customer service agent can.

---

## The AI, explained simply

CareLink's AI features use a technique called retrieval augmented
generation. In plain terms: before answering, the system first gathers the
relevant CareLink information your account can see, then asks the AI to
answer using only that information. Three places use it:

- **The chat bubble's assistant** (or the whole bubble, for hospital
  partners and family): how-to guidance plus answers about your own data.
- **AI search**: ask questions in plain language, like "which referrals are
  high urgency", and get an answer grounded in your role's data.
- **The hospital partner support flow**: the same assistant, with a path to
  a live person built in once you need one.

Two people with different roles asking the same question get different
answers, because each answer is built only from what that person is allowed
to see.

---

## Common questions

**I did not get my invite.** Ask your administrator to copy a fresh invite
link from the Users page and send it to you.

**The clock in button says I am too far away.** The check uses your phone's
location and the client's saved address. If you are genuinely at the right
place, or there's a real reason you're not, explain it when asked — it gets
logged and sent to your manager, it isn't blocked outright.

**Why can't I clock out yet?** Clock out only opens in the final 7 minutes
before your shift's scheduled end time. There's no way to end it earlier.

**I want to cancel a shift, not just reschedule it.** Use Request change,
choose Cancel shift, and pick a reason. It follows the same approval flow
as a reschedule request.

**My change request has been sitting for a while, is anyone going to see
it?** Yes — customer service and admins can decide it too, not only the
manager it was sent to, and the system automatically re-notifies everyone
involved if it's still pending as the shift start time approaches.

**Can I turn off some notifications but keep others?** Yes. Settings, then
Notifications, then switch categories individually.

**Who can see my messages?** Only the two people in the conversation. See
"How messaging works" above for the full explanation, including how long
messages are kept.

**Why can I not message a certain person?** Messaging follows care
relationships. For example, clients can only message caregivers they have
had visits with. If someone is missing, the relationship likely is not set
up yet, ask the office team. If you're a hospital partner, you don't pick a
person at all — use the chat bubble and ask to be connected.
