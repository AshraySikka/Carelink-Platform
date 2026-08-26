// Predefined reasons for shift change/cancellation requests. Keep in sync
// with ChangeReasonCode in backend/care/models.py.
export const REASON_OPTIONS = [
  { code: "illness", label: "I'm sick and can't safely provide care" },
  { code: "transportation", label: "Transportation problem (car trouble, no ride, etc.)" },
  { code: "personal_emergency", label: "Personal emergency" },
  { code: "family_emergency", label: "Family emergency" },
  { code: "scheduling_conflict", label: "Double booked or scheduling conflict" },
  { code: "weather", label: "Weather or unsafe travel conditions" },
  { code: "client_no_longer_needs_visit", label: "Client no longer needs this visit" },
  { code: "client_safety_concern", label: "Safety concern at the client's location" },
  { code: "client_medical_emergency", label: "Client is having a medical emergency right now" },
  { code: "other", label: "Other" },
];

// Picking one of these should never submit a normal change request. It
// needs customer service alerted immediately, not a queued approval.
export const BLOCKED_REASON_CODES = new Set(["client_safety_concern", "client_medical_emergency"]);
