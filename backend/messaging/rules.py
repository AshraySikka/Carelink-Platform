"""
The messaging permission matrix, in one place.

Allowed pairs:
  customer service  <-> everyone (customer service is the platform's
                        universal contact point, so this pair is checked
                        first and short circuits everything below)
  client            <-> field staff they have EVER shared a shift with
  admin             <-> hospital partner (the "chat with hospital" button)
  manager           <-> their own direct reports (field staff)
"""
from accounts.models import Roles, User
from care.models import Shift


def can_message(a: User, b: User) -> bool:
    if a.id == b.id:
        return False

    if Roles.CUSTOMER_SERVICE in (a.role, b.role):
        return True

    pair = {a.role, b.role}

    if pair == {Roles.CLIENT, Roles.FIELD_STAFF}:
        client, staff = (a, b) if a.role == Roles.CLIENT else (b, a)
        # Ever shared a shift, past or future, per the product decision.
        return Shift.objects.filter(client=client, field_staff=staff).exists()

    if pair == {Roles.HOSPITAL_PARTNER, Roles.ADMIN}:
        # Lets admins use "Chat with hospital" from the referral drawer,
        # same as customer service already could.
        return True

    if pair == {Roles.MANAGER, Roles.FIELD_STAFF}:
        manager, staff = (a, b) if a.role == Roles.MANAGER else (b, a)
        return staff.manager_id == manager.id

    return False


def eligible_contacts(user: User):
    """Everyone the user is allowed to start a conversation with.
    This is what the new chat picker searches through."""
    role = user.role
    if role == Roles.CLIENT:
        staff_ids = Shift.objects.filter(client=user).values_list("field_staff_id", flat=True).distinct()
        return User.objects.filter(id__in=staff_ids)
    if role == Roles.FIELD_STAFF:
        client_ids = Shift.objects.filter(field_staff=user).values_list("client_id", flat=True).distinct()
        base = User.objects.filter(id__in=client_ids) | User.objects.filter(role=Roles.CUSTOMER_SERVICE)
        if user.manager_id:
            base = base | User.objects.filter(id=user.manager_id)
        return base.distinct()
    if role == Roles.CUSTOMER_SERVICE:
        # Customer service can start a conversation with anyone on the platform.
        return User.objects.exclude(id=user.id)
    if role == Roles.ADMIN:
        return User.objects.filter(role__in=[Roles.CUSTOMER_SERVICE, Roles.HOSPITAL_PARTNER])
    if role == Roles.HOSPITAL_PARTNER:
        return User.objects.filter(role__in=[Roles.CUSTOMER_SERVICE, Roles.ADMIN])
    if role == Roles.MANAGER:
        return (User.objects.filter(manager=user) | User.objects.filter(role=Roles.CUSTOMER_SERVICE)).distinct()
    return User.objects.none()