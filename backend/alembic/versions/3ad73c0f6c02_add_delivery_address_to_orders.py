"""add delivery address to orders

Revision ID: 3ad73c0f6c02
Revises: bfb76a157aa6
Create Date: 2026-11-15 06:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3ad73c0f6c02"
down_revision: Union[str, Sequence[str], None] = "bfb76a157aa6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("delivery_address", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "delivery_address")
