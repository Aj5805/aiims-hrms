import re

with open("alembic/versions/0001_initial_schema.py", "r", encoding="utf-8") as f:
    content = f.read()

# I will find the precise create_table blocks.
g5_configs = re.search(r'    op\.create_table\(\n        "workflow_configs",.*?\n    \)\n\n', content, re.DOTALL).group(0)
g5_steps = re.search(r'    op\.create_table\(\n        "workflow_steps",.*?\n    \)\n\n', content, re.DOTALL).group(0)

# remove them
content = content.replace(g5_configs, "")
content = content.replace(g5_steps, "")

# find leave_applications
leave_apps = content.find('    op.create_table(\n        "leave_applications",')

# insert before leave_applications
content = content[:leave_apps] + g5_configs + g5_steps + content[leave_apps:]

with open("alembic/versions/0001_initial_schema.py", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
