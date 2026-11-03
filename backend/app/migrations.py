"""Lightweight, idempotent schema migrations for SQLite.

`Base.metadata.create_all` only creates tables that do not exist yet; it never
adds columns to an already-created table. This module closes that gap by
inspecting each existing table and issuing `ALTER TABLE ... ADD COLUMN` for
every model column that is missing.
"""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.sql.schema import Column

from .db import Base


def _server_default(col: Column) -> str | None:
    """Render a SQL DEFAULT literal for a scalar Python-side default, if safe."""
    default = col.default
    if default is None or not default.is_scalar:
        return None
    arg = default.arg
    if isinstance(arg, bool):
        return "1" if arg else "0"
    if isinstance(arg, (int, float)):
        return str(arg)
    if isinstance(arg, str):
        return "'" + arg.replace("'", "''") + "'"
    if arg is list:
        return "'[]'"
    if arg is dict:
        return "'{}'"
    return None


def run_migrations(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    columns_by_table = {
        table.name: {c["name"] for c in inspector.get_columns(table.name)}
        for table in Base.metadata.sorted_tables
        if table.name in existing_tables
    }

    statements: list[str] = []
    for table in Base.metadata.sorted_tables:
        existing = columns_by_table.get(table.name)
        if existing is None:
            continue
        for col in table.columns:
            if col.name in existing:
                continue
            coltype = col.type.compile(engine.dialect)
            clause = f"ALTER TABLE {table.name} ADD COLUMN {col.name} {coltype}"
            if col.nullable:
                clause += " NULL"
            else:
                default = _server_default(col)
                if default is not None:
                    clause += f" DEFAULT {default}"
                else:
                    # No safe default: leave the column nullable so existing rows
                    # are not invalidated.
                    clause += " NULL"
            statements.append(clause)

    if not statements:
        return

    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
