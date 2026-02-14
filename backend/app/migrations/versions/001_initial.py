# Alembic version, required by alembic
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Initial migration - tables created by init_db()
    pass


def downgrade() -> None:
    pass
