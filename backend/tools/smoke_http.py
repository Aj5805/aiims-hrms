import httpx
import subprocess
import time
import sys
import uuid

def main():
    print("--- Starting Uvicorn ---")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8001"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    
    try:
        # Wait for health
        ready = False
        for _ in range(20):
            try:
                r = httpx.get("http://127.0.0.1:8001/health")
                if r.status_code == 200:
                    ready = True
                    break
            except httpx.RequestError:
                time.sleep(1)
        
        if not ready:
            print("FAIL: Uvicorn did not start in time.")
            sys.exit(1)
            
        print("OK: Uvicorn started and /health is 200.")
        
        client = httpx.Client(base_url="http://127.0.0.1:8001")
        
        # b) POST /login admin
        print("\nb) POST /auth/login (admin)")
        r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "E2eAdmin#123"})
        if r.status_code != 200:
            print(f"FAIL: Admin login failed with {r.status_code}")
            sys.exit(1)
        
        # Check cookies
        cookies = r.headers.get_list("set-cookie")
        refresh_cookie = next((c for c in cookies if "refresh_token=" in c), None)
        if not refresh_cookie:
            print("FAIL: No refresh_token cookie found.")
            sys.exit(1)
            
        print(f"Cookie Header: {refresh_cookie}")
        if "HttpOnly" not in refresh_cookie or "SameSite=strict" not in refresh_cookie or "Path=/api/v1/auth" not in refresh_cookie:
            print("FAIL: Cookie missing required attributes (HttpOnly, SameSite=strict, Path=/api/v1/auth).")
            sys.exit(1)
        if "Secure" in refresh_cookie:
            print("FAIL: Cookie has Secure flag but COOKIE_SECURE is false in dev.")
            sys.exit(1)
        print("OK: Cookie attributes validated.")
        
        admin_token = r.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        
        # c) Authenticated GET /me
        print("\nc) GET /auth/me")
        r = client.get("/api/v1/auth/me", headers=admin_headers)
        if r.status_code != 200:
            print(f"FAIL: GET /me failed with {r.status_code}")
            sys.exit(1)
        print("OK: GET /me authenticated.")
        
        # d) CORS preflight
        print("\nd) CORS preflight OPTIONS")
        r = client.options("/api/v1/auth/me", headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET"
        })
        if r.status_code != 200:
            print(f"FAIL: CORS preflight failed with {r.status_code}")
            sys.exit(1)
            
        if r.headers.get("access-control-allow-origin") != "http://127.0.0.1:5173":
            print(f"FAIL: Wrong ACAO: {r.headers.get('access-control-allow-origin')}")
            sys.exit(1)
        if r.headers.get("access-control-allow-credentials") != "true":
            print(f"FAIL: Wrong ACAC: {r.headers.get('access-control-allow-credentials')}")
            sys.exit(1)
        print("OK: CORS preflight validated.")
        
        # e) must_change_password gate
        print("\ne) MUST_CHANGE_PASSWORD gate")
        # Fetch HRMS001 user_id to reset
        r = client.get("/api/v1/employees?search=HRMS001", headers=admin_headers)
        hrms001_id = r.json()[0]["user_id"]
        
        # Reset password
        r = client.post("/api/v1/auth/change-password", json={
            "user_id": hrms001_id, "new_password": "NewStrongPassword123!"
        }, headers=admin_headers)
        if r.status_code != 200:
            print(f"FAIL: Admin change-password failed: {r.status_code}")
            sys.exit(1)
            
        # Login as HRMS001
        r = client.post("/api/v1/auth/login", json={"username": "HRMS001", "password": "NewStrongPassword123!"})
        if r.status_code != 200:
            print(f"FAIL: HRMS001 login failed: {r.status_code}")
            sys.exit(1)
            
        staff_token = r.json()["access_token"]
        staff_headers = {"Authorization": f"Bearer {staff_token}"}
        mcp_val = r.json()["user"]["must_change_password"]
        print(f"  Login must_change_password={mcp_val}")
        
        # Access protected route
        r = client.get("/api/v1/leave-applications", headers=staff_headers)
        if r.status_code != 403 or "PASSWORD_CHANGE_REQUIRED" not in r.text:
            print(f"FAIL: Protected route did not block. Got {r.status_code}: {r.text}")
            sys.exit(1)
        print("  OK: Protected route blocked -> 403 PASSWORD_CHANGE_REQUIRED")
        
        # Change own password
        r = client.post("/api/v1/auth/change-my-password", json={
            "current_password": "NewStrongPassword123!", "new_password": "AnotherNewPassword123!"
        }, headers=staff_headers)
        if r.status_code != 200:
            print(f"FAIL: Self change-my-password failed: {r.status_code}")
            sys.exit(1)
        print("  OK: Self change-my-password -> 200")
        
        # Re-login
        r = client.post("/api/v1/auth/login", json={"username": "HRMS001", "password": "AnotherNewPassword123!"})
        new_staff_token = r.json()["access_token"]
        new_staff_headers = {"Authorization": f"Bearer {new_staff_token}"}
        mcp_val2 = r.json()["user"]["must_change_password"]
        print(f"  Re-login must_change_password={mcp_val2}")
        
        # Access protected route again
        r = client.get("/api/v1/leave-applications", headers=new_staff_headers)
        if r.status_code != 200:
            print(f"FAIL: Protected route blocked after password change. Got {r.status_code}")
            sys.exit(1)
        print("  OK: Protected route accessed -> 200")
        
        print("\n--- All tests PASSED ---")
        
    finally:
        print("Terminating Uvicorn...")
        proc.terminate()
        proc.wait()

if __name__ == "__main__":
    main()
