"""Prepare only named league acceptance records in a dedicated test database."""

import asyncio
import os
import sys
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.features.leagues.calculation import weekly_bounds
from app.features.leagues.models import league, league_member
from app.features.training.models import exercise


async def main():
    url = os.environ["DATABASE_URL"]
    if (
        os.environ.get("APP_ENV") != "test"
        or not (make_url(url).database or "").startswith("friends_league_")
        or not (make_url(url).database or "").endswith("_test")
    ):
        raise SystemExit("A run-owned friends_league_*_test database is required")
    engine = create_async_engine(url)
    async with engine.begin() as conn:
        if len(sys.argv) > 1:
            lid = int(sys.argv[1])
            row = (await conn.execute(sa.select(league).where(league.c.id == lid))).mappings().one()
            if not row["name"].startswith("Acceptance league"):
                raise SystemExit("Only run-owned acceptance leagues may be prepared")
            start, _ = weekly_bounds(datetime.now(UTC), row["timezone"])
            before = (
                start - timedelta(days=7)
                if len(sys.argv) > 2 and sys.argv[2] == "history"
                else start
            )
            await conn.execute(league.update().where(league.c.id == lid).values(created_at=before))
            await conn.execute(
                league_member.update()
                .where(league_member.c.league_id == lid)
                .values(joined_at=before)
            )
        else:
            if (
                await conn.scalar(
                    sa.select(exercise.c.id).where(
                        exercise.c.source == "ascend_edb_v2",
                        exercise.c.external_id == "league_acceptance",
                    )
                )
                is None
            ):
                await conn.execute(
                    exercise.insert().values(
                        name="League acceptance press",
                        activity_type="gym",
                        source="ascend_edb_v2",
                        external_id="league_acceptance",
                        imported_at=datetime.now(UTC),
                    )
                )
            await conn.execute(
                exercise.update()
                .where(
                    exercise.c.source == "ascend_edb_v2",
                    exercise.c.external_id == "league_acceptance",
                )
                .values(imported_at=datetime.now(UTC))
            )
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
