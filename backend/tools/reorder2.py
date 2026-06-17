import re

with open("alembic/versions/0001_initial_schema.py", "r", encoding="utf-8") as f:
    content = f.read()

# Find Group 5
idx_g5 = content.find("    # Group 5 — Workflow Engine")
idx_g6 = content.find("    # Group 6 — Notifications & Communication")

if idx_g5 == -1 or idx_g6 == -1:
    print("Could not find G5 or G6")
    exit(1)

# Extract G5 block
# Find the line start for G5
idx_g5_start = content.rfind("    # ════", 0, idx_g5)
idx_g6_start = content.rfind("    # ════", 0, idx_g6)

g5_chunk = content[idx_g5_start:idx_g6_start]

# Remove G5 from old location
content = content[:idx_g5_start] + content[idx_g6_start:]

# Find G4
idx_g4 = content.find("    # Group 4 — Leave Transactions")
idx_g4_start = content.rfind("    # ════", 0, idx_g4)

# Insert G5 before G4
content = content[:idx_g4_start] + g5_chunk + content[idx_g4_start:]

# Add config_id to leave_applications
content = content.replace(
    'sa.Column("app_number", sa.String(30), unique=True, nullable=False),',
    'sa.Column("app_number", sa.String(30), unique=True, nullable=False),\n        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_configs.id"), nullable=False),'
)

# Reorder downgrades
# remove them
content = content.replace("    op.drop_table(\"workflow_steps\")\n", "")
content = content.replace("    op.drop_table(\"workflow_configs\")\n", "")

# insert them after leave_applications
content = content.replace(
    "    op.drop_table(\"leave_applications\")\n",
    "    op.drop_table(\"leave_applications\")\n    op.drop_table(\"workflow_steps\")\n    op.drop_table(\"workflow_configs\")\n"
)

with open("alembic/versions/0001_initial_schema.py", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
