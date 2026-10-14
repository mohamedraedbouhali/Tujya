from __future__ import annotations

from collections.abc import Callable

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import AuthSession, User
from tests.conftest import ADMIN, USER, sign_in

NEW_ACCOUNT = {"email": "Alice@Mail.com", "full_name": "  Alice Martin ", "password": "s3cret-pass"}


def test_first_start_creates_admin_and_demo_user(admin: TestClient, user: TestClient) -> None:
    assert admin.get("/api/auth/me").json()["role"] == "admin"
    me = user.get("/api/auth/me").json()
    assert (me["email"], me["role"], me["is_active"]) == ("user@gmail.com", "user", True)


def test_passwords_and_session_tokens_are_stored_hashed(app: FastAPI, admin: TestClient) -> None:
    with app.state.session_factory() as db:
        stored = db.scalar(select(User).where(User.email == ADMIN["email"]))
        assert stored.password_hash.startswith("$argon2id$")
        assert ADMIN["password"] not in stored.password_hash
        token = admin.cookies[app.state.settings.session_cookie]
        assert db.scalar(select(AuthSession.token_hash)) != token


def test_session_cookie_is_http_only(anonymous: TestClient) -> None:
    response = anonymous.post("/api/auth/login", json=USER)
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "token" not in response.json()


def test_sign_up_creates_a_regular_user_and_signs_in(anonymous: TestClient) -> None:
    response = anonymous.post("/api/auth/signup", json=NEW_ACCOUNT)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["email"] == "alice@mail.com"
    assert body["full_name"] == "Alice Martin"
    assert body["role"] == "user"
    assert "password" not in body and "password_hash" not in body
    assert anonymous.get("/api/auth/me").json()["email"] == "alice@mail.com"


def test_sign_up_cannot_choose_a_role(anonymous: TestClient) -> None:
    response = anonymous.post("/api/auth/signup", json={**NEW_ACCOUNT, "role": "admin"})
    assert response.status_code == 201
    assert response.json()["role"] == "user"
    assert anonymous.get("/api/admin/stats").status_code == 403


def test_sign_up_rejects_duplicate_email_in_any_case(anonymous: TestClient) -> None:
    payload = {**NEW_ACCOUNT, "email": "USER@gmail.com"}
    assert anonymous.post("/api/auth/signup", json=payload).status_code == 409


def test_sign_up_validates_input(anonymous: TestClient) -> None:
    for change in ({"password": "short"}, {"email": "not-an-email"}, {"full_name": "   "}):
        response = anonymous.post("/api/auth/signup", json={**NEW_ACCOUNT, **change})
        assert response.status_code == 422, change


def test_sign_in_is_case_insensitive_on_email(anonymous: TestClient) -> None:
    response = anonymous.post(
        "/api/auth/login", json={"email": " Admin@Gmail.com ", "password": "admin"}
    )
    assert response.status_code == 200
    assert response.json()["role"] == "admin"


def test_wrong_password_and_unknown_email_get_the_same_answer(anonymous: TestClient) -> None:
    wrong = anonymous.post("/api/auth/login", json={**ADMIN, "password": "nope"})
    unknown = anonymous.post("/api/auth/login", json={"email": "ghost@mail.com", "password": "x"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()
    assert anonymous.get("/api/auth/me").status_code == 401


def test_sign_out_ends_the_session(user: TestClient, app: FastAPI) -> None:
    token = user.cookies[app.state.settings.session_cookie]
    assert user.post("/api/auth/logout").status_code == 204
    assert user.get("/api/auth/me").status_code == 401
    # The old cookie value is dead on the server too, not only removed from the browser.
    user.cookies.set(app.state.settings.session_cookie, token)
    assert user.get("/api/auth/me").status_code == 401
    assert user.post("/api/auth/logout").status_code == 204


def test_expired_session_is_rejected(user: TestClient, app: FastAPI) -> None:
    with app.state.session_factory() as db:
        session = db.scalar(select(AuthSession))
        session.expires_at = session.created_at
        db.commit()
    assert user.get("/api/auth/me").status_code == 401


def test_update_own_name(user: TestClient) -> None:
    response = user.patch("/api/auth/me", json={"full_name": "Renamed User"})
    assert response.status_code == 200
    assert user.get("/api/auth/me").json()["full_name"] == "Renamed User"


def test_change_own_email_needs_the_current_password(
    user: TestClient, browser: Callable[[], TestClient]
) -> None:
    new_email = {"email": "Demo.New@Mail.com"}
    assert user.patch("/api/auth/me", json=new_email).status_code == 400
    wrong = user.patch("/api/auth/me", json={**new_email, "current_password": "nope"})
    assert wrong.status_code == 400
    assert user.get("/api/auth/me").json()["email"] == USER["email"]

    taken = user.patch("/api/auth/me", json={"email": ADMIN["email"], "current_password": "user"})
    assert taken.status_code == 409
    invalid = user.patch("/api/auth/me", json={"email": "nope", "current_password": "user"})
    assert invalid.status_code == 422

    ok = user.patch(
        "/api/auth/me",
        json={**new_email, "full_name": "Demo New", "current_password": "user"},
    )
    assert ok.status_code == 200, ok.text
    assert (ok.json()["email"], ok.json()["full_name"]) == ("demo.new@mail.com", "Demo New")
    assert user.get("/api/auth/me").status_code == 200  # still signed in
    assert browser().post("/api/auth/login", json=USER).status_code == 401  # old email is gone
    sign_in(browser(), {"email": "demo.new@mail.com", "password": "user"})


def test_keeping_the_same_email_needs_no_password(user: TestClient) -> None:
    same = user.patch("/api/auth/me", json={"email": "USER@gmail.com", "full_name": "Same Mail"})
    assert same.status_code == 200
    assert same.json()["full_name"] == "Same Mail"


def test_a_user_cannot_edit_their_own_role_or_status(user: TestClient) -> None:
    response = user.patch(
        "/api/auth/me", json={"full_name": "Sneaky", "role": "admin", "is_active": False}
    )
    assert response.status_code == 200
    me = user.get("/api/auth/me").json()
    assert (me["role"], me["is_active"]) == ("user", True)


def test_change_own_password(user: TestClient, browser: Callable[[], TestClient]) -> None:
    other_browser = sign_in(browser(), USER)
    new_password = "a-much-better-one"

    wrong = user.post(
        "/api/auth/me/password", json={"current_password": "nope", "new_password": new_password}
    )
    assert wrong.status_code == 400
    weak = user.post(
        "/api/auth/me/password", json={"current_password": "user", "new_password": "123"}
    )
    assert weak.status_code == 422

    ok = user.post(
        "/api/auth/me/password", json={"current_password": "user", "new_password": new_password}
    )
    assert ok.status_code == 204
    assert user.get("/api/auth/me").status_code == 200  # this browser stays signed in
    assert other_browser.get("/api/auth/me").status_code == 401  # the others do not
    assert browser().post("/api/auth/login", json=USER).status_code == 401
    sign_in(browser(), {"email": USER["email"], "password": new_password})


def test_anonymous_access_is_refused(anonymous: TestClient) -> None:
    for path in ("/api/auth/me", "/api/admin/users", "/api/admin/stats", "/api/catalog/drugs"):
        assert anonymous.get(path).status_code == 401, path
    assert anonymous.get("/api/health").json() == {"status": "ok"}
