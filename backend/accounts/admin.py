from django.contrib import admin

from .models import Hospital, PasswordResetOTP, User

admin.site.register(User)
admin.site.register(Hospital)
admin.site.register(PasswordResetOTP)