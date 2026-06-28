import os
import subprocess
import sys

def run_command(cmd, env=None):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, env=env)
    if result.returncode != 0:
        print(f"Command failed with exit code {result.returncode}")
        sys.exit(result.returncode)

def push_db():
    print("Dumping database to database/db_snap.sql...")
    env = os.environ.copy()
    env["PGPASSWORD"] = "aiims_hrms"
    os.makedirs("database", exist_ok=True)
    # Dump structure and data, use clean to drop existing objects on restore
    cmd = "pg_dump -U aiims_hrms -h localhost aiims_hrms --clean --if-exists > database/db_snap.sql"
    run_command(cmd, env)
    
    print("Committing database snapshot...")
    run_command("git add database/db_snap.sql")
    run_command('git commit -m "chore: push database snapshot" || true')
    run_command("git push")
    print("Database pushed successfully!")

def pull_db():
    print("Pulling latest code and database snapshot...")
    run_command("git pull")
    
    if os.path.exists("database/db_snap.sql"):
        print("Restoring database from database/db_snap.sql...")
        env = os.environ.copy()
        env["PGPASSWORD"] = "aiims_hrms"
        cmd = "psql -U aiims_hrms -h localhost -d aiims_hrms -q < database/db_snap.sql"
        run_command(cmd, env)
        print("Database restored successfully!")
    else:
        print("No database/db_snap.sql found.")

if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] not in ["push", "pull"]:
        print("Usage: python scripts/db_sync.py [push|pull]")
        sys.exit(1)
        
    if sys.argv[1] == "push":
        push_db()
    else:
        pull_db()
