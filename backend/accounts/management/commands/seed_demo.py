"""
Seed the database with a full demo roster: two hospitals, two managers, five
field staff with availability schedules, five clients, rich referrals with
clinical intake, a month of shifts, emergencies, resources, news, and a few
starter conversations.

Run with:  python manage.py seed_demo
Safe to rerun, it wipes and recreates demo data each time.
"""
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Hospital, InviteStatus, Roles, User
from care.models import (
    EmergencyRequest, FamilyMember, NewsPost, Program, Referral, Resource, Shift,
)
from messaging.models import Conversation, ConversationParticipant, Message
from notifications.utils import ensure_default_preferences

DEMO_PASSWORD = "CareLinkDemo!2026"

# email, full name, role, phone, date of birth
USERS = [
    ("admin@carelink.demo", "CareLink Admin", Roles.ADMIN, "555-0100", None),
    ("manager1@carelink.demo", "Dana Whitfield", Roles.MANAGER, "555-0200", date(1979, 6, 12)),
    ("manager2@carelink.demo", "Victor Osei", Roles.MANAGER, "555-0201", date(1984, 11, 3)),
    ("demo.hp1@yopmail.com", "Dr. Priya Patel", Roles.HOSPITAL_PARTNER, "555-0400", None),
    ("demo.hp2@yopmail.com", "Marcus Chen, RN", Roles.HOSPITAL_PARTNER, "555-0401", None),
    ("demo.hp3@yopmail.com", "Dr. Amara Boateng", Roles.HOSPITAL_PARTNER, "555-0402", None),
    ("demo.cs1@yopmail.com", "Jordan Blake", Roles.CUSTOMER_SERVICE, "555-0500", None),
    ("demo.cs2@yopmail.com", "Samira Okafor", Roles.CUSTOMER_SERVICE, "555-0501", None),
    ("demo.fs1@yopmail.com", "Nia Thompson, CNA", Roles.FIELD_STAFF, "555-0300", date(1992, 3, 14)),
    ("demo.fs2@yopmail.com", "Diego Alvarez, CNA", Roles.FIELD_STAFF, "555-0301", date(1981, 2, 20)),
    ("demo.fs3@yopmail.com", "Elena Rossi, HHA", Roles.FIELD_STAFF, "555-0302", date(1995, 9, 8)),
    ("demo.fs4@yopmail.com", "Priya Nair, PSW", Roles.FIELD_STAFF, "555-0303", date(1990, 7, 22)),
    ("demo.fs5@yopmail.com", "Sam Carter, HHA", Roles.FIELD_STAFF, "555-0304", date(1987, 12, 1)),
    ("demo.client1@yopmail.com", "Margaret O'Sullivan", Roles.CLIENT, "555-0600", date(1946, 4, 2)),
    ("demo.client2@yopmail.com", "Robert Kim", Roles.CLIENT, "555-0601", date(1951, 8, 19)),
    ("demo.client3@yopmail.com", "Beatrice Johnson", Roles.CLIENT, "555-0602", date(1939, 1, 27)),
    ("demo.client4@yopmail.com", "Dolores Whitfield", Roles.CLIENT, "555-0603", date(1944, 10, 5)),
    ("demo.client5@yopmail.com", "Ahmed Hassan", Roles.CLIENT, "555-0604", date(1957, 5, 30)),
    ("demo.family1@yopmail.com", "Kate O'Sullivan", Roles.FAMILY, "555-0700", None),
]

PROGRAMS = ["Palliative Care", "Post Surgical Recovery", "Dementia Support", "Pediatric Home Care"]

# weekday availability, notes
STAFF_AVAILABILITY = {
    "demo.fs1@yopmail.com": (
        {"mon": "09:00-17:00", "tue": "09:00-17:00", "wed": "09:00-17:00", "thu": "09:00-17:00", "fri": "09:00-15:00", "sat": None, "sun": None},
        "Weekdays only, no evenings.",
    ),
    "demo.fs2@yopmail.com": (
        {"mon": "08:00-16:00", "tue": "08:00-16:00", "wed": "08:00-16:00", "thu": "08:00-16:00", "fri": "08:00-14:00", "sat": None, "sun": None},
        "Prefers morning shifts, can pick up extra on short notice.",
    ),
    "demo.fs3@yopmail.com": (
        {"mon": None, "tue": "12:00-20:00", "wed": "12:00-20:00", "thu": "12:00-20:00", "fri": "12:00-20:00", "sat": "10:00-16:00", "sun": None},
        "Afternoons and Saturdays.",
    ),
    "demo.fs4@yopmail.com": (
        {"mon": "07:00-15:00", "tue": "07:00-15:00", "wed": None, "thu": "07:00-15:00", "fri": "07:00-15:00", "sat": None, "sun": "09:00-13:00"},
        "Early starts preferred, Wednesdays off.",
    ),
    "demo.fs5@yopmail.com": (
        {"mon": "10:00-18:00", "tue": "10:00-18:00", "wed": "10:00-18:00", "thu": None, "fri": "10:00-18:00", "sat": "10:00-14:00", "sun": None},
        "Flexible on weekends with notice.",
    ),
}

CLIENT_ADDRESSES = {
    "demo.client1@yopmail.com": ("101 Maple Ave, Riverside", 43.660, -79.390),
    "demo.client2@yopmail.com": ("118 Birch St, Riverside", 43.668, -79.398),
    "demo.client3@yopmail.com": ("240 Cedar Rd, Riverside", 43.674, -79.381),
    "demo.client4@yopmail.com": ("57 Willow Cres, Riverside", 43.655, -79.402),
    "demo.client5@yopmail.com": ("310 Elm Dr, Riverside", 43.681, -79.410),
}

# client name, urgency, status, concerns, notes, details, intake, hospital index (0 or 1)
REFERRALS = [
    ("Eleanor Ashworth", "normal", "new", "", "Post hip replacement, daily mobility support for 2 weeks.",
     {"age": 71, "contact": "555-0110", "address": "14 Harborview Ln, Riverside", "emergency_contact": "Tom Ashworth, 555-0111"},
     {"diagnosis": "Hip replacement recovery", "insurance": "BlueShield PPO", "mobility": "Walker, needs standby assist", "cognition": "Alert and oriented", "living_situation": "Lives with spouse", "allergies": "Penicillin", "preferred_start": "Within 3 days", "weekly_hours": "20"}, 0),
    ("Frank DeLuca", "high", "new", "Fall risk, lives alone", "Discharged today after CHF exacerbation. Lives alone.",
     {"age": 63, "contact": "555-0111", "address": "101 Maple Ave, Riverside", "emergency_contact": ""},
     {"diagnosis": "Congestive heart failure", "insurance": "Medicare", "mobility": "Independent but unsteady", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "None known", "preferred_start": "Immediately", "weekly_hours": "30"}, 0),
    ("Gwen Halloran", "low", "accepted", "", "Companion visits, light housekeeping.",
     {"age": 68, "contact": "555-0112", "address": "22 Sunset Blvd, Riverside", "emergency_contact": "Mary Halloran, 555-0113"},
     {"diagnosis": "General frailty", "insurance": "Private pay", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives alone", "allergies": "Shellfish", "preferred_start": "Next week", "weekly_hours": "10"}, 0),
    ("Samuel Kirby", "emergency", "in_progress", "24/7 coverage required", "Just discharged from ICU, needs initial 24/7 coverage.",
     {"age": 74, "contact": "555-0113", "address": "9 Lakeshore Ct, Riverside", "emergency_contact": "Denise Kirby, 555-0114"},
     {"diagnosis": "Post ICU deconditioning", "insurance": "Medicare Advantage", "mobility": "Bed to chair with 2 person assist", "cognition": "Intermittent confusion", "living_situation": "Lives with daughter", "allergies": "Sulfa drugs", "preferred_start": "Today", "weekly_hours": "84"}, 1),
    ("Nadia Petrov", "normal", "completed", "", "Six week post op care completed successfully.",
     {"age": 66, "contact": "555-0114", "address": "77 Garden Way, Riverside", "emergency_contact": "Ivan Petrov, 555-0115"},
     {"diagnosis": "Knee replacement recovery", "insurance": "BlueShield HMO", "mobility": "Cane", "cognition": "Alert", "living_situation": "Lives with spouse", "allergies": "Latex", "preferred_start": "Completed", "weekly_hours": "15"}, 0),
    ("Harold Jensen", "high", "accepted", "Oxygen dependent", "COPD, oxygen dependent, needs medication management support.",
     {"age": 79, "contact": "555-0115", "address": "5 Prairie Ave, Riverside", "emergency_contact": "Lise Jensen, 555-0116"},
     {"diagnosis": "COPD stage 3", "insurance": "Medicare", "mobility": "Short distances with rollator", "cognition": "Alert", "living_situation": "Lives alone, daughter nearby", "allergies": "None known", "preferred_start": "Within a week", "weekly_hours": "25"}, 1),
    ("Rosa Delgado", "normal", "in_progress", "", "Dementia support, structured daily routine and meal preparation.",
     {"age": 82, "contact": "555-0116", "address": "88 Chestnut St, Riverside", "emergency_contact": "Carlos Delgado, 555-0117"},
     {"diagnosis": "Alzheimer's, moderate stage", "insurance": "Medicaid", "mobility": "Independent, wanders", "cognition": "Moderate impairment", "living_situation": "Lives with son", "allergies": "Codeine", "preferred_start": "Started", "weekly_hours": "40"}, 1),
    ("Walter Briggs", "low", "on_hold", "Awaiting insurance authorization", "Weekly wellness checks pending insurance approval.",
     {"age": 70, "contact": "555-0117", "address": "63 Fern Hollow, Riverside", "emergency_contact": ""},
     {"diagnosis": "Type 2 diabetes", "insurance": "Pending authorization", "mobility": "Independent", "cognition": "Alert", "living_situation": "Lives with roommate", "allergies": "None known", "preferred_start": "On authorization", "weekly_hours": "6"}, 0),
    ("June Nakamura", "normal", "new", "", "Post stroke rehab support, speech therapy coordination.",
     {"age": 61, "contact": "555-0118", "address": "12 Riverbend Ter, Riverside", "emergency_contact": "Ken Nakamura, 555-0119"},
     {"diagnosis": "Ischemic stroke recovery", "insurance": "BlueShield PPO", "mobility": "Hemiparesis, walker", "cognition": "Mild aphasia", "living_situation": "Lives with spouse", "allergies": "Aspirin sensitivity", "preferred_start": "Within 5 days", "weekly_hours": "18"}, 1),
    ("Peter Kowalski", "high", "declined", "Out of service area", "Family requested service outside our coverage region.",
     {"age": 76, "contact": "555-0119", "address": "440 Northgate Rd, Lakeside", "emergency_contact": "Anna Kowalski, 555-0120"},
     {"diagnosis": "Parkinson's disease", "insurance": "Medicare", "mobility": "Freezing episodes", "cognition": "Alert", "living_situation": "Lives with spouse", "allergies": "None known", "preferred_start": "N/A", "weekly_hours": "20"}, 1),
]

# source, client email or None, reporter email or None, description
EMERGENCIES = [
    ("client", "demo.client1@yopmail.com", None, "Fell in the bathroom, feeling dizzy but no injury."),
    ("client", "demo.client2@yopmail.com", None, "Oxygen tank alarm went off overnight, need someone to check equipment."),
    ("staff", None, "demo.fs1@yopmail.com", "Client refusing medication; family unreachable."),
    ("staff", None, "demo.fs2@yopmail.com", "Elevated blood pressure reading; called triage."),
    ("client", "demo.client4@yopmail.com", None, "Chest pain, called 911, notifying CareLink."),
]

RESOURCES = [
    ("Preventing falls at home", "Safety", "Simple changes that reduce fall risk.",
     "Remove loose rugs and clear walkways. Install grab bars in bathrooms. Keep stairs well lit. Wear non slip footwear. Review medications that cause dizziness with your doctor."),
    ("Signs of a stroke, the FAST test", "Emergency", "Recognize a stroke in seconds.",
     "F: face drooping on one side. A: arm weakness. S: speech difficulty. T: time to call 911. Every minute matters, do not wait to see if symptoms pass."),
    ("Medication management basics", "Health", "Keeping track of medications safely.",
     "Keep an up to date list of all medications and doses. Use a weekly pill organizer. Set daily alarms. Never share medications. Bring your list to every appointment."),
    ("Caregiver burnout warning signs", "Family Support", "When to ask for help.",
     "Constant exhaustion, withdrawal from friends, feeling hopeless or resentful, frequent illness, sleep or appetite changes. Respite care exists for this, ask CareLink about relief options."),
    ("Home oxygen safety", "Safety", "Living safely with supplemental oxygen.",
     "Keep oxygen at least 3 meters from open flames. No smoking anywhere in the home. Secure tanks upright. Check tubing for kinks daily. Post a sign at the entrance for emergency responders."),
    ("Nutrition for healing", "Health", "Eating well during recovery.",
     "Prioritize protein at every meal to rebuild tissue. Stay hydrated, aim for 6 to 8 glasses of water daily unless fluid restricted. Small frequent meals beat large ones when appetite is low."),
    ("Understanding dementia behaviors", "Family Support", "Responding with patience and technique.",
     "Agitation often signals an unmet need: pain, hunger, or overstimulation. Keep routines consistent. Redirect rather than correct. Short answers, calm tone, one question at a time."),
]


class Command(BaseCommand):
    help = "Reset and seed demo data"

    def handle(self, *args, **options):
        self.stdout.write("Wiping demo data...")
        emails = [email for email, *_ in USERS]
        # Referral.submitted_by is a protected foreign key, so referrals
        # created by demo hospital partners must go first or the user
        # delete below raises ProtectedError.
        Referral.objects.filter(submitted_by__email__in=emails).delete()
        User.objects.filter(email__in=emails).delete()

        riverside, _ = Hospital.objects.get_or_create(name="Riverside Demo Hospital")
        lakeside, _ = Hospital.objects.get_or_create(name="Lakeside Medical Center")
        hospitals = [riverside, lakeside]

        programs = []
        for name in PROGRAMS:
            program, _ = Program.objects.get_or_create(name=name)
            programs.append(program)

        created = {}
        for index, (email, full_name, role, phone, dob) in enumerate(USERS):
            hospital = None
            if role == Roles.HOSPITAL_PARTNER:
                hospital = lakeside if email == "demo.hp3@yopmail.com" else riverside
            user = User.objects.create_user(
                email=email, password=DEMO_PASSWORD, full_name=full_name, role=role,
                invite_status=InviteStatus.ACTIVE, phone=phone or "", date_of_birth=dob,
                hospital=hospital,
            )
            ensure_default_preferences(user)
            created[email] = user

        dana = created["manager1@carelink.demo"]
        victor = created["manager2@carelink.demo"]
        staff_emails = ["demo.fs1@yopmail.com", "demo.fs2@yopmail.com", "demo.fs3@yopmail.com",
                        "demo.fs4@yopmail.com", "demo.fs5@yopmail.com"]
        field_staff = [created[e] for e in staff_emails]
        client_emails = ["demo.client1@yopmail.com", "demo.client2@yopmail.com", "demo.client3@yopmail.com",
                         "demo.client4@yopmail.com", "demo.client5@yopmail.com"]
        clients = [created[e] for e in client_emails]

        # Managers: Dana oversees the first three, Victor the last two.
        for index, staff in enumerate(field_staff):
            staff.manager = dana if index < 3 else victor
            schedule, notes = STAFF_AVAILABILITY[staff.email]
            staff.availability_schedule = schedule
            staff.availability_notes = notes
            staff.address = f"{200 + index * 5} Oak St, Riverside, CA"
            staff.latitude, staff.longitude = 43.65 + index * 0.008, -79.38 - index * 0.006
            staff.min_weekly_hours = 20 + index * 4
            staff.save()
            staff.programs.set([programs[index % len(programs)], programs[(index + 1) % len(programs)]])

        for client in clients:
            address, lat, lng = CLIENT_ADDRESSES[client.email]
            client.address = address
            client.latitude, client.longitude = lat, lng
            client.save()

        # Family link so demo.family1 can see Margaret's visits.
        FamilyMember.objects.get_or_create(
            client=clients[0], family_email="demo.family1@yopmail.com",
            defaults={"family_name": "Kate O'Sullivan", "family_user": created["demo.family1@yopmail.com"]},
        )

        # Referrals with full clinical intake, split between the two hospitals.
        submitters = [created["demo.hp1@yopmail.com"], created["demo.hp3@yopmail.com"]]
        for name, urgency, status, concerns, notes, details, intake, h_index in REFERRALS:
            Referral.objects.create(
                hospital=hospitals[h_index], submitted_by=submitters[h_index],
                client_name=name, urgency=urgency, status=status, notes=notes,
                concerns_flag=concerns, client_details=details, intake_data=intake,
            )

        # A month of shifts: three weeks back, one week ahead, across all
        # staff and clients so calendars, messaging eligibility, clock in,
        # and the schedule board all have real data.
        now = timezone.now()
        for i in range(40):
            day_offset = i - 30
            start = (now + timedelta(days=day_offset)).replace(hour=8 + (i % 5) * 2, minute=0, second=0, microsecond=0)
            client = clients[i % len(clients)]
            Shift.objects.create(
                field_staff=field_staff[i % len(field_staff)], client=client,
                start_time=start, end_time=start + timedelta(hours=3),
                location=client.address,
                status="completed" if start < now else "scheduled",
            )

        # Emergency requests matching the triage board.
        for source, client_email, reporter_email, description in EMERGENCIES:
            EmergencyRequest.objects.create(
                source=source,
                client=created[client_email] if client_email else None,
                reporter=created[reporter_email] if reporter_email else None,
                description=description,
            )

        for title, category, summary, content in RESOURCES:
            Resource.objects.get_or_create(title=title, defaults={"category": category, "summary": summary, "content": content})

        NewsPost.objects.get_or_create(
            title="Welcome to CareLink",
            defaults={"body": "Thanks for trying the CareLink demo. Explore each role with the demo accounts in the README.", "audience": []},
        )
        NewsPost.objects.get_or_create(
            title="Flu season protocol reminder",
            defaults={"body": "Masks are required on all client visits through the end of flu season. Report any symptoms before your first shift of the day.", "audience": ["field_staff", "manager", "customer_service"]},
        )

        # Starter conversations so messaging is not empty on first sign in.
        def seed_conversation(a, b, lines):
            conversation = Conversation.objects.create(created_by=a)
            ConversationParticipant.objects.create(conversation=conversation, user=a)
            ConversationParticipant.objects.create(conversation=conversation, user=b)
            for sender, body in lines:
                Message.objects.create(conversation=conversation, sender=sender, body=body)

        cs1 = created["demo.cs1@yopmail.com"]
        fs1 = created["demo.fs1@yopmail.com"]
        client1 = clients[0]
        seed_conversation(cs1, fs1, [
            (cs1, "Hi Nia, can you confirm tomorrow's 9am visit with Margaret?"),
            (fs1, "Confirmed, I will be there. Parking is easier on the side street."),
            (cs1, "Perfect, thank you!"),
        ])
        seed_conversation(client1, fs1, [
            (client1, "Nia, could you pick up my prescription on the way tomorrow?"),
            (fs1, "Of course, I will grab it from the pharmacy before I arrive."),
        ])

        self.stdout.write(self.style.SUCCESS(f"Done. All demo accounts use the password: {DEMO_PASSWORD}"))