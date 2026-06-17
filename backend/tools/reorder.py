import re

with open("alembic/versions/0001_initial_schema.py", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Extract Group 5 Workflow Configs and Steps
group_5_pattern = re.compile(r"(    # ═════════════════════════════════════════════════════════════════════════════\n    # Group 5 — Workflow Engine\n    # ═════════════════════════════════════════════════════════════════════════════\n\n    op\.create_table\(\n        \"workflow_configs\",.*?sa\.UniqueConstraint\(\"config_id\", \"step_order\"\),\n    \)\n\n)", re.DOTALL)
match = group_5_pattern.search(content)
if not match:
    print("Could not find Group 5 workflow configs/steps!")
    exit(1)
group_5_chunk = match.group(1)

# Remove it from its original location
content = content.replace(group_5_chunk, "")

# 2. Insert it right before Group 4 Leave Transactions
group_4_header = r"    # ═════════════════════════════════════════════════════════════════════════════\n    # Group 4 — Leave Transactions\n"
if group_4_header not in content:
    print("Could not find Group 4 header!")
    exit(1)

content = content.replace(
    "    # ═════════════════════════════════════════════════════════════════════════════\n    # Group 4 — Leave Transactions\n",
    group_5_chunk + "    # ═════════════════════════════════════════════════════════════════════════════\n    # Group 4 — Leave Transactions\n"
)

# 3. Add config_id to leave_applications
leave_app_pattern = r"(op\.create_table\(\n        \"leave_applications\",\n        sa\.Column\(\"id\", postgresql\.UUID\(as_uuid=True\), primary_key=True, server_default=sa\.text\(\"uuid_generate_v4\(\)\"\)\),\n        sa\.Column\(\"app_number\", sa\.String\(30\), unique=True, nullable=False\),\n)"
if not re.search(leave_app_pattern, content):
    print("Could not find leave_applications creation!")
    exit(1)

content = re.sub(
    leave_app_pattern,
    r'\1        sa.Column("config_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("workflow_configs.id"), nullable=False),\n',
    content
)

# 4. Reorder downgrade
content = content.replace("    op.drop_table(\"workflow_steps\")\n    op.drop_table(\"workflow_configs\")\n", "")
content = content.replace(
    "    op.drop_table(\"leave_applications\")\n",
    "    op.drop_table(\"leave_applications\")\n    op.drop_table(\"workflow_steps\")\n    op.drop_table(\"workflow_configs\")\n"
)

with open("alembic/versions/0001_initial_schema.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Schema reordered successfully.")
