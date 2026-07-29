from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Page-number pagination that lets clients widen the page size.

    Lookup screens (e.g. choosing an invoice to pay) need the full set of
    matching rows, not just the first page.
    """

    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 1000
