"""create users table

Revision ID: 9f4e7a1c2b6d
Revises: 06d3f50817fb
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f4e7a1c2b6d"
down_revision: Union[str, Sequence[str], None] = "06d3f50817fb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
	op.create_table(
		"users",
		sa.Column("id", sa.String(), nullable=False),
		sa.Column("first_name", sa.String(), nullable=False),
		sa.Column("last_name", sa.String(), nullable=False),
		sa.Column("email", sa.String(), nullable=False),
		sa.Column("phone", sa.String(), nullable=False),
		sa.Column("password", sa.String(), nullable=False),
		sa.Column("created_at", sa.DateTime(), nullable=False),
		sa.Column("updated_at", sa.DateTime(), nullable=False),
		sa.PrimaryKeyConstraint("id"),
		sa.UniqueConstraint("email"),
		sa.UniqueConstraint("phone"),
	)


def downgrade() -> None:
	op.drop_table("users")
