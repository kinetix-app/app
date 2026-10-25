"""Add synthetic acceptance catalogue input only to an explicitly isolated test DB."""

import asyncio
import os
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.features.training.models import exercise


async def main():
    if os.environ.get("APP_ENV") != "test":
        raise SystemExit("Acceptance seed requires APP_ENV=test")
    url = os.environ["DATABASE_URL"]
    if not (make_url(url).database or "").endswith("_test"):
        raise SystemExit("Acceptance seed requires a database ending in _test")
    engine = create_async_engine(url)
    async with engine.begin() as connection:
        existing = await connection.scalar(
            sa.select(exercise.c.id).where(
                exercise.c.external_id == "kinetix-workout-e2e-press",
                exercise.c.source == "ascend_edb_v2",
            )
        )
        if existing is None:
            await connection.execute(
                exercise.insert().values(
                    name="Acceptance press",
                    activity_type="gym",
                    source="ascend_edb_v2",
                    external_id="kinetix-workout-e2e-press",
                    imported_at=datetime.now(UTC),
                    body_parts=["CHEST"],
                    instructions=["Press with controlled movement."],
                )
            )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
