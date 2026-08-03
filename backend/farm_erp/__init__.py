"""Project package initialisation.

Import search signals to ensure cache version bumps are registered when
models change. Django imports the project package while loading settings,
so this reliably registers the signal handlers.
"""

# Ensure signal handlers are registered.
try:
	from . import search_signals  # noqa: F401
except Exception:
	# Avoid failing import if signals module can't be loaded in some contexts.
	pass
