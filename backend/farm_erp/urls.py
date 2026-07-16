from django.contrib import admin
from django.urls import include, path

api_v1 = [
    path("auth/", include("accounts.urls")),
    path("", include("customers.urls")),
    path("", include("products.urls")),
    path("", include("sales.urls")),
    path("", include("stock.urls")),
    path("", include("expenses.urls")),
    path("", include("orders.urls")),
    path("reports/", include("reports.urls")),
    path("public/", include("orders.public_urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include((api_v1, "api"))),
]
