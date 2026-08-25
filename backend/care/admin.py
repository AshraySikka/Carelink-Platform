from django.contrib import admin

from .models import (
    ClinicalDocument, EmergencyRequest, FamilyMember, NewsPost, Program,
    Referral, ReferralDocument, Resource, Shift, ShiftChangeRequest,
)

for model in [Program, Referral, ReferralDocument, Shift, ShiftChangeRequest,
              EmergencyRequest, FamilyMember, Resource, NewsPost, ClinicalDocument]:
    admin.site.register(model)
