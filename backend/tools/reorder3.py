import re

with open("alembic/versions/0001_initial_schema.py", "r", encoding="utf-8") as f:
    content = f.read()

idx_g5 = re.search(r"Group 5.*Workflow Engine", content).start()
idx_g6 = re.search(r"Group 6.*Notifications", content).start()

idx_g5_start = content.rfind("    # ════", 0, idx_g5)
idx_g6_start = content.rfind("    # ════", 0, idx_g6)

g5_chunk = content[idx_g5_start:idx_g6_start]

content = content[:idx_g5_start] + content[idx_g6_start:]

idx_g4 = re.search(r"Group 4.*Leave Transactions", content).start()
idx_g4_start = content.rfind("    # ════", 0, idx_g4)

content = content[:idx_g4_start] + g5_chunk + content[idx_g4_start:]

content = content.replace(
    'sa.Column("app_number", sa.String(30), unique=True, nullable=False),',
    'sa.Column("app_number", sa.String(30), unique=True, nullable=False),\n        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_configs.id"), nullable=False),'
)

content = content.replace("    op.drop_table(\"workflow_steps\")\n", "")
content = content.replace("    op.drop_table(\"workflow_configs\")\n", "")

content = content.replace(
    "    op.drop_table(\"leave_applications\")\n",
    "    op.drop_table(\"leave_applications\")\n    op.drop_table(\"workflow_steps\")\n    op.drop_table(\"workflow_configs\")\n"
)

with open("alembic/versions/0001_initial_schema.py", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
