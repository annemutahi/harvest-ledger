from django.contrib import admin

from .models import CasualWage, CasualWorker, Purchase, Supplier

admin.site.register(Supplier)
admin.site.register(Purchase)
admin.site.register(CasualWorker)
admin.site.register(CasualWage)
