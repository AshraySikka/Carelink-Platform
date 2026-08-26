"""
Seed a large, realistic demo dataset: 1 admin, 8 managers, 30 field staff,
15 customer service agents, 6 hospital partners across 4 hospitals, 40
clients, 52 family members, 18 programs, hundreds of shifts spanning past,
today, and future (every client gets 12 shifts from yesterday through two
weeks out, plus 3 older ones, plus a handful timed close to right now for
testing clock in and the geofence), a spread of referrals, an emergency for
every single client, shift change requests in every state, news posts, and
a few starter conversations.

Run with:  python manage.py seed_demo
Safe to rerun, it wipes and recreates demo data each time. Uses a fixed
random seed so the same command always produces the same dataset.
"""
import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from accounts.models import Hospital, InviteStatus, Roles, User
from care.models import (
    ChangeRequestStatus, EmergencyRequest, FamilyMember, NewsPost, Program,
    Referral, Resource, Shift, ShiftChangeRequest, ShiftStatus,
)
from messaging.models import Conversation, ConversationParticipant, Message
from notifications.utils import ensure_default_preferences

DEMO_PASSWORD = "CareLinkDemo!2026"
random.seed(42)  # deterministic: rerunning the command builds the same data

FIRST_NAMES = [
    "Nia", "Diego", "Elena", "Priya", "Sam", "Marcus", "Isabela", "Omar",
    "Grace", "Liam", "Sofia", "Andre", "Maya", "Ethan", "Chloe", "Noah",
    "Amara", "Jonas", "Ines", "Felix", "Zara", "Leo", "Tamsin", "Kai",
    "Ruby", "Miles", "Nadia", "Oscar", "Bianca", "Theo", "Yara", "Hugo",
    "Freya", "Amir", "Lucia", "Dante", "Wren", "Silas", "Ivy", "Rocco",
]
LAST_NAMES = [
    "Thompson", "Alvarez", "Rossi", "Nair", "Carter", "Chen", "Cruz",
    "Farouk", "Kim", "Bennett", "Delgado", "Okafor", "Novak", "Reyes",
    "Whitfield", "Osei", "Larsen", "Petrov", "Diallo", "Hughes", "Ashworth",
    "DeLuca", "Kowalski", "Nakamura", "Jensen", "Briggs", "Halloran",
]
CREDENTIALS = ["CNA", "HHA", "LPN", "RN", "PSW"]


def name_for(pool_offset, index):
    """A deterministic, varied full name. pool_offset separates name
    ranges used by different roles so different roles rarely collide."""
    i = pool_offset + index
    first = FIRST_NAMES[i % len(FIRST_NAMES)]
    last = LAST_NAMES[(i * 7 + pool_offset) % len(LAST_NAMES)]
    return first, last


PROGRAM_NAMES = [
    "Palliative Care", "Post Surgical Recovery", "Dementia Support",
    "Pediatric Home Care", "Diabetes Management", "Wound Care",
    "Respiratory Therapy", "Physical Therapy", "Hospice Care",
    "Maternity Support", "Orthopedic Recovery", "Cardiac Care",
    "Stroke Recovery", "Mental Health Support", "Nutrition Counseling",
    "Medication Management", "Fall Prevention", "Chronic Pain Management",
]

HOSPITAL_NAMES = [
    "Riverside Demo Hospital", "Lakeside Medical Center",
    "Harborview General", "Cedar Grove Regional",
]

AVAILABILITY_TEMPLATES = [
    {"mon": "09:00-17:00", "tue": "09:00-17:00", "wed": "09:00-17:00", "thu": "09:00-17:00", "fri": "09:00-15:00", "sat": None, "sun": None},
    {"mon": "08:00-16:00", "tue": "08:00-16:00", "wed": "08:00-16:00", "thu": "08:00-16:00", "fri": "08:00-14:00", "sat": None, "sun": None},
    {"mon": None, "tue": "12:00-20:00", "wed": "12:00-20:00", "thu": "12:00-20:00", "fri": "12:00-20:00", "sat": "10:00-16:00", "sun": None},
    {"mon": "07:00-15:00", "tue": "07:00-15:00", "wed": None, "thu": "07:00-15:00", "fri": "07:00-15:00", "sat": None, "sun": "09:00-13:00"},
    {"mon": "10:00-18:00", "tue": "10:00-18:00", "wed": "10:00-18:00", "thu": None, "fri": "10:00-18:00", "sat": "10:00-14:00", "sun": None},
]
AVAILABILITY_NOTES = [
    "Prefers morning shifts, can pick up extra on short notice.",
    "Weekdays only, no evenings.",
    "Afternoons and Saturdays.",
    "Early starts preferred.",
    "Flexible on weekends with notice.",
]

REFERRAL_SPECS = [
    ("Eleanor Ashworth", "normal", "new", "", "Post hip replacement, daily mobility support for 2 weeks.",
     {"diagnosis": "Hip replacement recovery", "insurance": "BlueShield PPO", "mobility": "Walker, needs standby assist", "cognition": "Alert and oriented", "living_situation": "Lives with spouse", "allergies": "Penicillin", "preferred_start": "Within 3 days", "weekly_hours": "20"}),
    ("Frank DeLuca", "high", "new", "Fall risk, lives alone", "Discharged today after CHF exacerbation. Lives alone.",
     {"diagnosis": "Congestive heart failure", "insurance": "Medicare", "mobility": "Independent but unsteady", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "None known", "preferred_start": "Immediately", "weekly_hours": "30"}),
    ("Gwen Halloran", "low", "accepted", "", "Companion visits, light housekeeping.",
     {"diagnosis": "General frailty", "insurance": "Private pay", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "Shellfish", "preferred_start": "Next week", "weekly_hours": "10"}),
    ("Samuel Kirby", "emergency", "in_progress", "24/7 coverage required", "Just discharged from ICU, needs initial 24/7 coverage.",
     {"diagnosis": "Post ICU deconditioning", "insurance": "Medicare Advantage", "mobility": "Bed to chair with 2 person assist", "cognition": "Intermittent confusion", "living_situation": "Lives with daughter", "allergies": "Sulfa drugs", "preferred_start": "Today", "weekly_hours": "84"}),
    ("Nadia Petrov", "normal", "completed", "", "Six week post op care completed successfully.",
     {"diagnosis": "Knee replacement recovery", "insurance": "BlueShield HMO", "mobility": "Cane", "cognition": "Alert", "living_situation": "Lives with spouse", "allergies": "Latex", "preferred_start": "Completed", "weekly_hours": "15"}),
    ("Harold Jensen", "high", "accepted", "Oxygen dependent", "COPD, oxygen dependent, needs medication management support.",
     {"diagnosis": "COPD stage 3", "insurance": "Medicare", "mobility": "Short distances with rollator", "cognition": "Alert", "living_situation": "Lives alone, daughter nearby", "allergies": "None known", "preferred_start": "Within a week", "weekly_hours": "25"}),
    ("Rosa Delgado", "normal", "in_progress", "", "Dementia support, structured daily routine and meal preparation.",
     {"diagnosis": "Alzheimer's, moderate stage", "insurance": "Medicaid", "mobility": "Independent, wanders", "cognition": "Moderate impairment", "living_situation": "Lives with son", "allergies": "Codeine", "preferred_start": "Started", "weekly_hours": "40"}),
    ("Walter Briggs", "low", "on_hold", "Awaiting insurance authorization", "Weekly wellness checks pending insurance approval.",
     {"diagnosis": "Type 2 diabetes", "insurance": "Pending authorization", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives with roommate", "allergies": "None known", "preferred_start": "On authorization", "weekly_hours": "6"}),
    ("June Nakamura", "normal", "new", "", "Post stroke rehab support, speech therapy coordination.",
     {"diagnosis": "Ischemic stroke recovery", "insurance": "BlueShield PPO", "mobility": "Hemiparesis, walker", "cognition": "Mild aphasia", "living_situation": "Lives with spouse", "allergies": "Aspirin sensitivity", "preferred_start": "Within 5 days", "weekly_hours": "18"}),
    ("Peter Kowalski", "high", "declined", "Out of service area", "Family requested service outside our coverage region.",
     {"diagnosis": "Parkinson's disease", "insurance": "Medicare", "mobility": "Freezing episodes", "cognition": "Alert", "living_situation": "Lives with spouse", "allergies": "None known", "preferred_start": "N/A", "weekly_hours": "20"}),
    ("Isabelle Moreau", "high", "new", "Family reports confusion", "Sudden onset confusion, family requesting urgent evaluation.",
     {"diagnosis": "Delirium, cause unclear", "insurance": "Medicare", "mobility": "Independent", "cognition": "Acutely confused", "living_situation": "Lives alone", "allergies": "None known", "preferred_start": "Immediately", "weekly_hours": "35"}),
    ("Arturo Sandoval", "normal", "new", "", "Post cataract surgery, needs help with eye drop schedule and transport.",
     {"diagnosis": "Post cataract surgery", "insurance": "Private pay", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives with daughter", "allergies": "None known", "preferred_start": "This week", "weekly_hours": "8"}),
    ("Estelle Roux", "emergency", "new", "Send RN evaluator today", "Re-admitted 2 days ago, needs urgent RN evaluation.",
     {"diagnosis": "Post surgical infection", "insurance": "Medicare", "mobility": "Bed rest", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "Penicillin", "preferred_start": "Today", "weekly_hours": "50"}),
    ("Dmitri Volkov", "low", "accepted", "", "Weekly check ins for medication compliance.",
     {"diagnosis": "Hypertension", "insurance": "Medicare", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "None known", "preferred_start": "Next week", "weekly_hours": "4"}),
    ("Portia Blackwell", "normal", "in_progress", "", "Post hip fracture, home safety assessment requested.",
     {"diagnosis": "Hip fracture recovery", "insurance": "BlueShield PPO", "mobility": "Walker", "cognition": "Alert", "living_situation": "Lives with sister", "allergies": "None known", "preferred_start": "Ongoing", "weekly_hours": "22"}),
]

RESOURCES = [
    ("Preventing falls at home", "Safety", "Simple changes that reduce fall risk.",
     "Remove loose rugs and clear walkways. Install grab bars in bathrooms. Keep stairs well lit. Wear non slip footwear. Review medications that cause dizziness with your doctor.",
     []),
    ("Signs of a stroke, the FAST test", "Emergency", "Recognize a stroke in seconds.",
     "F: face drooping on one side. A: arm weakness. S: speech difficulty. T: time to call 911. Every minute matters, do not wait to see if symptoms pass.",
     []),
    ("Medication management basics", "Health", "Keeping track of medications safely.",
     "Keep an up to date list of all medications and doses. Use a weekly pill organizer. Set daily alarms. Never share medications. Bring your list to every appointment.",
     []),
    ("Caregiver burnout warning signs", "Family Support", "When to ask for help.",
     "Constant exhaustion, withdrawal from friends, feeling hopeless or resentful, frequent illness, sleep or appetite changes. Respite care exists for this, ask CareLink about relief options.",
     []),
    ("Home oxygen safety", "Safety", "Living safely with supplemental oxygen.",
     "Keep oxygen at least 3 meters from open flames. No smoking anywhere in the home. Secure tanks upright. Check tubing for kinks daily. Post a sign at the entrance for emergency responders.",
     []),
    ("Nutrition for healing", "Health", "Eating well during recovery.",
     "Prioritize protein at every meal to rebuild tissue. Stay hydrated, aim for 6 to 8 glasses of water daily unless fluid restricted. Small frequent meals beat large ones when appetite is low.",
     []),
    ("Understanding dementia behaviors", "Family Support", "Responding with patience and technique.",
     "Agitation often signals an unmet need: pain, hunger, or overstimulation. Keep routines consistent. Redirect rather than correct. Short answers, calm tone, one question at a time.",
     []),
    # These last two exist specifically to demonstrate audience targeting:
    # the first is staff only and should never show up for a client, family
    # member, or hospital partner, on the Resources page or from the AI
    # assistant. The second is the reverse, client and family facing
    # wellness content that staff do not need cluttering their own list.
    ("CareLink incident escalation policy", "Company Policy", "Internal only, not visible to clients or family.",
     "If a client reports chest pain, shortness of breath, or any life threatening symptom, call 911 immediately, then notify customer service through the Emergencies screen. Do not wait for a callback before calling 911. Document the incident in Clinical documentation once the client is stable.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Mindful breathing for stress", "Wellness", "A simple technique to ease anxiety before a visit or appointment.",
     "Sit comfortably. Breathe in slowly through your nose for a count of four, hold for four, exhale through your mouth for a count of six. Repeat for two to three minutes.",
     ["client", "family"]),
]

EMERGENCY_DESCRIPTIONS = [
    "Fell in the bathroom, feeling dizzy but no injury.",
    "Oxygen tank alarm went off overnight, need someone to check equipment.",
    "Client refusing medication; family unreachable.",
    "Elevated blood pressure reading; called triage.",
    "Chest pain, called 911, notifying CareLink.",
    "Client reports shortness of breath during visit.",
    "Smoke detector going off, no visible fire, checking on client.",
    "Client missed two doses of medication, confused about schedule.",
    "Slipped getting out of bed, minor bruising, declined hospital.",
    "Unusual confusion noted during visit, monitoring closely.",
    "Caregiver arrived to find front door unlocked and client not home.",
    "Client reports chest tightness after minor exertion.",
    "Power outage at client's home, checking on medical equipment.",
    "Client had a fall risk near miss on the stairs.",
    "Family reports client has not been eating for two days.",
    "Client pressed the emergency button, unresponsive on first call back.",
    "Wound dressing came loose overnight, some bleeding noted.",
    "Client reports dizziness after standing up too quickly.",
    "Caregiver noticed irregular heartbeat during a routine check.",
    "Client locked out after a fall alarm went off outside the home.",
]


class Command(BaseCommand):
    help = "Reset and seed a large demo dataset"

    def handle(self, *args, **options):
        self.stdout.write("Wiping demo data...")

        # Referrals reference hospital submitters, which are protected
        # foreign keys, so clear those first or the user delete below fails.
        # A broad filter on purpose: earlier versions of this command used
        # different email patterns for some roles (an old
        # "manager1@carelink.demo" style for managers, for example). Every
        # demo account this command has ever created ends in either
        # @yopmail.com or @carelink.demo, so matching on that instead of a
        # single fixed prefix reliably clears out every past run, not just
        # the current one, and stops stale accounts from silently piling up.
        demo_accounts = Q(email__iendswith="@yopmail.com") | Q(email__iendswith="@carelink.demo")
        Referral.objects.filter(submitted_by__email__iendswith="@yopmail.com").delete()
        Referral.objects.filter(submitted_by__email__iendswith="@carelink.demo").delete()
        # EmergencyRequest.client and .reporter are SET_NULL, not CASCADE,
        # so deleting users alone would leave old rows behind as orphans.
        EmergencyRequest.objects.all().delete()
        User.objects.filter(demo_accounts).delete()
        Hospital.objects.filter(name__in=HOSPITAL_NAMES).delete()
        Program.objects.filter(name__in=PROGRAM_NAMES).delete()

        # ---------------- Hospitals and programs ----------------
        hospitals = [Hospital.objects.create(name=n) for n in HOSPITAL_NAMES]
        programs = [Program.objects.get_or_create(name=n)[0] for n in PROGRAM_NAMES]

        # ---------------- Admin ----------------
        admin = User.objects.create_user(email="admin@carelink.demo", password=DEMO_PASSWORD, full_name="CareLink Admin",
                                          role=Roles.ADMIN, invite_status=InviteStatus.ACTIVE)
        ensure_default_preferences(admin)

        # ---------------- Managers (8) ----------------
        managers = []
        for i in range(8):
            first, last = name_for(0, i)
            email = f"demo.mgr{i + 1:02d}@yopmail.com"
            user = User.objects.create_user(email=email, password=DEMO_PASSWORD, full_name=f"{first} {last}",
                                             role=Roles.MANAGER, phone=f"555-02{i:02d}", invite_status=InviteStatus.ACTIVE)
            ensure_default_preferences(user)
            managers.append(user)

        # Partition the 18 programs across the first 7 managers, a distinct
        # non overlapping slice each, so their program scoped dashboards
        # show visibly different data instead of everyone seeing nearly
        # the whole platform. The 8th manager, demo.mgr08, is deliberately
        # left with no programs and no team, so the dashboard's "no
        # programs assigned yet" empty state is also there to check.
        programmed_managers = managers[:-1]
        unprogrammed_manager = managers[-1]
        CHUNK_SIZES = [3, 3, 3, 3, 2, 2, 2]  # sums to 18, one chunk per manager
        manager_programs = {}
        cursor = 0
        for manager, size in zip(programmed_managers, CHUNK_SIZES):
            chunk = programs[cursor:cursor + size]
            cursor += size
            manager.programs.set(chunk)
            manager_programs[manager.id] = chunk

        # ---------------- Field staff (30) ----------------
        # Each field staff member reports to one of the 7 programmed
        # managers and works only in that manager's own programs, so a
        # manager's dashboard, staff directory, and program filter all
        # agree with each other and with who actually reports to them.
        field_staff = []
        for i in range(30):
            first, last = name_for(200, i)
            credential = CREDENTIALS[i % len(CREDENTIALS)]
            email = f"demo.fs{i + 1:02d}@yopmail.com"
            template = AVAILABILITY_TEMPLATES[i % len(AVAILABILITY_TEMPLATES)]
            assigned_manager = programmed_managers[i % len(programmed_managers)]
            user = User.objects.create_user(
                email=email, password=DEMO_PASSWORD, full_name=f"{first} {last}, {credential}",
                role=Roles.FIELD_STAFF, phone=f"555-03{i:02d}", invite_status=InviteStatus.ACTIVE,
                manager=assigned_manager,
                address=f"{200 + i * 3} Oak St, Riverside, CA",
                latitude=43.64 + (i % 10) * 0.006, longitude=-79.40 + (i % 10) * 0.005,
                date_of_birth=date(1975 + (i % 20), 1 + (i % 12), 1 + (i % 27)),
                availability_schedule=template, availability_notes=AVAILABILITY_NOTES[i % len(AVAILABILITY_NOTES)],
                min_weekly_hours=16 + (i % 5) * 4,
            )
            ensure_default_preferences(user)
            user.programs.set(manager_programs[assigned_manager.id])
            field_staff.append(user)

        # ---------------- Customer service (15) ----------------
        customer_service = []
        for i in range(15):
            first, last = name_for(400, i)
            email = f"demo.cs{i + 1:02d}@yopmail.com"
            user = User.objects.create_user(email=email, password=DEMO_PASSWORD, full_name=f"{first} {last}",
                                             role=Roles.CUSTOMER_SERVICE, phone=f"555-05{i:02d}", invite_status=InviteStatus.ACTIVE)
            ensure_default_preferences(user)
            customer_service.append(user)

        # ---------------- Hospital partners (6) across 4 hospitals ----------------
        hospital_partners = []
        for i in range(6):
            first, last = name_for(600, i)
            email = f"demo.hp{i + 1:02d}@yopmail.com"
            title = ["Dr.", "Dr.", "", "", "", ""][i]
            suffix = ["", "", ", RN", ", RN", ", MD", ", MD"][i]
            display_name = f"{title} {first} {last}{suffix}".strip()
            user = User.objects.create_user(email=email, password=DEMO_PASSWORD, full_name=display_name,
                                             role=Roles.HOSPITAL_PARTNER, invite_status=InviteStatus.ACTIVE,
                                             hospital=hospitals[i % len(hospitals)])
            ensure_default_preferences(user)
            hospital_partners.append(user)

        # ---------------- Clients (40) ----------------
        clients = []
        for i in range(40):
            first, last = name_for(800, i)
            email = f"demo.client{i + 1:02d}@yopmail.com"
            user = User.objects.create_user(
                email=email, password=DEMO_PASSWORD, full_name=f"{first} {last}",
                role=Roles.CLIENT, phone=f"555-06{i:02d}", invite_status=InviteStatus.ACTIVE,
                address=f"{100 + i * 4} Maple Ave, Riverside",
                latitude=43.66 + (i % 12) * 0.005, longitude=-79.39 + (i % 12) * 0.004,
                date_of_birth=date(1935 + (i % 40), 1 + (i % 12), 1 + (i % 27)),
            )
            ensure_default_preferences(user)
            clients.append(user)

        # ---------------- Family members (52), spread across 40 clients ----------------
        # First 12 clients get 2 family members, the remaining 28 get 1.
        family_users = []
        family_index = 0
        for ci, client in enumerate(clients):
            count = 2 if ci < 12 else 1
            for _ in range(count):
                first, last = name_for(1000, family_index)
                email = f"demo.family{family_index + 1:02d}@yopmail.com"
                user = User.objects.create_user(email=email, password=DEMO_PASSWORD, full_name=f"{first} {last}",
                                                 role=Roles.FAMILY, invite_status=InviteStatus.ACTIVE)
                ensure_default_preferences(user)
                FamilyMember.objects.create(client=client, family_name=f"{first} {last}", family_email=email, family_user=user)
                family_users.append(user)
                family_index += 1

        # ---------------- Referrals ----------------
        submitters = hospital_partners
        # Referrals past the "new" stage get a real assigned caregiver, so
        # the manager dashboard's referral panels, which are scoped to a
        # manager's own field staff, actually have something on them
        # instead of always being empty.
        ASSIGNABLE_STATUSES = {"accepted", "in_progress", "completed"}
        for idx, (name, urgency, status, concerns, notes, intake) in enumerate(REFERRAL_SPECS):
            hospital = hospitals[idx % len(hospitals)]
            submitter = next((p for p in submitters if p.hospital_id == hospital.id), submitters[idx % len(submitters)])
            assigned = field_staff[idx % len(field_staff)] if status in ASSIGNABLE_STATUSES else None
            Referral.objects.create(
                hospital=hospital, submitted_by=submitter, client_name=name, urgency=urgency, status=status,
                notes=notes, concerns_flag=concerns, assigned_staff=assigned,
                client_details={"age": 60 + idx, "contact": f"555-07{idx:02d}"},
                intake_data=intake,
            )

        # ---------------- Shifts (100+) ----------------
        # Every client gets 12 visits spread across day -1 (yesterday)
        # through day +14 (two weeks out) inclusive, so the calendar view
        # always has a full two week spread to show regardless of when this
        # command is run. A further 3 older visits per client add some
        # completed history beyond that window for the Past visits table.
        now = timezone.now()
        shift_count = 0
        WINDOW_OFFSETS = [-1 + (k * 15) // 11 for k in range(12)]  # -1..14, 12 points
        HISTORY_OFFSETS = [-20, -14, -7]

        for ci, client in enumerate(clients):
            primary = field_staff[ci % len(field_staff)]
            secondary = field_staff[(ci + 7) % len(field_staff)]

            for k, day_offset in enumerate(WINDOW_OFFSETS):
                staff = secondary if k % 5 == 4 else primary
                hour = 7 + (k % 10)
                start = (now + timedelta(days=day_offset)).replace(hour=hour, minute=0, second=0, microsecond=0)
                end = start + timedelta(hours=2 + (k % 2))
                status = ShiftStatus.COMPLETED if start < now else ShiftStatus.SCHEDULED
                Shift.objects.create(
                    field_staff=staff, client=client, start_time=start, end_time=end,
                    location=client.address, status=status,
                    notes="Routine visit." if k % 2 == 0 else "",
                    clock_in_at=start + timedelta(minutes=2) if status == ShiftStatus.COMPLETED else None,
                    clock_out_at=end - timedelta(minutes=5) if status == ShiftStatus.COMPLETED else None,
                )
                shift_count += 1

            for h, day_offset in enumerate(HISTORY_OFFSETS):
                start = (now + timedelta(days=day_offset)).replace(hour=9 + h, minute=0, second=0, microsecond=0)
                end = start + timedelta(hours=2)
                Shift.objects.create(
                    field_staff=primary, client=client, start_time=start, end_time=end,
                    location=client.address, status=ShiftStatus.COMPLETED,
                    notes="Routine visit.",
                    clock_in_at=start + timedelta(minutes=2), clock_out_at=end - timedelta(minutes=5),
                )
                shift_count += 1

        # A dedicated batch of "right now" shifts for clock in and geofence
        # testing: one clockable in a few minutes, one clockable right now,
        # one that already started, one later today, one that already ended.
        today_specs = [
            (-90, -60, "completed_earlier"),
            (-10, 50, "in_window_now"),
            (5, 65, "clockable_soon"),
            (180, 240, "later_today"),
            (300, 360, "later_today"),
        ]
        for i, (start_offset_min, end_offset_min, _label) in enumerate(today_specs):
            staff = field_staff[i % 3]
            client = clients[i % 5]
            start = now + timedelta(minutes=start_offset_min)
            end = now + timedelta(minutes=end_offset_min)
            past_and_done = end < now
            Shift.objects.create(
                field_staff=staff, client=client, start_time=start, end_time=end,
                location=client.address,
                status=ShiftStatus.COMPLETED if past_and_done else ShiftStatus.SCHEDULED,
                notes="Seeded for clock in and geofence testing today.",
                clock_in_at=start + timedelta(minutes=2) if past_and_done else None,
                clock_out_at=end - timedelta(minutes=5) if past_and_done else None,
            )
            shift_count += 1

        self.stdout.write(f"Created {shift_count} shifts.")

        # ---------------- Shift change requests, every state ----------------
        # Pending: a real open request a manager can act on.
        pending_shift = Shift.objects.filter(field_staff=field_staff[0], status=ShiftStatus.SCHEDULED, start_time__gt=now).order_by("start_time").first()
        if pending_shift:
            pending_shift.status = ShiftStatus.CHANGE_REQUESTED
            pending_shift.change_request_note = "Need to move earlier, doctor's appointment."
            pending_shift.requested_start_time = pending_shift.start_time - timedelta(hours=2)
            pending_shift.requested_end_time = pending_shift.end_time - timedelta(hours=2)
            pending_shift.save()
            ShiftChangeRequest.objects.create(
                shift=pending_shift, requested_by=field_staff[0], manager=field_staff[0].manager,
                reason="Need to move earlier, doctor's appointment.",
                requested_start_time=pending_shift.requested_start_time, requested_end_time=pending_shift.requested_end_time,
                status=ChangeRequestStatus.PENDING,
            )

        # Approved: shows the new "approved, pending change" status in action.
        approved_shift = Shift.objects.filter(field_staff=field_staff[1], status=ShiftStatus.SCHEDULED, start_time__gt=now).order_by("start_time").first()
        if approved_shift:
            new_start = approved_shift.start_time + timedelta(hours=3)
            new_end = approved_shift.end_time + timedelta(hours=3)
            approved_shift.status = ShiftStatus.APPROVED_PENDING_CHANGE
            approved_shift.save()
            ShiftChangeRequest.objects.create(
                shift=approved_shift, requested_by=field_staff[1], manager=field_staff[1].manager,
                reason="Client asked to push the visit later in the day.",
                requested_start_time=new_start, requested_end_time=new_end,
                status=ChangeRequestStatus.APPROVED, decided_by=field_staff[1].manager, decided_at=now - timedelta(hours=1),
                decision_note="Approved, please reschedule.",
            )

        # Declined: for a full history view.
        declined_shift = Shift.objects.filter(field_staff=field_staff[2], status=ShiftStatus.SCHEDULED, start_time__gt=now).order_by("start_time").first()
        if declined_shift:
            ShiftChangeRequest.objects.create(
                shift=declined_shift, requested_by=field_staff[2], manager=field_staff[2].manager,
                reason="Would like a different day entirely.",
                status=ChangeRequestStatus.DECLINED, decided_by=field_staff[2].manager, decided_at=now - timedelta(days=1),
                decision_note="Coverage is tight that week, please keep the original time.",
            )

        # ---------------- Emergencies ----------------
        # Every single client gets at least one emergency on record, so
        # whichever demo client account you sign in as, there is always
        # something to see. About a third of clients get a second one too,
        # giving customer service a realistic backlog to triage.
        emergency_count = 0
        for ci, client in enumerate(clients):
            description = EMERGENCY_DESCRIPTIONS[ci % len(EMERGENCY_DESCRIPTIONS)]
            status = ["new", "acknowledged", "resolved"][ci % 3]
            if ci % 2 == 0:
                EmergencyRequest.objects.create(client=client, source="client", description=description, status=status)
            else:
                staff = field_staff[ci % len(field_staff)]
                EmergencyRequest.objects.create(reporter=staff, client=client, source="staff", description=description, status=status)
            emergency_count += 1

            if ci % 3 == 0:
                second_description = EMERGENCY_DESCRIPTIONS[(ci + 7) % len(EMERGENCY_DESCRIPTIONS)]
                second_staff = field_staff[(ci + 5) % len(field_staff)]
                EmergencyRequest.objects.create(reporter=second_staff, client=client, source="staff", description=second_description, status="new")
                emergency_count += 1

        # ---------------- Resources and news ----------------
        # update_or_create, not get_or_create: resources and news posts are
        # not wiped at the top of this command like everything else, so a
        # rerun after editing RESOURCES above (an audience change, for
        # example) needs to actually apply, not silently keep whatever was
        # created the first time this command ever ran.
        for title, category, summary, content, audience in RESOURCES:
            Resource.objects.update_or_create(
                title=title,
                defaults={"category": category, "summary": summary, "content": content, "audience": audience},
            )

        NewsPost.objects.get_or_create(
            title="Welcome to CareLink",
            defaults={"body": "Thanks for trying the CareLink demo. Explore each role with the demo accounts in the README.", "audience": []},
        )
        NewsPost.objects.get_or_create(
            title="Flu season protocol reminder",
            defaults={"body": "Masks are required on all client visits through the end of flu season. Report any symptoms before your first shift of the day.", "audience": ["field_staff", "manager", "customer_service"]},
        )
        NewsPost.objects.get_or_create(
            title="New change request workflow",
            defaults={"body": "Manager approvals no longer change a shift's time automatically. Customer service applies the new time from the Change requests screen once a request is approved.", "audience": ["customer_service", "manager", "admin"]},
        )

        # ---------------- Starter conversations ----------------
        # Note: hospital_partners[0] already has a conversation with a CS
        # agent (below), so that account tests the "reuse an existing
        # thread" path of the support Connect with an agent button. The
        # other five hospital partner accounts have none yet, so they test
        # the "pick a random agent" path instead.
        def seed_conversation(a, b, lines):
            conversation = Conversation.objects.create(created_by=a)
            ConversationParticipant.objects.create(conversation=conversation, user=a)
            ConversationParticipant.objects.create(conversation=conversation, user=b)
            for sender, body in lines:
                Message.objects.create(conversation=conversation, sender=sender, body=body)

        cs1 = customer_service[0]
        fs1 = field_staff[0]
        client1 = clients[0]
        seed_conversation(cs1, fs1, [
            (cs1, f"Hi {fs1.full_name.split(',')[0]}, can you confirm tomorrow's visit with {client1.full_name}?"),
            (fs1, "Confirmed, I will be there."),
        ])
        seed_conversation(client1, fs1, [
            (client1, "Could you pick up my prescription on the way tomorrow?"),
            (fs1, "Of course, I will grab it before I arrive."),
        ])
        seed_conversation(customer_service[1], hospital_partners[0], [
            (hospital_partners[0], "Following up on the Eleanor Ashworth referral, any update?"),
            (customer_service[1], "Reviewing now, will confirm staffing by end of day."),
        ])
        seed_conversation(field_staff[3], field_staff[3].manager, [
            (field_staff[3], "Quick question about my availability next week."),
            (field_staff[3].manager, "Sure, let's chat after your shift today."),
        ])

        managers_with_programs = sum(1 for m in managers if m.programs.exists())
        self.stdout.write(self.style.SUCCESS(
            f"Done. {len(managers)} managers ({managers_with_programs} with a program and a team assigned, "
            f"demo.mgr08 intentionally has neither), {len(field_staff)} field staff, {len(customer_service)} customer service, "
            f"{len(hospital_partners)} hospital partners, {len(clients)} clients, {len(family_users)} family members, "
            f"{len(programs)} programs, {shift_count} shifts, {emergency_count} emergencies "
            f"(every client has at least one). All demo accounts use the password: {DEMO_PASSWORD}"
        ))