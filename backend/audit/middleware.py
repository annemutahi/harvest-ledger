"""Thread-local storage for the current authenticated user.

Lets model-level code (soft-delete, audit) know who made a request without
threading the user object through every function signature.
"""
from __future__ import annotations

import threading

_state = threading.local()


def get_current_user():
    return getattr(_state, "user", None)


def set_current_user(user):
    _state.user = user


class CurrentUserMiddleware:
    """Attach the request user to a thread-local for the lifetime of a request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_user(getattr(request, "user", None))
        try:
            return self.get_response(request)
        finally:
            set_current_user(None)
