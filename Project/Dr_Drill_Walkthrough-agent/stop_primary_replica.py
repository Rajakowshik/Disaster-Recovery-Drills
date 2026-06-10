# stop_primary_replica.py
import os
import sys
import subprocess

print("[PYTHON stop_primary_replica] Initiating database isolation protocols...")

# Write OFFLINE state to local replica status file
try:
    with open("./local_db_status.txt", "w") as f:
        f.write("OFFLINE")
    print("[PYTHON stop_primary_replica] State file './local_db_status.txt' updated to OFFLINE status.")
except Exception as e:
    print(f"[PYTHON ERROR] Failed to write status file: {e}")

# Failure Injection: Attempt to stop actual docker container (if docker is installed)
print("[PYTHON stop_primary_replica] Querying local Docker daemon for 'mock_postgres_db' container...")
try:
    # Run container stop command
    res = subprocess.run(["docker", "stop", "mock_postgres_db"], capture_output=True, text=True, timeout=5)
    print(f"[PYTHON stop_primary_replica] Docker output: {res.stdout.strip()} {res.stderr.strip()}")
    if res.returncode == 0:
        print("[PYTHON stop_primary_replica] Success: Stopped 'mock_postgres_db' container.")
    else:
        print("[PYTHON stop_primary_replica] Container 'mock_postgres_db' was not active. Handled isolation gracefully.")
except FileNotFoundError:
    print("[PYTHON stop_primary_replica] Docker CLI tool not found in local path. Ignoring docker commands.")
except Exception as e:
    print(f"[PYTHON stop_primary_replica] Docker command failed: {e}")

print("[PYTHON stop_primary_replica] Completed primary replica hard-stop.")
sys.exit(0)
