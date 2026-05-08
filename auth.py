from datetime import datetime, timezone
import sqlite3

from flask import flash, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from audit import record_action


def register_auth_routes(app, get_db, limiter):
    @app.route("/register", methods=["GET", "POST"])
    def register():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            confirm_password = request.form.get("confirm_password", "")

            if not username or not password or not confirm_password:
                flash("All fields are required.", "danger")
                return render_template("register.html", username=username)

            if password != confirm_password:
                flash("Passwords do not match.", "danger")
                return render_template("register.html", username=username)

            db = get_db()
            user_count = db.execute(
                "SELECT COUNT(*) AS count FROM users"
            ).fetchone()["count"]
            is_admin = 1 if user_count == 0 else 0
            hashed_password = generate_password_hash(password, method="pbkdf2:sha256")

            try:
                db.execute(
                    """
                    INSERT INTO users (username, hashed_password, is_admin)
                    VALUES (?, ?, ?)
                    """,
                    (username, hashed_password, is_admin),
                )
                db.commit()
            except sqlite3.IntegrityError:
                flash("That username is already registered.", "danger")
                return render_template("register.html", username=username)

            if is_admin:
                flash("Registration successful. Your account is the admin account.", "success")
            else:
                flash("Registration successful. Please log in.", "success")
            return redirect(url_for("login"))

        return render_template("register.html")

    @app.route("/login", methods=["GET", "POST"])
    @limiter.limit(
        "5 per minute",
        methods=["POST"],
        deduct_when=lambda response: response.status_code == 401,
    )
    def login():
        if request.method == "POST":
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            db = get_db()
            user = db.execute(
                "SELECT * FROM users WHERE username = ?",
                (username,),
            ).fetchone()

            if user is None or not check_password_hash(user["hashed_password"], password):
                flash("Invalid username or password.", "danger")
                return render_template("login.html", username=username), 401

            last_login_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            db.execute(
                "UPDATE users SET last_login_at = ? WHERE id = ?",
                (last_login_at, user["id"]),
            )
            db.commit()

            session.clear()
            session["user_id"] = user["id"]
            session["username"] = user["username"]
            session["is_admin"] = bool(user["is_admin"])
            session["last_login_at"] = last_login_at
            record_action(
                username=user["username"],
                action="LOGIN",
                filename="N/A",
                file_hash="N/A",
                ip_address=request.remote_addr,
            )
            flash("Logged in successfully.", "success")
            return redirect(url_for("dashboard"))

        return render_template("login.html")

    @app.route("/logout")
    def logout():
        username = session.get("username")
        if username:
            record_action(
                username=username,
                action="LOGOUT",
                filename="N/A",
                file_hash="N/A",
                ip_address=request.remote_addr,
            )
        session.clear()
        flash("You have been logged out.", "info")
        return redirect(url_for("login"))
