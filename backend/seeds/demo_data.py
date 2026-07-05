"""Idempotent demo-data bootstrap for local HRMS demos.

Creates a small, realistic dataset and drives leave workflows through the real
FastAPI endpoints so balances, notifications, and workflow history follow the
normal application path.
"""

from __future__ import annotations

import asyncio
import os
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings
from app.auth.jwt import hash_password
from main import app

BASE_URL = "http://testserver"
ADMIN_PASSWORD = "password"
DEFAULT_STAFF_PASSWORD = "password"
UPDATED_STAFF_PASSWORD = "NewPassword123!"


@dataclass(frozen=True)
class DemoEmployeeSpec:
    emp_code: str
    name: str
    gender: str
    doj: date
    category_code: str
    department_code: str
    designation_name: str
    email: str
    leave_type_code: str
    opening_balance: float


DEPARTMENTS = [
    {
        "code": "GENMED",
        "name": "General Medicine",
        "managing_office": "ESTABLISHMENT",
    },
    {
        "code": "ANAES",
        "name": "Anaesthesiology",
        "managing_office": "DEAN_ACADEMIC",
    },
]

DESIGNATIONS = [
    {"name": "Administrative Officer", "grade_pay_level": "Level 8", "category_code": "ADMIN"},
    {"name": "Junior Resident (Non-Academic)", "grade_pay_level": "Level 10", "category_code": "JR_NA"},
]

EMPLOYEES = [
    DemoEmployeeSpec(
        emp_code="GMADM01",
        name="Asha Verma",
        gender="FEMALE",
        doj=date(2021, 4, 5),
        category_code="ADMIN",
        department_code="GENMED",
        designation_name="Administrative Officer",
        email="asha.verma@aiims-demo.local",
        leave_type_code="EL",
        opening_balance=18,
    ),
    DemoEmployeeSpec(
        emp_code="GMADM02",
        name="Rahul Nair",
        gender="MALE",
        doj=date(2020, 8, 17),
        category_code="ADMIN",
        department_code="GENMED",
        designation_name="Administrative Officer",
        email="rahul.nair@aiims-demo.local",
        leave_type_code="EL",
        opening_balance=16,
    ),
    DemoEmployeeSpec(
        emp_code="GMADM03",
        name="Priya Kulkarni",
        gender="FEMALE",
        doj=date(2019, 11, 12),
        category_code="ADMIN",
        department_code="GENMED",
        designation_name="Administrative Officer",
        email="priya.kulkarni@aiims-demo.local",
        leave_type_code="EL",
        opening_balance=20,
    ),
    DemoEmployeeSpec(
        emp_code="GMADM04",
        name="Vikram Singh",
        gender="MALE",
        doj=date(2022, 1, 10),
        category_code="ADMIN",
        department_code="GENMED",
        designation_name="Administrative Officer",
        email="vikram.singh@aiims-demo.local",
        leave_type_code="EL",
        opening_balance=12,
    ),
    DemoEmployeeSpec(
        emp_code="GMADM05",
        name="Neha Thomas",
        gender="FEMALE",
        doj=date(2023, 3, 21),
        category_code="ADMIN",
        department_code="GENMED",
        designation_name="Administrative Officer",
        email="neha.thomas@aiims-demo.local",
        leave_type_code="EL",
        opening_balance=14,
    ),
    DemoEmployeeSpec(
        emp_code="ANJR01",
        name="Karan Reddy",
        gender="MALE",
        doj=date(2025, 7, 1),
        category_code="JR_NA",
        department_code="ANAES",
        designation_name="Junior Resident (Non-Academic)",
        email="karan.reddy@aiims-demo.local",
        leave_type_code="ANNUAL_RES",
        opening_balance=24,
    ),
]


def next_weekday(start: date, weekday: int, week_offset: int = 0) -> date:
    days_ahead = (weekday - start.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7
    return start + timedelta(days=days_ahead + 7 * week_offset)


def demo_schedule(today: date) -> dict[str, str]:
    base = next_weekday(today, 0)
    return {
        "pending_hod": base.isoformat(),
        "under_review_estab": (base + timedelta(days=1)).isoformat(),
        "approved": (base + timedelta(days=2)).isoformat(),
        "rejected": (base + timedelta(days=3)).isoformat(),
        "withdrawn": (base + timedelta(days=4)).isoformat(),
        "resident_pending_dean": (base + timedelta(days=7)).isoformat(),
    }


class DemoSeeder:
    def __init__(self) -> None:
        self.engine = create_engine(settings.DATABASE_URL_SYNC)
        self.transport = httpx.ASGITransport(app=app)
        self.employee_ids: dict[str, str] = {}
        self.user_ids: dict[str, str] = {}

    async def run(self) -> None:
        self.guard_environment()
        self.reset_demo_transactions()
        async with httpx.AsyncClient(transport=self.transport, base_url=BASE_URL) as client:
            admin_headers = await self.login_headers(client, "admin", ADMIN_PASSWORD, client_ip="10.0.0.10")
            await self.ensure_master_data(client, admin_headers)
            self.load_demo_users()
            await self.reset_staff_passwords(client, admin_headers)
            await self.seed_balances(client, admin_headers)
            await self.drive_demo_flow()
            self.print_summary()

    def guard_environment(self) -> None:
        if settings.APP_ENV == "production" or os.environ.get("APP_ENV") == "production":
            raise RuntimeError("demo_data.py must not run against production")

    def reset_demo_transactions(self) -> None:
        demo_codes = [item.emp_code for item in EMPLOYEES]
        with Session(self.engine) as session:
            application_rows = session.execute(
                text(
                    """
                    SELECT a.id
                    FROM leave_applications a
                    JOIN employees e ON e.id = a.employee_id
                    WHERE e.emp_code = ANY(:codes)
                    """
                ),
                {"codes": demo_codes},
            ).fetchall()
            application_ids = [str(row[0]) for row in application_rows]

            if application_ids:
                session.execute(
                    text(
                        """
                        DELETE FROM notification_queue
                        WHERE application_id IN (
                            SELECT a.id
                            FROM leave_applications a
                            JOIN employees e ON e.id = a.employee_id
                            WHERE e.emp_code = ANY(:codes)
                        )
                        """
                    ),
                    {"codes": demo_codes},
                )
                session.execute(
                    text(
                        """
                        DELETE FROM leave_approvals
                        WHERE application_id IN (
                            SELECT a.id
                            FROM leave_applications a
                            JOIN employees e ON e.id = a.employee_id
                            WHERE e.emp_code = ANY(:codes)
                        )
                        """
                    ),
                    {"codes": demo_codes},
                )
                session.execute(
                    text(
                        """
                        DELETE FROM leave_applications
                        WHERE employee_id IN (
                            SELECT id FROM employees WHERE emp_code = ANY(:codes)
                        )
                        """
                    ),
                    {"codes": demo_codes},
                )

            session.execute(
                text(
                    """
                    UPDATE leave_balances
                    SET availed = 0, lop_days = 0, last_updated = now()
                    WHERE employee_id IN (
                        SELECT id FROM employees WHERE emp_code = ANY(:codes)
                    )
                    """
                ),
                {"codes": demo_codes},
            )
            session.commit()

    async def ensure_master_data(self, client: httpx.AsyncClient, headers: dict[str, str]) -> None:
        existing_departments = {
            row["code"]: row
            for row in await self.get_json(client, "/api/v1/departments", headers)
        }
        for dept in DEPARTMENTS:
            if dept["code"] not in existing_departments:
                await self.expect_status(
                    client.post("/api/v1/departments", json=dept, headers=headers),
                    201,
                    f"create department {dept['code']}",
                )

        existing_designations = {
            row["name"]: row
            for row in await self.get_json(client, "/api/v1/designations", headers)
        }
        for designation in DESIGNATIONS:
            if designation["name"] not in existing_designations:
                await self.expect_status(
                    client.post("/api/v1/designations", json=designation, headers=headers),
                    201,
                    f"create designation {designation['name']}",
                )

        existing_employees = {
            row["emp_code"]: row
            for row in await self.get_json(client, "/api/v1/employees?limit=200", headers)
            if row["emp_code"] in {item.emp_code for item in EMPLOYEES}
        }
        for employee in EMPLOYEES:
            payload = {
                "emp_code": employee.emp_code,
                "name": employee.name,
                "gender": employee.gender,
                "doj": employee.doj.isoformat(),
                "category_code": employee.category_code,
                "department_code": employee.department_code,
                "designation_name": employee.designation_name,
                "email": employee.email,
                "has_institutional_email": True,
                "personal_email": employee.email.replace("@aiims-demo.local", "@example.com"),
            }
            if employee.emp_code not in existing_employees:
                response = await client.post("/api/v1/employees", json=payload, headers=headers)
                await self.expect_status(response, 201, f"create employee {employee.emp_code}")

        refreshed = await self.get_json(client, "/api/v1/employees?limit=200", headers)
        for row in refreshed:
            code = row["emp_code"]
            if code in {item.emp_code for item in EMPLOYEES}:
                self.employee_ids[code] = row["id"]
                if row.get("user_id"):
                    self.user_ids[code] = row["user_id"]

    def load_demo_users(self) -> None:
        with Session(self.engine) as session:
            rows = session.execute(
                text(
                    """
                    SELECT e.emp_code, u.id
                    FROM employees e
                    JOIN users u ON u.employee_id = e.id
                    WHERE e.emp_code = ANY(:codes)
                    """
                ),
                {"codes": [item.emp_code for item in EMPLOYEES]},
            ).fetchall()
            for row in rows:
                self.user_ids[str(row[0])] = str(row[1])

    async def reset_staff_passwords(self, client: httpx.AsyncClient, headers: dict[str, str]) -> None:
        with Session(self.engine) as session:
            for employee in EMPLOYEES:
                user_id = self.user_ids[employee.emp_code]
                session.execute(
                    text(
                        """
                        UPDATE users
                        SET password_hash = :password_hash,
                            must_change_password = true,
                            failed_login_attempts = 0,
                            locked_until = NULL,
                            tokens_valid_from = now()
                        WHERE id = :user_id
                        """
                    ),
                    {
                        "user_id": user_id,
                        "password_hash": hash_password(DEFAULT_STAFF_PASSWORD),
                    },
                )
            session.commit()

    async def seed_balances(self, client: httpx.AsyncClient, headers: dict[str, str]) -> None:
        payload = [
            {
                "emp_code": employee.emp_code,
                "leave_type_code": employee.leave_type_code,
                "opening_balance": employee.opening_balance,
            }
            for employee in EMPLOYEES
        ]
        response = await client.post("/api/v1/leave-balances/opening", json=payload, headers=headers)
        await self.expect_status(response, 200, "seed opening balances")

    async def drive_demo_flow(self) -> None:
        schedule = demo_schedule(date.today())

        await self.submit_as_staff(
            "GMADM01",
            {
                "employee_id": self.employee_ids["GMADM01"],
                "leave_type_code": "EL",
                "from_date": schedule["pending_hod"],
                "to_date": schedule["pending_hod"],
                "reason": "OPD roster handover and family travel",
                "address_during_leave": "Hyderabad",
            },
            client_ip="10.0.1.11",
        )

        app_estab = await self.submit_as_staff(
            "GMADM02",
            {
                "employee_id": self.employee_ids["GMADM02"],
                "leave_type_code": "EL",
                "from_date": schedule["under_review_estab"],
                "to_date": schedule["under_review_estab"],
                "reason": "Parent medical follow-up visit",
                "address_during_leave": "Bengaluru",
            },
            client_ip="10.0.1.12",
        )
        await self.approval_action("hod", "password", app_estab["id"], "APPROVED", "Forwarded by HOD", client_ip="10.0.2.21")

        app_approved = await self.submit_as_staff(
            "GMADM03",
            {
                "employee_id": self.employee_ids["GMADM03"],
                "leave_type_code": "EL",
                "from_date": schedule["approved"],
                "to_date": schedule["approved"],
                "reason": "One-day personal work outside station",
                "address_during_leave": "Warangal",
            },
            client_ip="10.0.1.13",
        )
        await self.approval_action("hod", "password", app_approved["id"], "APPROVED", "Recommended by HOD", client_ip="10.0.2.22")
        await self.approval_action("estab", "password", app_approved["id"], "APPROVED", "Scrutiny complete", client_ip="10.0.2.23")
        await self.approval_action("registrar", "password", app_approved["id"], "APPROVED", "Approved for sanction", client_ip="10.0.2.24")

        app_rejected = await self.submit_as_staff(
            "GMADM04",
            {
                "employee_id": self.employee_ids["GMADM04"],
                "leave_type_code": "EL",
                "from_date": schedule["rejected"],
                "to_date": schedule["rejected"],
                "reason": "Urgent local travel",
                "address_during_leave": "Nalgonda",
            },
            client_ip="10.0.1.14",
        )
        await self.approval_action("hod", "password", app_rejected["id"], "REJECTED", "Department review meeting already scheduled", client_ip="10.0.2.25")

        app_withdrawn = await self.submit_as_staff(
            "GMADM05",
            {
                "employee_id": self.employee_ids["GMADM05"],
                "leave_type_code": "EL",
                "from_date": schedule["withdrawn"],
                "to_date": schedule["withdrawn"],
                "reason": "School admission appointment",
                "address_during_leave": "Secunderabad",
            },
            client_ip="10.0.1.15",
        )
        await self.withdraw_as_staff("GMADM05", app_withdrawn["id"], client_ip="10.0.1.25")

        app_resident = await self.submit_as_staff(
            "ANJR01",
            {
                "employee_id": self.employee_ids["ANJR01"],
                "leave_type_code": "ANNUAL_RES",
                "from_date": schedule["resident_pending_dean"],
                "to_date": schedule["resident_pending_dean"],
                "reason": "Conference presentation travel",
                "address_during_leave": "Chennai",
            },
            client_ip="10.0.1.16",
        )
        await self.approval_action("hod", "password", app_resident["id"], "APPROVED", "Forwarded to Dean Academic", client_ip="10.0.2.26")

    async def submit_as_staff(self, username: str, payload: dict[str, Any], client_ip: str) -> dict[str, Any]:
        headers = await self.staff_headers(username, client_ip)
        async with httpx.AsyncClient(transport=self.transport, base_url=BASE_URL) as client:
            response = await client.post("/api/v1/leave-applications", json=payload, headers=headers)
            await self.expect_status(response, 201, f"submit leave for {username}")
            return response.json()

    async def withdraw_as_staff(self, username: str, application_id: str, client_ip: str) -> None:
        headers = await self.staff_headers(username, client_ip)
        async with httpx.AsyncClient(transport=self.transport, base_url=BASE_URL) as client:
            response = await client.put(f"/api/v1/leave-applications/{application_id}/withdraw", headers=headers)
            await self.expect_status(response, 200, f"withdraw leave for {username}")

    async def approval_action(
        self,
        username: str,
        password: str,
        application_id: str,
        action: str,
        remarks: str,
        client_ip: str,
    ) -> None:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=(client_ip, 5000)), base_url=BASE_URL) as client:
            headers = await self.login_headers(client, username, password, client_ip)
            response = await client.post(
                f"/api/v1/leave-approvals/{application_id}/action",
                json={"action": action, "remarks": remarks},
                headers=headers,
            )
            await self.expect_status(response, 200, f"{action} application {application_id}")

    async def staff_headers(self, username: str, client_ip: str) -> dict[str, str]:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app, client=(client_ip, 5000)), base_url=BASE_URL) as client:
            login = await client.post("/api/v1/auth/login", json={"username": username, "password": DEFAULT_STAFF_PASSWORD})
            if login.status_code == 401:
                login = await client.post("/api/v1/auth/login", json={"username": username, "password": UPDATED_STAFF_PASSWORD})
            await self.expect_status(login, 200, f"login {username}")
            login_payload = login.json()
            access_token = login_payload["access_token"]
            if login_payload["user"].get("must_change_password"):
                change = await client.post(
                    "/api/v1/auth/change-my-password",
                    json={"current_password": DEFAULT_STAFF_PASSWORD, "new_password": UPDATED_STAFF_PASSWORD},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                await self.expect_status(change, 200, f"change password {username}")
                access_token = change.json()["access_token"]
            return {"Authorization": f"Bearer {access_token}"}

    async def login_headers(
        self,
        client: httpx.AsyncClient,
        username: str,
        password: str,
        client_ip: str,
    ) -> dict[str, str]:
        response = await client.post("/api/v1/auth/login", json={"username": username, "password": password})
        await self.expect_status(response, 200, f"login {username}")
        return {"Authorization": f"Bearer {response.json()['access_token']}"}

    async def get_json(self, client: httpx.AsyncClient, path: str, headers: dict[str, str]) -> Any:
        response = await client.get(path, headers=headers)
        await self.expect_status(response, 200, f"GET {path}")
        return response.json()

    async def expect_status(self, response_task: Any, status_code: int, label: str) -> httpx.Response:
        response = await response_task if asyncio.iscoroutine(response_task) else response_task
        if response.status_code != status_code:
            raise RuntimeError(f"{label} failed: {response.status_code} {response.text}")
        return response

    def print_summary(self) -> None:
        with Session(self.engine) as session:
            rows = session.execute(
                text(
                    """
                    SELECT a.app_number, e.emp_code, a.status
                    FROM leave_applications a
                    JOIN employees e ON e.id = a.employee_id
                    WHERE e.emp_code = ANY(:codes)
                    ORDER BY e.emp_code
                    """
                ),
                {"codes": [item.emp_code for item in EMPLOYEES]},
            ).fetchall()
            print("Demo applications:")
            for row in rows:
                print(f"  {row[1]} -> {row[0]} [{row[2]}]")


async def main() -> None:
    seeder = DemoSeeder()
    await seeder.run()


if __name__ == "__main__":
    asyncio.run(main())
