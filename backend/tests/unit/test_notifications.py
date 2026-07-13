from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from app.services import email_sender, notifications


class FakeResult:
    def __init__(self, rows=None, value=None):
        self._rows = list(rows or [])
        self._value = value

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows

    def scalar_one(self):
        if self._value is not None:
            return self._value
        return self._rows[0] if self._rows else None


class FakeDB:
    def __init__(self, template_row=None):
        self.commits = 0
        self.rollbacks = 0
        self.executed = []
        self.template_row = template_row
        self.insert_calls = 0

    async def execute(self, statement, params=None):
        sql = str(statement)
        self.executed.append((sql, params))
        if "FROM email_templates" in sql:
            return FakeResult([self.template_row] if self.template_row else [])
        if "SELECT has_institutional_email" in sql:
            return FakeResult([True])
        if "SELECT pg_try_advisory_lock" in sql:
            return FakeResult(value=True)
        if "SELECT pg_advisory_unlock" in sql:
            return FakeResult(value=True)
        if "INSERT INTO notification_queue" in sql:
            self.insert_calls += 1
            return FakeResult([])
        if "SELECT * FROM notification_queue" in sql:
            return FakeResult([
                SimpleNamespace(
                    id="notif-1",
                    recipient_id="user-1",
                    subject="subject",
                    body="body",
                    retry_count=0,
                    scheduled_at=None,
                )
            ])
        if "UPDATE notification_queue" in sql:
            return FakeResult([])
        return FakeResult([])

    async def commit(self):
        self.commits += 1

    async def rollback(self):
        self.rollbacks += 1


@pytest.mark.asyncio
async def test_notify_event_renders_template_without_committing():
    db = FakeDB(
        template_row=SimpleNamespace(
            subject_template="Hello {{app_number}}",
            body_template="Body {{employee_name}}",
        )
    )

    await notifications.notify_event(
        db,
        "APP_SUBMITTED",
        "app-1",
        {
            "recipient_id": "user-1",
            "approver_id": "user-2",
            "app_number": "HRMS/2026/0001",
            "employee_name": "Alice",
        },
    )

    assert db.commits == 0
    assert db.insert_calls == 2


@pytest.mark.asyncio
async def test_send_email_batch_processes_single_pending_item(monkeypatch):
    class SessionWithOnePending(FakeDB):
        def __init__(self):
            super().__init__()
            self.status_updates = []

        async def execute(self, statement, params=None):
            sql = str(statement)
            if "SELECT * FROM notification_queue" in sql:
                return FakeResult([
                    SimpleNamespace(
                        id="notif-1",
                        recipient_id="user-1",
                        subject="subject",
                        body="body",
                        retry_count=0,
                        scheduled_at=None,
                    )
                ])
            if "SELECT email FROM employees" in sql:
                return FakeResult(["demo@example.com"])
            if "UPDATE notification_queue" in sql:
                self.status_updates.append(params)
                return FakeResult([])
            return await super().execute(statement, params)

    session = SessionWithOnePending()

    @asynccontextmanager
    async def _fake_factory():
        yield session

    async def enabled_config(_db):
        from app.services.email_config import EmailConfig

        return EmailConfig(
            smtp_host="smtp.zoho.in",
            smtp_port=587,
            from_email="demo@zoho.in",
            app_password="secret",
            sending_enabled=True,
        )

    monkeypatch.setattr(email_sender, "async_session_factory", _fake_factory)
    monkeypatch.setattr(email_sender, "load_email_config", enabled_config)

    sent = []

    def fake_send_message_sync(_config, *args, **kwargs):
        sent.append((args, kwargs))

    monkeypatch.setattr(email_sender, "send_email_message_sync", fake_send_message_sync)

    await email_sender.send_email_batch()

    assert len(sent) == 1
    assert session.commits >= 1
    assert len(session.status_updates) == 1
    assert session.status_updates[0].get("id") == "notif-1"


@pytest.mark.asyncio
async def test_send_email_batch_returns_early_when_email_sending_disabled(monkeypatch):
    from contextlib import asynccontextmanager

    class DisabledDB:
        async def execute(self, *_args, **_kwargs):
            from app.services.email_config import EmailConfig

            return FakeResult(value=True)

        async def commit(self):
            pass

    @asynccontextmanager
    async def fake_factory():
        yield DisabledDB()

    async def disabled_config(_db):
        from app.services.email_config import EmailConfig

        return EmailConfig(
            smtp_host="smtp.zoho.in",
            smtp_port=587,
            from_email="",
            app_password="",
            sending_enabled=False,
        )

    monkeypatch.setattr(email_sender, "async_session_factory", fake_factory)
    monkeypatch.setattr(email_sender, "load_email_config", disabled_config)

    await email_sender.send_email_batch()
    assert True
