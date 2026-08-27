"""
Seed a large, realistic demo dataset: 1 admin, 8 managers, 30 field staff,
15 customer service agents, 6 hospital partners across 4 hospitals, 40
clients, 52 family members, 18 programs, hundreds of shifts spanning past,
today, and future (every client gets 12 shifts from yesterday through two
weeks out, plus 3 older ones, plus a handful timed close to right now for
testing clock in and the geofence), a spread of referrals, an emergency for
every single client, shift change requests in every state, a 65 item
resource library spanning chronic conditions, safety, emergencies, family
support, wellness, staff policy, and client rights, news posts, and a few
starter conversations.

Run with:  python manage.py seed_demo
Safe to rerun, it wipes and recreates demo data each time (except resources
and news posts, which use update_or_create so hand edits in the admin
panel are not wiped, only refreshed if you also edit RESOURCES below).
Uses a fixed random seed so the same command always produces the same
dataset.

If GEMINI_API_KEY is set when you run this, each resource gets embedded
automatically as it's saved (see integrations/signals.py), so the AI
agent's resource search works immediately. If you add the key after
already seeding, run `python manage.py backfill_resource_embeddings` once
to catch up the resources that were saved before the key existed.
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

    # ---- Chronic Conditions ----
    ("Diabetes care basics", "Chronic Conditions", "Watching blood sugar and preventing complications.",
     "Check blood sugar at the times your doctor recommends and log every reading. Watch for shakiness, confusion, or sweating, signs of low blood sugar. Keep a fast acting sugar source on hand. Rotate injection sites to avoid skin damage.",
     []),
    ("Managing high blood pressure at home", "Chronic Conditions", "Simple daily habits that help control blood pressure.",
     "Take blood pressure medication at the same time every day. Limit added salt in cooking. Track readings in a log to share at appointments. Report any reading over 180/120 to a doctor right away.",
     []),
    ("Living well with COPD", "Chronic Conditions", "Breathing easier day to day.",
     "Pace activities and rest before you feel out of breath, not after. Use pursed lip breathing during exertion: in through the nose, out slowly through pursed lips. Keep rescue inhalers within reach at all times. Avoid smoke, dust, and strong fumes.",
     []),
    ("Parkinson's disease, day to day tips", "Chronic Conditions", "Supporting movement, balance, and routine.",
     "Give extra time for tasks rather than rushing. Clear walkways of clutter and loose rugs to reduce freezing episodes. Medication timing matters a great deal, keep doses on schedule even on hard days. Encourage large, deliberate movements when walking.",
     []),
    ("Arthritis pain management without medication", "Chronic Conditions", "Non-drug ways to ease joint pain.",
     "Warm showers or heating pads loosen stiff joints before activity. Gentle range of motion movement most days helps more than rest. Ice can calm a flare after activity. Supportive, well fitted shoes reduce strain on hips and knees.",
     []),
    ("Congestive heart failure, watching for fluid buildup", "Chronic Conditions", "Early signs that need attention.",
     "Weigh the client at the same time each morning; a gain of 3 or more pounds in a day, or 5 in a week, needs a call to the doctor. Watch for swollen ankles, shortness of breath when lying flat, or sudden fatigue. Keep salt intake low as instructed.",
     []),

    # ---- Health ----
    ("Recognizing dehydration in older adults", "Health", "Seniors often don't feel thirsty even when dehydrated.",
     "Watch for dark urine, dry mouth, confusion, or dizziness. Offer small sips of water throughout the day rather than large amounts at once. Water rich foods like watermelon and cucumber can help too.",
     []),
    ("Recognizing a urinary tract infection in seniors", "Health", "UTIs often look like confusion, not pain, in older adults.",
     "Sudden confusion, agitation, or a fall can be the first sign of a UTI in an older adult, sometimes before any burning or urgency. Cloudy or strong smelling urine is another clue. Report new confusion promptly rather than assuming it's just a bad day.",
     []),
    ("Recognizing sepsis early", "Health", "A medical emergency that can look like the flu at first.",
     "Watch for a combination of fever or feeling unusually cold, a fast heart rate, confusion, and extreme discomfort, especially after a recent infection, wound, or hospital stay. Sepsis can worsen quickly. If suspected, treat it as an emergency and get medical help right away.",
     []),
    ("Managing constipation safely", "Health", "A common but often overlooked issue in home care.",
     "Encourage fluids and fiber rich foods if the diet allows them. Gentle movement, even short walks, helps. Track how many days it has been, and mention it at the next appointment rather than reaching for a laxative without guidance.",
     []),
    ("Denture care basics", "Health", "Keeping dentures clean and comfortable.",
     "Rinse dentures after every meal and brush them daily with a denture brush, not regular toothpaste, which can be too abrasive. Store them in water or a denture solution overnight, never wrapped in a napkin where they can be lost. Report any sore spots to a dentist.",
     []),
    ("Hearing aid care and communication tips", "Health", "Getting the most out of hearing aids.",
     "Clean the earpiece daily with a soft dry cloth and remove aids before showering. Change batteries at the first sign of weak or crackling sound. When speaking with someone who is hard of hearing, face them, speak clearly, and avoid shouting, it distorts speech more than it helps.",
     []),
    ("Vision loss, communication and home setup tips", "Health", "Making a home easier to navigate safely.",
     "Keep furniture and walkways in consistent places, don't rearrange without warning. Use contrasting colors for edges of steps and thresholds. When entering a room, announce yourself by name rather than assuming you're recognized by footsteps alone.",
     []),
    ("Safe medication disposal", "Health", "Getting rid of old or unused medication properly.",
     "Do not flush most medications or throw them in the trash where they can be found. Many pharmacies offer a take back program or a secure drop box. If neither is available, mix pills with something undesirable like used coffee grounds before sealing and discarding.",
     []),
    ("Common medication side effects to watch for", "Health", "What warrants a call to the doctor versus watchful waiting.",
     "Mild drowsiness or a dry mouth in the first few days of a new medication is common. New confusion, a rash, swelling, trouble breathing, or unusual bleeding is not, call the prescribing doctor. Keep an updated medication list handy for exactly this kind of question.",
     []),
    ("Choking response for caregivers", "Emergency", "What to do in the first moments.",
     "Encourage coughing if the person can still cough or speak, that's usually the most effective clearing. If they cannot breathe, speak, or cough, call 911 and begin abdominal thrusts if you are trained to. Never leave the person alone while this is happening, send someone else to call.",
     []),

    # ---- Safety ----
    ("Home fire safety and evacuation planning", "Safety", "Planning ahead matters most for clients with limited mobility.",
     "Test smoke detectors monthly and replace batteries yearly. Plan two ways out of every room and know which one works for a client using a walker or wheelchair. Keep a phone within reach at night. Practice the plan, don't just write it down.",
     []),
    ("Carbon monoxide detector placement", "Safety", "An invisible risk worth planning for.",
     "Install a carbon monoxide detector on every level of the home, especially near sleeping areas. Test it monthly along with smoke detectors. Symptoms of exposure, headache, dizziness, nausea, can be mistaken for illness, so a working detector matters more than instinct here.",
     []),
    ("Winter safety for seniors at home", "Safety", "Reducing cold weather risks.",
     "Keep indoor temperatures at 68 degrees or warmer; older bodies regulate temperature less efficiently. Salt or sand icy walkways before they're needed, not after a fall. Check that heating equipment is inspected and working before the season starts.",
     []),
    ("Heat safety in summer for older adults", "Safety", "Older adults are more vulnerable to heat related illness.",
     "Encourage fluids throughout hot days, don't wait for thirst. Keep the home cool, or plan visits to an air conditioned space during heat waves. Watch for heavy sweating, weakness, or confusion, signs of heat exhaustion that need immediate cooling and fluids.",
     []),
    ("Bed rail safety", "Safety", "A tool that helps some clients and creates risk for others.",
     "Bed rails can prevent rolling out of bed, but a confused client may try to climb over them, which is more dangerous than no rail at all. Check the fit, gaps large enough to trap a limb are a hazard. When in doubt, ask the care team whether rails are appropriate for this client.",
     []),
    ("Wheelchair safety checks", "Safety", "A quick routine that prevents accidents.",
     "Check that brakes hold firmly before every transfer. Look at tire pressure and tread if the chair is not power assisted. Make sure footrests are positioned correctly, not dragging or catching on the floor. Report any unusual sounds or resistance right away.",
     []),
    ("Safe transfer techniques using a gait belt", "Safety", "Protecting both the client and the caregiver during a transfer.",
     "Apply the gait belt snugly around the waist, over clothing, never bare skin. Bend your knees, not your back, and keep the client close to your body during the move. Count together out loud before moving, so the transfer is coordinated, not sudden.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Preventing wandering in dementia clients", "Safety", "Reducing the risk of a client leaving unsupervised.",
     "Door alarms or chimes alert caregivers when an exterior door opens. Keep a recent photo on hand in case a report to authorities is ever needed. Identify wandering triggers, often restlessness in the late afternoon, and redirect with an activity before it escalates.",
     []),

    # ---- Emergency ----
    ("Signs of a heart attack", "Emergency", "Recognizing symptoms that need 911, not a wait and see approach.",
     "Chest pain or pressure, pain spreading to the arm, jaw, or back, shortness of breath, cold sweat, or nausea. Symptoms in women can be subtler, fatigue or discomfort rather than classic chest pain. Call 911 immediately rather than driving to the hospital yourself.",
     []),
    ("Signs of a diabetic emergency", "Emergency", "Telling low and high blood sugar apart in a hurry.",
     "Low blood sugar comes on fast: shakiness, confusion, sweating, sometimes fainting, give a fast acting sugar source immediately if the person is conscious and able to swallow. High blood sugar builds more slowly: extreme thirst, frequent urination, fruity smelling breath. Either extreme, if severe or the person is unresponsive, needs 911.",
     []),
    ("What to do during a power outage with medical equipment", "Emergency", "Keeping equipment running when the power goes out.",
     "Know how long your backup battery lasts for any oxygen concentrator, ventilator, or other powered equipment, and have a manual backup plan. Register vulnerable clients with the utility company's medical priority program if one exists in your area. Have a plan for where to go if the outage extends past the equipment's battery life.",
     []),
    ("Fall response, when to call 911 versus assess first", "Emergency", "Not every fall needs an ambulance, but some do.",
     "Call 911 immediately for a head injury, visible deformity, inability to move a limb, or loss of consciousness. For a fall without those signs, help the person stay still, check for pain, and assist them up slowly only if they feel able. When in doubt, it's always safer to call.",
     []),
    ("Recognizing anaphylaxis (severe allergic reaction)", "Emergency", "A fast moving emergency that needs immediate action.",
     "Swelling of the face, lips, or throat, difficulty breathing, hives, or a sudden drop in alertness after a new food, medication, or insect sting. Use an epinephrine auto-injector immediately if one is prescribed and available, then call 911, even if symptoms seem to improve after the injection.",
     []),

    # ---- Family Support ----
    ("Talking to a loved one about needing more help", "Family Support", "Starting a hard conversation with care.",
     "Choose a calm moment, not right after a crisis. Focus on specific, recent examples rather than generalizations. Ask what they're worried about, and listen before proposing solutions. Frame extra help as protecting their independence longer, not taking it away.",
     ["client", "family"]),
    ("Grief support resources", "Family Support", "You don't have to navigate loss alone.",
     "Grief has no fixed timeline or correct way to feel it. Local hospice organizations often offer free grief counseling even if hospice wasn't previously involved. Support groups, in person or online, connect you with others who understand. Ask your care team for a referral if you'd like one.",
     ["client", "family"]),
    ("Understanding respite care", "Family Support", "Short term relief for family caregivers.",
     "Respite care provides temporary coverage, a few hours, a day, or even a longer stay, so a family caregiver can rest, travel, or handle other responsibilities. It is not a sign of giving up, it's a tool that helps caregiving stay sustainable. Ask CareLink about arranging a respite stay.",
     ["client", "family"]),
    ("Sundowning, understanding evening confusion", "Family Support", "Why symptoms often worsen late in the day.",
     "Many people with dementia become more confused, anxious, or agitated in the late afternoon and evening, a pattern called sundowning. Keeping evenings calm, well lit, and predictable can help. Avoid scheduling demanding tasks or unfamiliar visitors during this window if possible.",
     []),
    ("Non-verbal pain cues in clients with dementia", "Family Support", "Recognizing pain when someone can't describe it.",
     "Grimacing, guarding a body part, restlessness, or a sudden change in behavior can all signal pain in someone who can't clearly say so. A usually calm client becoming agitated is worth investigating, not just managing. Report any noticeable behavior change to the care team.",
     []),
    ("Supporting a client through hospital discharge", "Family Support", "The transition home is a high risk time.",
     "Confirm the full discharge paperwork, including new medications and any that were stopped, before leaving the hospital. Schedule the follow up appointment before you leave if possible. Watch closely for the first 72 hours at home, many complications show up in that window.",
     ["client", "family"]),
    ("Financial assistance programs for home care", "Family Support", "An overview of where to start looking.",
     "Options vary by region and situation: veterans benefits, long term care insurance, Medicaid waiver programs, and local Area Agency on Aging grants are common starting points. A hospital social worker or your CareLink customer service contact can often point you toward what applies to your situation.",
     ["client", "family"]),

    # ---- Wellness ----
    ("Gentle chair exercises for seniors", "Wellness", "Movement that works for limited mobility.",
     "Seated marches, ankle circles, and arm raises can be done safely from a sturdy chair. Aim for a few minutes, several times a day, rather than one long session. Stop any movement that causes pain, and check with a doctor before starting a new routine after a recent illness or surgery.",
     ["client", "family"]),
    ("Staying socially connected as a caregiver", "Wellness", "Isolation creeps in quietly, notice it early.",
     "Caregiving can crowd out the relationships that keep you steady. Schedule even short, regular check-ins with a friend, they don't need to be long to matter. Caregiver support groups, in person or online, connect you with people who understand the specific weight of this role.",
     ["client", "family"]),
    ("Sleep hygiene tips for older adults", "Wellness", "Better rest starts earlier in the day.",
     "Keep a consistent wake time, even on hard nights. Get natural light exposure earlier in the day to support the body's clock. Limit caffeine after noon and naps to under 30 minutes. A cool, dark, quiet room supports deeper sleep.",
     []),
    ("Managing caregiver stress day to day", "Wellness", "Small habits that add up over a long stretch.",
     "Notice your own warning signs early: irritability, exhaustion, skipped meals. Protect small pockets of time for yourself without guilt, even 10 minutes counts. Ask for and accept help when it's offered rather than waiting until you're overwhelmed. See Caregiver burnout warning signs above for when to seek more support.",
     ["client", "family"]),
    ("Building a simple daily routine for dementia clients", "Wellness", "Predictability reduces anxiety.",
     "Keep wake, meal, and bed times consistent day to day. Introduce one activity at a time rather than a long list of options, which can overwhelm. Familiar music, photos, or a favorite chair can anchor a routine and make transitions between activities easier.",
     []),
    ("Staying hydrated, a simple daily habit", "Wellness", "A small habit with an outsized effect on wellbeing.",
     "Keep a filled water cup within easy reach throughout the day rather than relying on remembering to get up for one. Herbal tea, broth, and water rich fruits all count toward daily fluid intake. Mild dehydration alone can cause confusion, fatigue, and headaches that are easy to mistake for something else.",
     []),

    # ---- Company Policy (staff facing) ----
    ("Staff punctuality and clock-in policy explained", "Company Policy", "How the clock-in window and location check work.",
     "You can clock in starting 15 minutes before a shift's scheduled start, checked against your phone's location and the client's saved address. Clocking in from farther than 100 meters requires a typed reason, which is logged and sent to your manager, it is not blocked outright. Clock out only opens in the final 7 minutes before the shift ends, with no exceptions.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Staff dress code and identification", "Company Policy", "What to wear and carry on a visit.",
     "Wear your CareLink identification badge visibly on every visit, clients and families are encouraged to ask to see it. Closed toe shoes are required for safety during transfers and lifts. Follow your program's specific uniform or scrub color guidance if one applies.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Staff mileage reimbursement policy", "Company Policy", "How travel between visits is compensated.",
     "Mileage between scheduled visits is reimbursable at the current standard rate; commuting from home to your first visit of the day is not. Log mileage the same day it's driven, not retroactively at the end of the pay period. Submit through the mileage form linked from your dashboard.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Reporting an incident, what staff need to document", "Company Policy", "Getting the details right the first time.",
     "Document what happened, when, who was present, and any immediate action taken, as soon as possible after the incident while details are fresh. Stick to observed facts rather than assumptions about cause. Notify your manager the same day for anything beyond a minor issue, and log clinical details in Clinical documentation.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Client confidentiality and HIPAA basics for staff", "Company Policy", "Protecting client information in daily work.",
     "Only discuss a client's health information with people directly involved in their care, never with family unless the client has authorized it. Never post about a client, even without a name, on personal social media. Keep any paper notes secured and shred them once transferred to the system.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Bloodborne pathogens, universal precautions", "Company Policy", "Standard precautions for every visit, every client.",
     "Treat all blood and certain body fluids as potentially infectious, regardless of what you know about a client's health history. Wear gloves for any contact with blood, open wounds, or bodily fluids. Wash hands thoroughly before and after every visit, even when gloves were worn throughout.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Safe lifting technique for caregivers", "Company Policy", "Protecting your own back while assisting a client.",
     "Bend at the knees and hips, not the waist, keeping your back straight. Keep the client's weight as close to your body as possible during a lift or transfer. Never twist while lifting, move your feet instead. If a lift feels unsafe alone, it's always appropriate to ask for a two person assist.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Staff professional boundaries policy", "Company Policy", "Keeping the caregiver relationship appropriate and sustainable.",
     "Do not accept gifts of significant value, loans, or inheritance offers from clients or their families. Keep personal social media and phone number exchanges with clients within your organization's guidance. Report any relationship that starts to feel like it's crossing a line to your manager, before it becomes a bigger problem.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Client's right to refuse care", "Client Rights", "Every client can decline a service, even one that's scheduled.",
     "A client with decision making capacity can refuse any part of their care at any time, even mid-visit. Document the refusal and the reason given, if any, and notify customer service, don't argue or pressure. A pattern of repeated refusals is worth discussing with the care team, a single refusal is simply the client's right.",
     ["admin", "manager", "customer_service", "field_staff"]),
    ("Culturally responsive care basics", "Client Rights", "Respecting differences in how families approach care.",
     "Ask rather than assume about dietary practices, modesty preferences, and family decision making roles, they vary widely even within the same background. Use a professional interpreter for medical conversations rather than a family member when language support is needed. Small, genuine questions about what matters to a client go a long way.",
     []),

    # ---- Documentation & Rights ----
    ("Advance directives and DNR orders, the basics", "Client Rights", "Understanding a client's documented care wishes.",
     "An advance directive states a person's wishes for care if they can't speak for themselves. A DNR (do not resuscitate) order specifically addresses CPR. These documents should be easy to find in an emergency, ask the care team where a client's are kept, and always follow them.",
     []),
    ("Power of attorney, what it means for care decisions", "Client Rights", "Understanding who can make decisions and when.",
     "A power of attorney for health care lets a named person make medical decisions if the client becomes unable to. It typically only takes effect under specific conditions defined in the document, it doesn't override a client's own wishes while they're still able to express them. When in doubt about who has authority, ask customer service to check the file.",
     ["client", "family"]),
    ("Elder financial abuse, warning signs", "Client Rights", "Recognizing exploitation early.",
     "Watch for sudden changes to a will or financial accounts, unfamiliar new 'friends' with access to finances, missing valuables, or a client seeming afraid of a specific person. Isolation from other family members is a common warning sign too. If you suspect abuse, report it, most regions have an elder abuse hotline or adult protective services line.",
     []),
    ("Client dignity and privacy during personal care", "Client Rights", "Small habits that preserve dignity in intimate moments.",
     "Knock and announce yourself before entering, even in the client's own bedroom or bathroom. Keep the client covered as much as possible during bathing or dressing, exposing only what's necessary at each step. Narrate what you're about to do before doing it, surprise is its own kind of indignity.",
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