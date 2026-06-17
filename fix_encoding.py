import os

files = [
    'frontend/src/pages/LoginPage.tsx',
    'frontend/src/pages/Phase3Pages.tsx',
]

for p in files:
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            c = f.read()
        
        c = c.replace('â€”', '—').replace('â”€', '─').replace('âœ…', '✅')
        
        with open(p, 'w', encoding='utf-8') as f:
            f.write(c)
        print(f"Fixed {p}")
