with open("e2e_test.py", "r", encoding="utf-8") as f:
    content = f.read()

with open("e2e_scenarios.py_chunk", "r", encoding="utf-8") as f:
    chunk = f.read()

done_marker = "        # ── DONE ────────────────────────────────────────────────────────────"
if done_marker in content:
    content = content.replace(done_marker, chunk + "\n" + done_marker)
else:
    print("DONE marker not found")
    exit(1)

with open("e2e_test.py", "w", encoding="utf-8") as f:
    f.write(content)
print("SUCCESS")
