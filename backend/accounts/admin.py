from django.contrib import admin

from .models import Hospital, User

admin.site.register(User)
admin.site.register(Hospital)
