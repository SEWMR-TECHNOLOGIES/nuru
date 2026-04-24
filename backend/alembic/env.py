"""Alembic environment configuration.

This file wires Alembic to the project's SQLAlchemy models and database URL
so that `alembic revision --autogenerate` can detect schema changes and
`alembic upgrade head` can apply them.
"""

import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------------------------
# 1. Make sure the 'app' package is importable (alembic.ini sets
#    prepend_sys_path = app, but we add it here too for safety).
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

# ---------------------------------------------------------------------------
# 2. Import project settings
# ---------------------------------------------------------------------------
from core.config import DATABASE_URL        # noqa: E402
from core.base import Base                  # noqa: E402

# Import ALL model modules so Base.metadata is fully populated.
# The models/__init__.py re-exports everything, so a single import suffices.
import models  # noqa: F401, E402

# ---------------------------------------------------------------------------
# 3. Alembic Config object (provides access to alembic.ini values)
# ---------------------------------------------------------------------------
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the real DATABASE_URL from env vars.
config.set_main_option("sqlalchemy.url", DATABASE_URL)

# The MetaData object for 'autogenerate' support.
target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# 4. Run migrations in "offline" mode (emit SQL to stdout).
# ---------------------------------------------------------------------------
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine. Calls to
    context.execute() emit the given string to the script output.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# ---------------------------------------------------------------------------
# 5. Run migrations in "online" mode (connect to the DB).
# ---------------------------------------------------------------------------
def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# ---------------------------------------------------------------------------
# 6. Entrypoint
# ---------------------------------------------------------------------------
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
