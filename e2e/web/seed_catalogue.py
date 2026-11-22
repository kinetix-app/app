"""Add synthetic acceptance catalogue input only to an explicitly isolated test DB."""

import asyncio
import os
from datetime import UTC, datetime

import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.features.training.models import exercise

# The image is a synthetic PNG for exercising browser image decoding without a remote host.
PRESS_IMAGE = (
    "data:image/png;base64,"
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZl0AAAAASUVORK5CYII="
)


async def main():
    if os.environ.get("APP_ENV") != "test":
        raise SystemExit("Acceptance seed requires APP_ENV=test")
    url = os.environ["DATABASE_URL"]
    if not (make_url(url).database or "").endswith("_test"):
        raise SystemExit("Acceptance seed requires a database ending in _test")
    engine = create_async_engine(url)
    async with engine.begin() as connection:
        for name, key, body_part in [
            ("Acceptance press", "press", "CHEST"),
            ("Acceptance row", "row", "BACK"),
            ("Acceptance squat", "squat", "UPPER LEGS"),
            ("Acceptance cardio", "cardio", None),
        ]:
            external_id = f"kinetix-workout-e2e-{key}"
            existing = await connection.scalar(
                sa.select(exercise.c.id).where(
                    exercise.c.external_id == external_id,
                    exercise.c.source == "ascend_edb_v2",
                )
            )
            if existing is None:
                await connection.execute(
                    exercise.insert().values(
                        name=name,
                        activity_type="cardio" if key == "cardio" else "gym",
                        source="ascend_edb_v2",
                        external_id=external_id,
                        imported_at=datetime.now(UTC),
                        body_parts=[body_part] if body_part else [],
                        instructions=["Move with control."],
                        image_url=PRESS_IMAGE if key == "press" else None,
                    )
                )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
