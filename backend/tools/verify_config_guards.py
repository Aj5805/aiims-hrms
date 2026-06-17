import os
import sys
from pydantic import ValidationError

def test_guard(env_vars, expected_error_contains=None):
    # clear existing env vars
    for k in ['APP_ENV', 'JWT_SECRET', 'CORS_ORIGINS']:
        if k in os.environ:
            del os.environ[k]
    # set new
    for k, v in env_vars.items():
        os.environ[k] = v

    try:
        from app.core.config import Settings
        s = Settings(_env_file=None)
        if expected_error_contains:
            print(f"FAIL: Expected error containing '{expected_error_contains}', but loaded successfully.")
            return False
        else:
            print("OK: Loaded successfully as expected.")
            return True
    except ValidationError as e:
        if expected_error_contains and expected_error_contains in str(e):
            print(f"OK: Caught expected error: {expected_error_contains}")
            return True
        else:
            print(f"FAIL: Caught unexpected error: {e}")
            return False
    except Exception as e:
        print(f"FAIL: Caught unexpected exception: {e}")
        return False

def main():
    print("--- Testing Config Guards ---")
    
    # (i) APP_ENV=production + default/short JWT_SECRET
    print("\n1) APP_ENV=production + short JWT_SECRET")
    env1 = {"APP_ENV": "production", "JWT_SECRET": "short"}
    test_guard(env1, "JWT_SECRET must be explicitly set to a strong value outside local/test development")
    
    # (ii) APP_ENV=production + CORS_ORIGINS="*"
    print("\n2) APP_ENV=production + CORS_ORIGINS='*'")
    env2 = {"APP_ENV": "production", "JWT_SECRET": "super_strong_secret_that_is_32_chars_long!", "CORS_ORIGINS": "*"}
    test_guard(env2, "CORS_ORIGINS cannot use '*' outside local/test development")
    
    # (iii) APP_ENV=production + strong 32+ char JWT_SECRET + explicit CORS_ORIGINS
    print("\n3) APP_ENV=production + strong 32+ char JWT_SECRET + explicit CORS_ORIGINS")
    env3 = {
        "APP_ENV": "production",
        "JWT_SECRET": "super_strong_secret_that_is_32_chars_long!",
        "CORS_ORIGINS": "http://example.com"
    }
    test_guard(env3)

if __name__ == "__main__":
    main()
