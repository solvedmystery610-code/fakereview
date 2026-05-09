from collections import Counter, defaultdict, deque
from datetime import datetime, timedelta
import hashlib
import json
import logging
import os
import re
import secrets
import smtplib
import ssl
from threading import Lock
from email.message import EmailMessage
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from bson import ObjectId
from flask import Flask, g, jsonify, request
from flask_cors import CORS

from analyzer import (
    analyze_review,
    compute_simhash,
    get_model_details,
    get_model_status,
    hamming_distance,
    normalize_text,
    simhash_bands,
    warm_model_async,
)
from database import (
    audit_logs_collection,
    download_logs_collection,
    feedback_collection,
    request_logs_collection,
    reviews_collection,
    upload_logs_collection,
    users_collection,
)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


ADMIN_USERNAME = "solvedmystery610@gmail.com"
ADMIN_PASSWORD = "@Steam0786"
SIMHASH_CACHE_SIZE = 1000
ACTIVE_WINDOW_DAYS = 14
DEFAULT_DAILY_LIMIT = 1000
MAX_BATCH_REVIEWS_PER_REQUEST = 1000
VERIFICATION_TOKEN_HOURS = 24
OTP_EXPIRY_MINUTES = 10
APP_NAME = "FakeReviewAI"

SIMHASH_CACHE = deque(maxlen=SIMHASH_CACHE_SIZE)
CACHE_LOCK = Lock()

logging.basicConfig(
    filename="server.log",
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

STOPWORDS = {
    "the", "and", "for", "with", "this", "that", "have", "from", "they",
    "were", "been", "will", "would", "there", "their", "about", "into",
    "after", "before", "your", "you", "really", "very", "just", "much",
    "them", "because", "while", "when", "where", "what", "which", "then",
    "than", "also", "some", "more", "most", "only", "over", "under",
    "feel", "like", "wearing", "using", "used", "review", "product",
}
TOKEN_RE = re.compile(r"[a-zA-Z0-9']+")
EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send"
GOOGLE_TOKENINFO_ENDPOINT = "https://oauth2.googleapis.com/tokeninfo"
ENV_CACHE = None


def load_local_env():
    global ENV_CACHE
    if ENV_CACHE is not None:
        return ENV_CACHE

    env_values = {}
    candidates = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", "frontend", ".env"),
    ]

    for path in candidates:
        try:
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle:
                    raw = line.strip()
                    if not raw or raw.startswith("#") or "=" not in raw:
                        continue
                    key, value = raw.split("=", 1)
                    env_values.setdefault(key.strip(), value.strip().strip("\"'"))
        except OSError:
            continue

    ENV_CACHE = env_values
    return ENV_CACHE


def get_setting(*keys, default=""):
    local_env = load_local_env()
    for key in keys:
        value = os.getenv(key) or local_env.get(key)
        if value:
            return value
    return default


def get_email_template_id(event_type):
    event_template_keys = {
        "login_otp": ("EMAILJS_LOGIN_OTP_TEMPLATE_ID", "VITE_EMAILJS_LOGIN_OTP_TEMPLATE_ID"),
        "verification_otp": (
            "EMAILJS_VERIFICATION_OTP_TEMPLATE_ID",
            "VITE_EMAILJS_VERIFICATION_OTP_TEMPLATE_ID",
        ),
        "verification_link": (
            "EMAILJS_VERIFICATION_TEMPLATE_ID",
            "VITE_EMAILJS_VERIFICATION_TEMPLATE_ID",
        ),
        "login_success": (
            "EMAILJS_LOGIN_NOTIFICATION_TEMPLATE_ID",
            "VITE_EMAILJS_LOGIN_NOTIFICATION_TEMPLATE_ID",
        ),
    }
    template_keys = event_template_keys.get(event_type, ())
    if template_keys:
        template_id = get_setting(*template_keys, default="")
        if template_id:
            return template_id
    return get_setting("EMAILJS_TEMPLATE_ID", "VITE_EMAILJS_TEMPLATE_ID")


def now_local():
    return datetime.now()


def now_string():
    return now_local().strftime("%Y-%m-%d %H:%M:%S")


def parse_timestamp(value):
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            return datetime.strptime(str(value), fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(str(value).replace("Z", ""))
    except ValueError:
        return None


def format_timestamp(value):
    parsed = parse_timestamp(value)
    if parsed:
        return parsed.strftime("%Y-%m-%d %H:%M:%S")
    return value or None


def get_request_ip():
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


def extract_keywords(text, limit=5):
    tokens = [token.lower() for token in TOKEN_RE.findall(text or "")]
    filtered = [token for token in tokens if len(token) >= 4 and token not in STOPWORDS]
    if not filtered:
        return []
    counts = Counter(filtered)
    return [token for token, _ in counts.most_common(limit)]


def serialize_doc(doc):
    if not doc:
        return {}
    data = dict(doc)
    if "_id" in data:
        data["id"] = str(data.pop("_id"))
    for key, value in list(data.items()):
        if isinstance(value, datetime):
            data[key] = format_timestamp(value)
    return data


def user_projection():
    return {
        "password": 0,
        "verification_token_hash": 0,
        "email_otp_hash": 0,
        "login_otp_hash": 0,
    }


def normalize_user_record(doc):
    user = serialize_doc(doc)
    user.setdefault("created_at", None)
    user.setdefault("last_login_at", None)
    user.setdefault("last_activity_at", None)
    user.setdefault("login_count", 0)
    user.setdefault("status", "active")
    user.setdefault("role", "Admin" if user.get("is_admin") else "Normal user")
    user.setdefault("usage_limit_per_day", DEFAULT_DAILY_LIMIT)
    user.setdefault("plan", "Free")
    user.setdefault("display_name", user.get("username"))
    user.setdefault("email_verified", True)
    user.setdefault("email_verified_at", None)
    return user


def hash_token(token):
    return hashlib.sha256((token or "").encode("utf-8")).hexdigest()


def is_email_verified(user):
    if not user:
        return False
    return bool(user.get("email_verified", True))


def issue_verification_token(user):
    username = (user or {}).get("username")
    if not username:
        raise ValueError("username required for verification token")

    token = secrets.token_urlsafe(32)
    expires_at = now_local() + timedelta(hours=VERIFICATION_TOKEN_HOURS)
    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "email_verified": False,
                "verification_token_hash": hash_token(token),
                "verification_expires_at": expires_at,
                "verification_sent_at": now_string(),
            },
            "$inc": {"verification_email_count": 1},
        },
    )
    return {
        "verification_required": True,
        "verification_token": token,
        "verification_expires_at": format_timestamp(expires_at),
        "email": username,
        "display_name": user.get("display_name") or username.split("@")[0],
    }


def build_app_base_url():
    base_url = get_setting(
        "APP_BASE_URL",
        "FRONTEND_APP_BASE_URL",
        "VITE_APP_BASE_URL",
        default="http://localhost:5173",
    )
    return (base_url or "http://localhost:5173").rstrip("/")


def build_verification_url(token, email):
    base_url = build_app_base_url()
    query = urllib_parse.urlencode({"token": token, "email": email})
    return f"{base_url}/verify?{query}"


def clear_verification_token(username):
    if not username:
        return
    users_collection.update_one(
        {"username": username},
        {
            "$unset": {
                "verification_token_hash": "",
                "verification_expires_at": "",
                "verification_sent_at": "",
            }
        },
    )


def issue_email_otp(user, reason="verify_email"):
    username = (user or {}).get("username")
    if not username:
        raise ValueError("username required for otp")

    otp_code = f"{secrets.randbelow(1000000):06d}"
    expires_at = now_local() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "email_otp_hash": hash_token(otp_code),
                "email_otp_expires_at": expires_at,
                "email_otp_sent_at": now_string(),
                "email_otp_reason": reason,
            },
            "$inc": {"email_otp_count": 1},
        },
    )
    print(f"\n[DEBUG] OTP for {username}: {otp_code}\n")
    return {
        "email": username,
        "display_name": user.get("display_name") or username.split("@")[0],
        "otp_code": otp_code,
        "otp_expires_at": format_timestamp(expires_at),
        "otp_required": True,
    }


def clear_email_otp(username):
    if not username:
        return
    users_collection.update_one(
        {"username": username},
        {
            "$unset": {
                "email_otp_hash": "",
                "email_otp_expires_at": "",
                "email_otp_sent_at": "",
                "email_otp_reason": "",
            }
        },
    )


def build_user_doc(username, password, display_name):
    is_admin_user = username == ADMIN_USERNAME
    created_at = now_string()
    return {
        "username": username,
        "password": password,
        "display_name": display_name,
        "created_at": created_at,
        "last_login_at": None,
        "last_activity_at": created_at,
        "login_count": 0,
        "is_admin": is_admin_user,
        "role": "Admin" if is_admin_user else "Normal user",
        "status": "active",
        "usage_limit_per_day": DEFAULT_DAILY_LIMIT,
        "plan": "Enterprise" if is_admin_user else "Free",
        "email_verified": is_admin_user,
        "email_verified_at": created_at if is_admin_user else None,
        "verification_token_hash": None,
        "verification_expires_at": None,
        "verification_sent_at": None,
        "verification_email_count": 0,
        "email_otp_hash": None,
        "email_otp_expires_at": None,
        "email_otp_sent_at": None,
        "email_otp_reason": None,
        "email_otp_count": 0,
        "auth_provider": "password",
    }


def prepare_signup_user(username, password, display_name):
    existing_user = users_collection.find_one({"username": username})
    if existing_user:
        if is_email_verified(existing_user):
            raise ValueError("User already exists")

        users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "password": password,
                    "display_name": display_name,
                    "last_activity_at": now_string(),
                }
            },
        )
        return users_collection.find_one({"username": username}), False

    user_doc = build_user_doc(username, password, display_name)
    users_collection.insert_one(user_doc)
    logging.info("New user registered: %s", username)
    record_audit(
        username,
        "register_started",
        username,
        {"display_name": display_name, "email_verified": user_doc["email_verified"]},
    )
    return user_doc, True


def issue_login_otp(user):
    username = (user or {}).get("username")
    if not username:
        raise ValueError("username required for login otp")

    otp_code = f"{secrets.randbelow(1000000):06d}"
    expires_at = now_local() + timedelta(minutes=OTP_EXPIRY_MINUTES)
    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "login_otp_hash": hash_token(otp_code),
                "login_otp_expires_at": expires_at,
                "login_otp_sent_at": now_string(),
            },
            "$inc": {"login_otp_count": 1},
        },
    )
    print(f"\n[DEBUG] Login OTP for {username}: {otp_code}\n")
    return {
        "email": username,
        "display_name": user.get("display_name") or username.split("@")[0],
        "otp_code": otp_code,
        "otp_expires_at": format_timestamp(expires_at),
        "otp_required": True,
    }


def clear_login_otp(username):
    if not username:
        return
    users_collection.update_one(
        {"username": username},
        {
            "$unset": {
                "login_otp_hash": "",
                "login_otp_expires_at": "",
                "login_otp_sent_at": "",
            }
        },
    )


def send_email_message(
    *,
    to_email,
    to_name="",
    subject="",
    message="",
    event_type="notification",
    otp_code="",
    extra=None,
):
    smtp_host = get_setting("SMTP_HOST", default="")
    smtp_port = int(get_setting("SMTP_PORT", default="465") or "465")
    smtp_user = get_setting("SMTP_USER", "SMTP_EMAIL", default="")
    smtp_password = get_setting("SMTP_PASSWORD", default="")
    smtp_from = get_setting("SMTP_FROM_EMAIL", default=smtp_user)

    if smtp_host and smtp_user and smtp_password and "your_email" not in smtp_user:
        email_message = EmailMessage()
        email_message["Subject"] = subject or f"{APP_NAME} Notification"
        email_message["From"] = smtp_from or smtp_user
        email_message["To"] = to_email
        email_message.set_content(message or "")

        try:
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context(), timeout=20)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=20)
                server.starttls(context=ssl.create_default_context())
            
            with server:
                server.login(smtp_user, smtp_password)
                server.send_message(email_message)
            return
        except Exception as exc:
            logging.error("SMTP send failed: %s", exc)
            # Fallback to EmailJS or raise error


    service_id = get_setting("EMAILJS_SERVICE_ID", "VITE_EMAILJS_SERVICE_ID")
    template_id = get_email_template_id(event_type)
    public_key = get_setting("EMAILJS_PUBLIC_KEY", "VITE_EMAILJS_PUBLIC_KEY")
    private_key = get_setting("EMAILJS_PRIVATE_KEY", "EMAILJS_ACCESS_TOKEN")
    app_base_url = build_app_base_url()

    if not service_id or not template_id or not public_key:
        missing = []
        if not service_id: missing.append("SERVICE_ID")
        if not template_id: missing.append("TEMPLATE_ID")
        if not public_key: missing.append("PUBLIC_KEY")
        logging.warning("EmailJS is missing keys: %s. Skipping email send.", ", ".join(missing))
        return


    payload = {
        "service_id": service_id,
        "template_id": template_id,
        "user_id": public_key,
        "template_params": {
            "to_email": to_email,
            "email": to_email,
            "user_email": to_email,
            "to_name": to_name or to_email,
            "user_name": to_name or to_email,
            "subject": subject or f"{APP_NAME} Notification",
            "message": message,
            "otp_code": otp_code,
            "verification_code": otp_code,
            "event_type": event_type,
            "app_name": APP_NAME,
            "email_subject": subject or f"{APP_NAME} Notification",
            "email_message": message,
            "is_login_otp": str(event_type == "login_otp").lower(),
            "is_verification_otp": str(event_type == "verification_otp").lower(),
            "is_verification_link": str(event_type == "verification_link").lower(),
            "is_login_success": str(event_type == "login_success").lower(),
        },
    }
    if private_key:
        payload["accessToken"] = private_key

    if extra:
        payload["template_params"].update(extra)

    request_body = json.dumps(payload).encode("utf-8")
    email_request = urllib_request.Request(
        EMAILJS_ENDPOINT,
        data=request_body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json, text/plain, */*",
            # Cloudflare-backed APIs often block the default Python-urllib signature.
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/123.0.0.0 Safari/537.36"
            ),
            "Origin": app_base_url,
            "Referer": f"{app_base_url}/",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(email_request, timeout=15) as response:
            response.read()
    except urllib_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(details or "Email service returned an error.") from exc
    except Exception as exc:
        raise RuntimeError(str(exc) or "Email request failed.") from exc


def send_otp_email(user, otp_payload):
    send_email_message(
        to_email=otp_payload.get("email"),
        to_name=otp_payload.get("display_name"),
        subject=f"{APP_NAME} verification code",
        message=(
            f"Your {APP_NAME} verification code is {otp_payload.get('otp_code')}. "
            f"It expires in {OTP_EXPIRY_MINUTES} minutes."
        ),
        event_type="verification_otp",
        otp_code=otp_payload.get("otp_code"),
        extra={
            "otp_expires_at": otp_payload.get("otp_expires_at"),
            "display_name": otp_payload.get("display_name"),
        },
    )


def send_verification_email(user, verification_payload):
    verification_link = build_verification_url(
        verification_payload.get("verification_token"),
        verification_payload.get("email"),
    )
    print(f"\n[DEBUG] Verification link for {verification_payload.get('email')}: {verification_link}\n")
    send_email_message(
        to_email=verification_payload.get("email"),
        to_name=verification_payload.get("display_name"),
        subject=f"{APP_NAME} email verification",
        message=(
            f"Please verify your email for {APP_NAME} by clicking this link: "
            f"{verification_link}. This link expires in {VERIFICATION_TOKEN_HOURS} hours."
        ),
        event_type="verification_link",
        extra={
            "verification_link": verification_link,
            "verification_url": verification_link,
            "verification_expires_at": verification_payload.get(
                "verification_expires_at"
            ),
            "display_name": verification_payload.get("display_name"),
        },
    )


def send_login_otp_email(user, otp_payload):
    send_email_message(
        to_email=otp_payload.get("email"),
        to_name=otp_payload.get("display_name"),
        subject=f"{APP_NAME} login code",
        message=(
            f"Your {APP_NAME} login OTP is {otp_payload.get('otp_code')}. "
            f"It expires in {OTP_EXPIRY_MINUTES} minutes."
        ),
        event_type="login_otp",
        otp_code=otp_payload.get("otp_code"),
        extra={
            "otp_expires_at": otp_payload.get("otp_expires_at"),
            "display_name": otp_payload.get("display_name"),
            "login_otp": otp_payload.get("otp_code"),
        },
    )


def send_login_notification(user, login_time, source="password"):
    username = (user or {}).get("username")
    if not username:
        return {"sent": False, "warning": "Login email skipped: username missing."}

    try:
        send_email_message(
            to_email=username,
            to_name=user.get("display_name") or username.split("@")[0],
            subject=f"{APP_NAME} login alert",
            message=(
                f"Your account logged in successfully on {login_time} from IP {get_request_ip()} "
                f"using {source} sign-in."
            ),
            event_type="login_success",
            extra={
                "login_time": login_time,
                "login_ip": get_request_ip(),
                "login_method": source,
            },
        )
        return {"sent": True}
    except Exception as exc:
        logging.warning("Login notification email failed for %s: %s", username, exc)
        return {"sent": False, "warning": str(exc)}


def verify_google_credential(credential):
    if not credential:
        raise ValueError("Google credential required")

    expected_client_id = get_setting("GOOGLE_CLIENT_ID", "VITE_GOOGLE_CLIENT_ID")
    if not expected_client_id:
        logging.error("GOOGLE_CLIENT_ID not found in environment settings!")
        raise RuntimeError("Google sign-in is not configured on the server.")

    logging.info("Verifying Google token for Client ID: %s...", expected_client_id[:10] + "...")
    query = urllib_parse.urlencode({"id_token": credential})

    token_request = urllib_request.Request(
        f"{GOOGLE_TOKENINFO_ENDPOINT}?{query}",
        method="GET",
    )

    try:
        with urllib_request.urlopen(token_request, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        raise ValueError("Google sign-in token was rejected.") from exc
    except Exception as exc:
        raise RuntimeError("Google sign-in could not be verified.") from exc

    audience = payload.get("aud")
    if audience != expected_client_id:
        raise ValueError("Google sign-in client id does not match this app.")

    if payload.get("email_verified") not in {"true", True}:
        raise ValueError("Google account email is not verified.")

    return payload


@app.errorhandler(Exception)
def handle_exception(e):
    logging.exception("Unhandled exception occurred: %s", e)
    return jsonify({"error": str(e)}), 500


def record_audit(actor, action, target, details=None):
    audit_logs_collection.insert_one({
        "actor": actor or "system",
        "action": action,
        "target": target,
        "details": details or {},
        "ip": get_request_ip(),
        "timestamp": now_string(),
    })


def build_login_response(user, login_time, source="password"):
    username = user.get("username")
    users_collection.update_one(
        {"username": username},
        {
            "$set": {"last_login_at": login_time, "last_activity_at": login_time},
            "$inc": {"login_count": 1},
        },
    )

    notification_state = send_login_notification(user, login_time, source=source)
    response = {
        "message": "Login success",
        "username": username,
        "display_name": user.get("display_name") or username,
        "login_time": login_time,
        "is_admin": bool(user.get("is_admin")),
        "role": user.get("role", "Normal user"),
        "status": user.get("status", "active"),
        "auth_provider": user.get("auth_provider", source),
        "login_notification_sent": notification_state.get("sent", False),
    }
    if notification_state.get("warning"):
        response["login_notification_warning"] = notification_state["warning"]

    record_audit(username, "login", username, {"success": True, "source": source})
    return response


def is_admin(username):
    if not username:
        return False
    user = users_collection.find_one({"username": username}, {"is_admin": 1})
    return bool(user and user.get("is_admin"))


def require_admin(username):
    if not is_admin(username):
        return jsonify({"error": "Unauthorized"}), 403
    return None


def scan_cache(normalized, simhash_value):
    if not normalized or not simhash_value:
        return {"exact": False, "near": False, "distance": None, "matched_review": None}

    best_distance = None
    best_review = None
    with CACHE_LOCK:
        for item in SIMHASH_CACHE:
            if item.get("norm") == normalized:
                return {
                    "exact": True,
                    "near": True,
                    "distance": 0,
                    "matched_review": item.get("review"),
                }
            distance = hamming_distance(simhash_value, item.get("simhash", 0))
            if best_distance is None or distance < best_distance:
                best_distance = distance
                best_review = item.get("review")
    return {
        "exact": False,
        "near": best_distance is not None and best_distance <= 8,
        "distance": best_distance,
        "matched_review": best_review,
    }


def cache_add(normalized, simhash_value, review_text):
    if not normalized or not simhash_value:
        return
    with CACHE_LOCK:
        SIMHASH_CACHE.append({"norm": normalized, "simhash": simhash_value, "review": review_text})


def find_duplicate_info(review_text, limit=300):
    normalized = normalize_text(review_text)
    if not normalized:
        return {
            "exact": False,
            "near": False,
            "distance": None,
            "simhash": None,
            "simhash_value": None,
            "bands": [],
            "normalized": normalized,
            "matched_review": None,
        }

    simhash_value = compute_simhash(review_text)
    simhash_hex = f"{simhash_value:016x}" if simhash_value else None
    bands = simhash_bands(simhash_value)
    cache_result = scan_cache(normalized, simhash_value)
    if cache_result.get("exact"):
        return {
            "exact": True,
            "near": True,
            "distance": 0,
            "simhash": simhash_hex,
            "simhash_value": simhash_value,
            "bands": bands,
            "normalized": normalized,
            "matched_review": cache_result.get("matched_review"),
        }

    exact_match = reviews_collection.find_one({"norm_review": normalized}, {"review": 1, "simhash": 1})
    if exact_match:
        return {
            "exact": True,
            "near": True,
            "distance": 0,
            "simhash": simhash_hex,
            "simhash_value": simhash_value,
            "bands": bands,
            "normalized": normalized,
            "matched_review": exact_match.get("review"),
        }

    best_distance = cache_result.get("distance")
    best_review = cache_result.get("matched_review")
    if bands:
        cursor = reviews_collection.find(
            {"simhash_bands": {"$in": bands}},
            {"review": 1, "simhash": 1},
        ).sort("timestamp", -1).limit(limit)
        for doc in cursor:
            stored = doc.get("simhash")
            if not stored:
                continue
            try:
                stored_value = int(str(stored), 16)
            except ValueError:
                continue
            distance = hamming_distance(simhash_value, stored_value)
            if best_distance is None or distance < best_distance:
                best_distance = distance
                best_review = doc.get("review")
                if best_distance <= 3:
                    break

    return {
        "exact": False,
        "near": best_distance is not None and best_distance <= 8,
        "distance": best_distance,
        "simhash": simhash_hex,
        "simhash_value": simhash_value,
        "bands": bands,
        "normalized": normalized,
        "matched_review": best_review,
    }


def create_demo_user():
    users_collection.delete_many({"username": "admin@gmail.com"})
    users_collection.update_one(
        {"username": ADMIN_USERNAME},
        {
            "$set": {
                "username": ADMIN_USERNAME,
                "password": ADMIN_PASSWORD,
                "is_admin": True,
                "role": "Admin",
                "status": "active",
                "display_name": "Primary Admin",
                "usage_limit_per_day": DEFAULT_DAILY_LIMIT,
                "plan": "Enterprise",
                "last_activity_at": now_string(),
                "email_verified": True,
                "email_verified_at": now_string(),
                "auth_provider": "password",
                "verification_token_hash": None,
                "verification_expires_at": None,
            },
            "$setOnInsert": {
                "created_at": now_string(),
                "login_count": 0,
                "last_login_at": None,
            },
        },
        upsert=True,
    )
    logging.info("Admin user ready -> %s", ADMIN_USERNAME)


def ensure_indexes():
    try:
        reviews_collection.create_index("norm_review")
        reviews_collection.create_index("simhash_bands")
        reviews_collection.create_index("timestamp")
        reviews_collection.create_index("username")
        request_logs_collection.create_index("timestamp")
        request_logs_collection.create_index("endpoint")
        request_logs_collection.create_index("username")
        request_logs_collection.create_index("ip")
        download_logs_collection.create_index("timestamp")
        upload_logs_collection.create_index("timestamp")
        audit_logs_collection.create_index("timestamp")
        users_collection.create_index("username", unique=True)
        users_collection.create_index("verification_token_hash", sparse=True)
        users_collection.create_index("google_sub", sparse=True)
    except Exception as exc:
        logging.warning("Index creation failed: %s", exc)


def today_review_count(username):
    if not username or username == "guest":
        return 0
    start = now_local().replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    count = 0
    for doc in reviews_collection.find({"username": username}, {"timestamp": 1}):
        ts = parse_timestamp(doc.get("timestamp"))
        if ts and start <= ts < end:
            count += 1
    return count


def parse_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() not in {"", "0", "false", "no", "off"}
    return bool(value)


def coerce_rating(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def validate_analysis_access(username, persist, review_count=1):
    if not username or username == "guest":
        return None, None, None

    user = users_collection.find_one({"username": username})
    if user and user.get("status") == "blocked":
        return user, "Account is blocked by admin", 403

    limit = (user or {}).get("usage_limit_per_day", DEFAULT_DAILY_LIMIT)
    if not persist or limit is None:
        return user, None, None

    try:
        allowed = int(limit)
    except (TypeError, ValueError):
        allowed = DEFAULT_DAILY_LIMIT
    used_today = today_review_count(username)
    remaining = max(allowed - used_today, 0)

    if remaining <= 0:
        return user, f"Daily limit reached ({allowed} reviews/day)", 429
    if review_count > remaining:
        return user, f"Batch exceeds remaining daily limit ({remaining} reviews left today)", 429
    return user, None, None


def build_analysis_artifacts(review, rating, username="", platform="", category=""):
    duplicate_info = find_duplicate_info(review)
    analysis = analyze_review(review, rating, duplicate_info)

    response_data = {
        "result": analysis.get("status"),
        "status": analysis.get("status"),
        "confidence": analysis.get("confidence"),
        "sentiment": analysis.get("sentiment"),
        "analysis": analysis.get("analysis"),
        "reasons": analysis.get("analysis"),
        "signals": analysis.get("signals"),
        "model": analysis.get("model"),
        "prob_fake": analysis.get("prob_fake"),
        "duplicate": {
            "exact": duplicate_info.get("exact"),
            "near": duplicate_info.get("near"),
            "distance": duplicate_info.get("distance"),
        },
    }

    review_data = {
        "username": username or "guest",
        "review": review,
        "rating": rating,
        "platform": platform,
        "category": category,
        "result": analysis.get("status"),
        "confidence": analysis.get("confidence"),
        "sentiment": analysis.get("sentiment"),
        "word_count": analysis.get("word_count"),
        "reasons": analysis.get("analysis"),
        "signals": analysis.get("signals") or {},
        "language": (analysis.get("signals") or {}).get("language"),
        "model": analysis.get("model"),
        "prob_fake": analysis.get("prob_fake"),
        "norm_review": duplicate_info.get("normalized"),
        "simhash": duplicate_info.get("simhash"),
        "simhash_bands": duplicate_info.get("bands") or [],
        "timestamp": now_string(),
    }

    return {
        "analysis": analysis,
        "duplicate": duplicate_info,
        "response": response_data,
        "review_data": review_data,
    }


def build_batch_summary(results):
    total = len(results)
    fake = sum(1 for item in results if item.get("status") == "Fake")
    genuine = sum(1 for item in results if item.get("status") == "Genuine")
    avg_confidence = round(
        sum(float(item.get("confidence") or 0) for item in results) / total,
        2,
    ) if total else 0
    return {
        "total": total,
        "fake": fake,
        "genuine": genuine,
        "avg_confidence": avg_confidence,
    }


def compute_user_activity_map():
    review_counts = defaultdict(lambda: {"total": 0, "fake": 0, "genuine": 0, "last_review_at": None})
    for review in reviews_collection.find({}, {"username": 1, "result": 1, "timestamp": 1}):
        username = review.get("username") or "guest"
        review_counts[username]["total"] += 1
        if review.get("result") == "Fake":
            review_counts[username]["fake"] += 1
        else:
            review_counts[username]["genuine"] += 1
        ts = parse_timestamp(review.get("timestamp"))
        if ts and (review_counts[username]["last_review_at"] is None or ts > review_counts[username]["last_review_at"]):
            review_counts[username]["last_review_at"] = ts
    return review_counts


def compute_user_rows():
    counts = compute_user_activity_map()
    users = []
    for doc in users_collection.find({}, user_projection()):
        user = normalize_user_record(doc)
        username = user.get("username")
        review_stats = counts.get(username, {})
        user["total_reviews"] = review_stats.get("total", 0)
        user["fake_reviews"] = review_stats.get("fake", 0)
        user["genuine_reviews"] = review_stats.get("genuine", 0)
        user["last_review_at"] = format_timestamp(review_stats.get("last_review_at"))
        last_seen = parse_timestamp(user.get("last_activity_at")) or parse_timestamp(user.get("last_login_at"))
        user["activity_status"] = "Active" if last_seen and last_seen >= now_local() - timedelta(days=ACTIVE_WINDOW_DAYS) else "Inactive"
        users.append(user)
    users.sort(key=lambda item: ((item.get("is_admin") is not True), item.get("username", "")))
    return users


def compute_platform_stats():
    reviews = [serialize_doc(doc) for doc in reviews_collection.find({}, {})]
    total_reviews = len(reviews)
    fake_reviews = sum(1 for item in reviews if item.get("result") == "Fake")
    genuine_reviews = total_reviews - fake_reviews

    usage_by_day = []
    for offset in range(6, -1, -1):
        day = (now_local() - timedelta(days=offset)).date()
        count = 0
        for review in reviews:
            ts = parse_timestamp(review.get("timestamp"))
            if ts and ts.date() == day:
                count += 1
        usage_by_day.append({"date": day.strftime("%d %b"), "count": count})

    hourly_counts = [{"hour": f"{hour:02d}:00", "count": 0} for hour in range(24)]
    for log in request_logs_collection.find({"endpoint": "/analyze", "success": True}, {"timestamp": 1}):
        ts = parse_timestamp(log.get("timestamp"))
        if ts:
            hourly_counts[ts.hour]["count"] += 1

    peak = max(hourly_counts, key=lambda item: item["count"], default={"hour": "00:00", "count": 0})
    most_active = sorted(compute_user_rows(), key=lambda item: item.get("total_reviews", 0), reverse=True)[:5]
    model_details = get_model_details()
    accuracy = (
        model_details.get("metrics", {}).get("test", {}).get("accuracy")
        or model_details.get("metrics", {}).get("calibration", {}).get("accuracy")
        or model_details.get("metrics", {}).get("train", {}).get("accuracy")
    )

    return {
        "total_reviews": total_reviews,
        "fake_reviews": fake_reviews,
        "genuine_reviews": genuine_reviews,
        "fake_detection_accuracy": round((accuracy or 0) * 100, 2) if accuracy is not None else None,
        "daily_usage": usage_by_day,
        "weekly_usage": usage_by_day,
        "hourly_usage": hourly_counts,
        "peak_usage_time": peak,
        "most_active_users": most_active,
    }


def compute_download_stats():
    logs = [serialize_doc(doc) for doc in download_logs_collection.find({}, {}).sort("timestamp", -1).limit(100)]
    by_type = Counter(log.get("file_type", "unknown") for log in logs)
    return {
        "total_downloads": download_logs_collection.count_documents({}),
        "by_type": dict(by_type),
        "recent": logs[:20],
        "export_history": logs[:40],
    }


def compute_query_stats():
    logs = [
        serialize_doc(doc)
        for doc in request_logs_collection.find(
            {"endpoint": {"$in": ["/analyze", "/history", "/dashboard", "/model-status"]}},
            {},
        ).sort("timestamp", -1).limit(120)
    ]
    success_count = sum(1 for log in logs if log.get("success"))
    failed_count = len(logs) - success_count
    return {
        "recent": logs[:40],
        "successful": success_count,
        "failed": failed_count,
    }


def compute_upload_stats():
    logs = [serialize_doc(doc) for doc in upload_logs_collection.find({}, {}).sort("timestamp", -1).limit(100)]
    status_counts = Counter(log.get("status", "unknown") for log in logs)
    return {
        "total_uploads": upload_logs_collection.count_documents({}),
        "status_counts": dict(status_counts),
        "recent": logs[:30],
    }


def compute_api_usage():
    logs = [serialize_doc(doc) for doc in request_logs_collection.find({}, {}).sort("timestamp", -1).limit(500)]
    endpoint_counts = Counter(log.get("endpoint", "unknown") for log in logs)
    user_counts = Counter(log.get("username") or "anonymous" for log in logs)
    return {
        "total_requests": request_logs_collection.count_documents({}),
        "by_endpoint": dict(endpoint_counts.most_common(10)),
        "top_api_users": [{"username": name, "count": count} for name, count in user_counts.most_common(5)],
        "recent": logs[:50],
    }


def compute_suspicious_activity():
    suspicious = []
    now = now_local()
    recent_analyze_logs = list(
        request_logs_collection.find({"endpoint": "/analyze", "success": True}, {"username": 1, "timestamp": 1, "ip": 1})
    )
    user_last_hour = Counter()
    ip_usernames = defaultdict(set)

    for log in recent_analyze_logs:
        ts = parse_timestamp(log.get("timestamp"))
        if not ts:
            continue
        if ts >= now - timedelta(hours=1):
            user_last_hour[log.get("username") or "guest"] += 1
        if log.get("ip") and log.get("username"):
            ip_usernames[log.get("ip")].add(log.get("username"))

    for username, count in user_last_hour.items():
        if count >= 20:
            suspicious.append({
                "type": "rapid_reviews",
                "severity": "high" if count >= 35 else "medium",
                "message": f"{username} submitted {count} review analyses in the last hour.",
            })

    for ip, usernames in ip_usernames.items():
        if len(usernames) >= 3:
            suspicious.append({
                "type": "multi_account_ip",
                "severity": "medium",
                "message": f"IP {ip} is linked to multiple accounts: {', '.join(sorted(usernames)[:5])}.",
            })

    recent_logs = list(request_logs_collection.find({}, {"username": 1, "timestamp": 1}).sort("timestamp", -1).limit(250))
    burst_counter = Counter()
    for log in recent_logs:
        ts = parse_timestamp(log.get("timestamp"))
        if ts and ts >= now - timedelta(minutes=5):
            burst_counter[log.get("username") or "anonymous"] += 1
    for username, count in burst_counter.items():
        if count >= 25:
            suspicious.append({
                "type": "bot_like_behavior",
                "severity": "high",
                "message": f"{username} triggered {count} API requests within 5 minutes.",
            })

    return suspicious[:20]


def compute_notifications():
    notifications = []
    notifications.extend(compute_suspicious_activity()[:5])

    model_status = get_model_status()
    if not model_status.get("ready"):
        notifications.append({
            "type": "model",
            "severity": "high" if model_status.get("model") == "rule_fallback" else "medium",
            "message": model_status.get("error") or "Model is not ready.",
        })

    failed_recent = 0
    traffic_recent = 0
    for log in request_logs_collection.find({}, {"timestamp": 1, "success": 1}):
        ts = parse_timestamp(log.get("timestamp"))
        if not ts or ts < now_local() - timedelta(hours=1):
            continue
        traffic_recent += 1
        if not log.get("success"):
            failed_recent += 1

    if failed_recent >= 5:
        notifications.append({
            "type": "server_error",
            "severity": "medium",
            "message": f"{failed_recent} failed API requests were recorded in the last hour.",
        })
    if traffic_recent >= 80:
        notifications.append({
            "type": "high_traffic",
            "severity": "medium",
            "message": f"High traffic detected: {traffic_recent} requests in the last hour.",
        })

    return notifications[:12]


def build_admin_overview():
    platform_stats = compute_platform_stats()
    users = compute_user_rows()
    model_details = get_model_details()
    role_counts = Counter(user.get("role", "Normal user") for user in users)
    plan_counts = Counter(user.get("plan", "Free") for user in users)
    reviews = [serialize_doc(doc) for doc in reviews_collection.find({}, {}).sort("timestamp", -1).limit(80)]

    return {
        "generated_at": now_string(),
        "summary": {
            "total_users": len(users),
            "active_users": sum(1 for user in users if user.get("activity_status") == "Active"),
            "blocked_users": sum(1 for user in users if user.get("status") == "blocked"),
            "total_reviews": platform_stats["total_reviews"],
            "downloads": download_logs_collection.count_documents({}),
            "uploads": upload_logs_collection.count_documents({}),
            "alerts": len(compute_notifications()),
        },
        "users": users,
        "user_roles": dict(role_counts),
        "plans": dict(plan_counts),
        "platform": platform_stats,
        "downloads": compute_download_stats(),
        "queries": compute_query_stats(),
        "uploads": compute_upload_stats(),
        "suspicious_activity": compute_suspicious_activity(),
        "model": model_details,
        "notifications": compute_notifications(),
        "api_usage": compute_api_usage(),
        "audit_logs": [serialize_doc(doc) for doc in audit_logs_collection.find({}, {}).sort("timestamp", -1).limit(80)],
        "feedback": [serialize_doc(doc) for doc in feedback_collection.find({}, {}).sort("timestamp", -1).limit(80)],
        "reviews": reviews,
    }


@app.before_request
def before_request():
    g.started_at = now_local()


@app.after_request
def after_request(response):
    try:
        payload = request.get_json(silent=True) if request.method in {"POST", "PUT", "PATCH", "DELETE"} else {}
        payload = payload or {}
        username = payload.get("username") or payload.get("actor") or request.args.get("username")
        review_text = payload.get("review", "") if request.path == "/analyze" else ""
        response_data = response.get_json(silent=True) if response.is_json else {}
        request_logs_collection.insert_one({
            "username": username,
            "endpoint": request.path,
            "method": request.method,
            "ip": get_request_ip(),
            "success": response.status_code < 400,
            "status_code": response.status_code,
            "keywords": extract_keywords(review_text),
            "review_length": len(review_text or ""),
            "result": response_data.get("result") if isinstance(response_data, dict) else None,
            "error": response_data.get("error") if isinstance(response_data, dict) else None,
            "timestamp": now_string(),
            "duration_ms": round((now_local() - getattr(g, "started_at", now_local())).total_seconds() * 1000, 2),
        })
        if username:
            users_collection.update_one(
                {"username": username},
                {"$set": {"last_activity_at": now_string()}},
            )
    except Exception as exc:
        logging.warning("Request logging failed: %s", exc)
    return response


try:
    create_demo_user()
    ensure_indexes()
    warm_model_async()
except Exception as e:
    print(f"WARNING: Database initialization failed. Some features may be unavailable. Error: {e}")


@app.route("/")
def home():
    status = get_model_status()
    return jsonify({
        "message": "Fake Review Detection API Running",
        "status": "Active",
        "model": status.get("model"),
        "model_ready": status.get("ready"),
        "model_error": status.get("error"),
        "training_seconds": status.get("training_seconds"),
    })


@app.route("/model-status")
def model_status():
    return jsonify(get_model_status())


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password")
    otp_code = (data.get("otp") or "").strip()
    display_name = (data.get("display_name") or data.get("displayName") or username.split("@")[0]).strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    try:
        user_doc, created_now = prepare_signup_user(username, password, display_name)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if user_doc.get("is_admin"):
        users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "password": password,
                    "display_name": display_name,
                    "last_activity_at": now_string(),
                }
            },
        )
        return jsonify({"message": "Registered Successfully"})

    if not otp_code:
        return jsonify({
            "error": "OTP required. Click Send OTP first.",
            "otp_required": True,
            "email": username,
        }), 400

    otp_hash = user_doc.get("email_otp_hash")
    if not otp_hash or otp_hash != hash_token(otp_code):
        record_audit(username, "signup_otp_failed", username, {"reason": "mismatch"})
        return jsonify({"error": "Invalid OTP. Please try again."}), 400

    expires_at = parse_timestamp(user_doc.get("email_otp_expires_at"))
    if expires_at and expires_at < now_local():
        record_audit(username, "signup_otp_failed", username, {"reason": "expired"})
        return jsonify({"error": "OTP expired. Click Send OTP again."}), 400

    verified_at = now_string()
    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "password": password,
                "display_name": display_name,
                "email_verified": True,
                "email_verified_at": verified_at,
                "last_activity_at": verified_at,
            },
            "$unset": {
                "verification_token_hash": "",
                "verification_expires_at": "",
                "verification_sent_at": "",
            },
        },
    )
    clear_email_otp(username)
    record_audit(
        username,
        "register",
        username,
        {"display_name": display_name, "email_verified": True, "created_now": created_now},
    )
    return jsonify({
        "message": "Signup successful. Your email is verified now.",
        "email_verified": True,
        "username": username,
        "display_name": display_name,
    }), 201


@app.route("/register/request-otp", methods=["POST"])
def request_register_otp():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("email") or "").strip().lower()
    password = data.get("password")
    display_name = (
        data.get("display_name")
        or data.get("displayName")
        or username.split("@")[0]
    ).strip()

    if not username or not password:
        return jsonify({"error": "Email and password required"}), 400

    try:
        user_doc, created_now = prepare_signup_user(username, password, display_name)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    if user_doc.get("is_admin"):
        return jsonify({"error": "Admin account does not need signup OTP."}), 400

    otp_payload = issue_email_otp(user_doc, reason="register")
    try:
        send_otp_email(user_doc, otp_payload)
        otp_sent = True
        email_sent = True
        otp_error = None
    except Exception as exc:
        logging.warning("Signup OTP email failed for %s: %s", username, exc)
        otp_sent = True # OTP is still valid in DB/Logs
        email_sent = False
        otp_error = str(exc)

    record_audit(
        username,
        "verification_requested",
        username,
        {
            "reason": "register",
            "otp_sent": otp_sent,
            "created_now": created_now,
        },
    )
    response = {
        "message": "Signup OTP generated.",
        "otp_required": True,
        "otp_sent": otp_sent,
        "email_sent": email_sent,
        "email": username,
        "otp_expires_at": otp_payload.get("otp_expires_at"),
        "signup_pending": True,
    }
    if otp_error:
        response["email_error"] = otp_error
        response["message"] = "OTP generated but email failed. Check server logs."
    return jsonify(response), 200 if not created_now else 201


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip().lower()
    password = data.get("password")
    otp_code = (data.get("otp") or "").strip()

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    user = users_collection.find_one({"username": username})
    if user:
        if user.get("status") == "blocked":
            return jsonify({"error": "Account is blocked by admin"}), 403
        if user.get("auth_provider") == "google" and not user.get("password"):
            return jsonify({"error": "Use Google sign-in for this account."}), 400
        if user.get("password") != password:
            return jsonify({"error": "Wrong password"}), 401
        if not otp_code:
            return jsonify({
                "error": "OTP required. Click Send OTP first.",
                "otp_required": True,
                "email": username,
            }), 400

        otp_hash = user.get("login_otp_hash")
        if not otp_hash or otp_hash != hash_token(otp_code):
            record_audit(username, "login_otp_failed", username, {"reason": "mismatch"})
            return jsonify({"error": "Invalid OTP. Please try again."}), 400

        expires_at = parse_timestamp(user.get("login_otp_expires_at"))
        if expires_at and expires_at < now_local():
            record_audit(username, "login_otp_failed", username, {"reason": "expired"})
            return jsonify({"error": "OTP expired. Click Send OTP again."}), 400

        updates = {"last_activity_at": now_string()}
        if not is_email_verified(user):
            updates["email_verified"] = True
            updates["email_verified_at"] = now_string()

        if updates:
            users_collection.update_one({"username": username}, {"$set": updates})

        clear_login_otp(username)
        clear_email_otp(username)
        user = users_collection.find_one({"username": username}) or user
        login_time = now_string()
        return jsonify(build_login_response(user, login_time, source="email_otp"))

    return jsonify({"error": "Account not found. Please sign up first."}), 404


@app.route("/login/request-otp", methods=["POST"])
def request_login_otp():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("email") or "").strip().lower()
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Email and password required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Account not found. Please sign up first."}), 404
    if user.get("status") == "blocked":
        return jsonify({"error": "Account is blocked by admin"}), 403
    if user.get("auth_provider") == "google" and not user.get("password"):
        return jsonify({"error": "Use Google sign-in for this account."}), 400
    if user.get("password") != password:
        return jsonify({"error": "Wrong password"}), 401

    otp_payload = issue_login_otp(user)
    try:
        send_login_otp_email(user, otp_payload)
        otp_sent = True
        email_sent = True
        otp_error = None
    except Exception as exc:
        logging.warning("Login OTP email failed for %s: %s", username, exc)
        otp_sent = True
        email_sent = False
        otp_error = str(exc)

    record_audit(username, "login_otp_requested", username, {"otp_sent": otp_sent})
    response = {
        "message": "Login OTP generated.",
        "email": username,
        "otp_required": True,
        "otp_sent": otp_sent,
        "email_sent": email_sent,
        "otp_expires_at": otp_payload.get("otp_expires_at"),
    }
    if otp_error:
        response["email_error"] = otp_error
        response["message"] = "OTP generated but email failed. Check server logs."
    return jsonify(response)


@app.route("/login/verify-otp", methods=["POST"])
def verify_login_otp():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("email") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()

    if not username or not otp_code:
        return jsonify({"error": "Email and OTP required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Account not found. Please sign up first."}), 404
    if user.get("status") == "blocked":
        return jsonify({"error": "Account is blocked by admin"}), 403

    otp_hash = user.get("login_otp_hash")
    if not otp_hash or otp_hash != hash_token(otp_code):
        record_audit(username, "login_otp_failed", username, {"reason": "mismatch"})
        return jsonify({"error": "Invalid OTP. Please try again."}), 400

    expires_at = parse_timestamp(user.get("login_otp_expires_at"))
    if expires_at and expires_at < now_local():
        record_audit(username, "login_otp_failed", username, {"reason": "expired"})
        return jsonify({"error": "OTP expired. Request a new login OTP."}), 400

    updates = {"last_activity_at": now_string()}
    if not is_email_verified(user):
        updates["email_verified"] = True
        updates["email_verified_at"] = now_string()

    if updates:
        users_collection.update_one({"username": username}, {"$set": updates})

    clear_login_otp(username)
    clear_email_otp(username)
    user = users_collection.find_one({"username": username}) or user
    record_audit(username, "login_otp_verified", username, {"success": True})
    login_time = now_string()
    return jsonify(build_login_response(user, login_time, source="email_otp"))


@app.route("/verify-email/resend", methods=["POST"])
def resend_verification_email():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("email") or "").strip().lower()

    if not username:
        return jsonify({"error": "Email required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Account not found. Please sign up first."}), 404
    if user.get("status") == "blocked":
        return jsonify({"error": "Account is blocked by admin"}), 403
    if is_email_verified(user):
        return jsonify({"message": "Email already verified.", "email_verified": True})

    verification_payload = issue_verification_token(user)
    try:
        send_verification_email(user, verification_payload)
        verification_sent = True
        verification_error = None
    except Exception as exc:
        logging.warning("Verification resend failed for %s: %s", username, exc)
        verification_sent = False
        verification_error = str(exc)

    record_audit(
        username,
        "verification_requested",
        username,
        {"reason": "resend", "verification_sent": verification_sent},
    )
    return jsonify({
        "message": "Verification email prepared.",
        "email": username,
        "verification_required": True,
        "verification_sent": verification_sent,
        "verification_expires_at": verification_payload.get(
            "verification_expires_at"
        ),
        "email_error": verification_error,
    })


@app.route("/verify-email/request-otp", methods=["POST"])
def request_verification_otp():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or data.get("email") or "").strip().lower()

    if not username:
        return jsonify({"error": "Email required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Account not found. Please sign up first."}), 404
    if user.get("status") == "blocked":
        return jsonify({"error": "Account is blocked by admin"}), 403
    if is_email_verified(user):
        return jsonify({"message": "Email already verified.", "email_verified": True})

    otp_payload = issue_email_otp(user, reason="verify_email")
    try:
        send_otp_email(user, otp_payload)
        otp_sent = True
        otp_error = None
    except Exception as exc:
        logging.warning("Verification OTP email failed for %s: %s", username, exc)
        otp_sent = False
        otp_error = str(exc)

    record_audit(
        username,
        "verification_requested",
        username,
        {"reason": "verify_email_otp", "otp_sent": otp_sent},
    )
    response = {
        "message": "Verification OTP generated.",
        "email": username,
        "otp_required": True,
        "otp_sent": otp_sent,
        "otp_expires_at": otp_payload.get("otp_expires_at"),
    }
    if otp_error:
        response["email_error"] = otp_error
    return jsonify(response)


@app.route("/verify-email/confirm-otp", methods=["POST"])
def confirm_verification_email_otp():
    data = request.get_json(silent=True) or {}
    username = (data.get("email") or data.get("username") or "").strip().lower()
    otp_code = (data.get("otp") or "").strip()

    if not username or not otp_code:
        return jsonify({"error": "Email and OTP required"}), 400

    user = users_collection.find_one({"username": username})
    if not user:
        return jsonify({"error": "Account not found. Please sign up first."}), 404
    if is_email_verified(user):
        return jsonify({"message": "Email already verified.", "email_verified": True})

    otp_hash = user.get("email_otp_hash")
    if not otp_hash or otp_hash != hash_token(otp_code):
        record_audit(username, "email_otp_failed", username, {"reason": "mismatch"})
        return jsonify({"error": "Invalid OTP. Please try again."}), 400

    expires_at = parse_timestamp(user.get("email_otp_expires_at"))
    if expires_at and expires_at < now_local():
        record_audit(username, "email_otp_failed", username, {"reason": "expired"})
        return jsonify({"error": "OTP expired. Request a new one."}), 400

    verified_at = now_string()
    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "email_verified": True,
                "email_verified_at": verified_at,
                "last_activity_at": verified_at,
            },
        },
    )
    clear_email_otp(username)
    record_audit(username, "email_verified", username, {"success": True, "method": "otp"})
    return jsonify({
        "message": "Email verified successfully. You can log in now.",
        "email_verified": True,
        "username": username,
    })


@app.route("/verify-email/confirm", methods=["POST"])
def confirm_verification_email():
    data = request.get_json(silent=True) or {}
    token = (data.get("token") or "").strip()
    username = (data.get("email") or data.get("username") or "").strip().lower()

    if not token:
        return jsonify({"error": "Verification token required"}), 400

    query = {"verification_token_hash": hash_token(token)}
    if username:
        query["username"] = username

    user = users_collection.find_one(query)
    if not user:
        if username:
            existing_user = users_collection.find_one({"username": username})
            if existing_user and is_email_verified(existing_user):
                return jsonify({"message": "Email already verified.", "email_verified": True})
        return jsonify({"error": "Invalid verification link. Please request a new email."}), 400

    expires_at = parse_timestamp(user.get("verification_expires_at"))
    if expires_at and expires_at < now_local():
        return jsonify({"error": "Verification link expired. Please request a new email."}), 400

    verified_at = now_string()
    users_collection.update_one(
        {"username": user.get("username")},
        {
            "$set": {
                "email_verified": True,
                "email_verified_at": verified_at,
                "last_activity_at": verified_at,
            },
            "$unset": {
                "verification_token_hash": "",
                "verification_expires_at": "",
                "verification_sent_at": "",
            },
        },
    )
    clear_email_otp(user.get("username"))
    record_audit(user.get("username"), "email_verified", user.get("username"), {"success": True})
    return jsonify({
        "message": "Email verified successfully. You can log in now.",
        "email_verified": True,
        "username": user.get("username"),
    })


@app.route("/auth/google", methods=["POST"])
def auth_google():
    data = request.get_json(silent=True) or {}
    credential = (data.get("credential") or "").strip()

    if not credential:
        return jsonify({"error": "Google credential required"}), 400

    try:
        google_user = verify_google_credential(credential)

    except ValueError as exc:
        logging.error("Google auth ValueError: %s", exc)
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        logging.error("Google auth RuntimeError: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        logging.exception("Google auth unexpected error: %s", exc)
        return jsonify({"error": "Internal server error during Google auth"}), 500


    username = (google_user.get("email") or "").strip().lower()
    if not username:
        return jsonify({"error": "Google account did not return an email address."}), 400

    existing_user = users_collection.find_one({"username": username})
    if existing_user and existing_user.get("status") == "blocked":
        return jsonify({"error": "Account is blocked by admin"}), 403

    now_value = now_string()
    display_name = (
        google_user.get("name")
        or google_user.get("given_name")
        or username.split("@")[0]
    )
    auth_provider = "google" if not existing_user or not existing_user.get("password") else "custom_google"

    users_collection.update_one(
        {"username": username},
        {
            "$set": {
                "username": username,
                "display_name": display_name,
                "is_admin": username == ADMIN_USERNAME,
                "role": "Admin" if username == ADMIN_USERNAME else "Normal user",
                "status": "active",
                "usage_limit_per_day": DEFAULT_DAILY_LIMIT,
                "plan": "Enterprise" if username == ADMIN_USERNAME else "Free",
                "email_verified": True,
                "email_verified_at": now_value,
                "last_activity_at": now_value,
                "auth_provider": auth_provider,
                "google_sub": google_user.get("sub"),
                "google_picture": google_user.get("picture"),
            },
            "$setOnInsert": {
                "created_at": now_value,
                "last_login_at": None,
                "login_count": 0,
            },
        },
        upsert=True,
    )

    clear_email_otp(username)
    user = users_collection.find_one({"username": username}) or {
        "username": username,
        "display_name": display_name,
        "is_admin": username == ADMIN_USERNAME,
        "role": "Admin" if username == ADMIN_USERNAME else "Normal user",
        "status": "active",
        "auth_provider": auth_provider,
    }
    login_time = now_string()
    return jsonify(build_login_response(user, login_time, source="google"))


@app.route("/analyze", methods=["POST"])
def analyze():
    try:
        data = request.get_json(silent=True) or {}
        status = get_model_status()
        if status.get("model") == "training":
            return jsonify({
                "error": "Model training in progress. Please retry shortly.",
                "model": "training",
                "model_ready": False,
            }), 503

        review = data.get("review", "")
        username = data.get("username", "")
        platform = data.get("platform", "")
        category = data.get("category", "")
        persist = parse_bool(data.get("persist", True), default=True)

        if not review:
            return jsonify({"error": "Review required"}), 400

        _, access_error, status_code = validate_analysis_access(username, persist, review_count=1)
        if access_error:
            return jsonify({"error": access_error}), status_code

        rating = coerce_rating(data.get("rating", 0))
        artifacts = build_analysis_artifacts(review, rating, username, platform, category)

        if persist:
            reviews_collection.insert_one(artifacts["review_data"])
            cache_add(
                artifacts["duplicate"].get("normalized"),
                artifacts["duplicate"].get("simhash_value"),
                review,
            )

        logging.info("Review analyzed by %s", username or "guest")
        return jsonify(artifacts["response"])
    except Exception as exc:
        logging.exception("Analyze error %s", exc)
        return jsonify({"error": "Server error"}), 500


@app.route("/analyze-batch", methods=["POST"])
def analyze_batch():
    try:
        data = request.get_json(silent=True) or {}
        status = get_model_status()
        if status.get("model") == "training":
            return jsonify({
                "error": "Model training in progress. Please retry shortly.",
                "model": "training",
                "model_ready": False,
            }), 503

        raw_reviews = data.get("reviews") or []
        if not isinstance(raw_reviews, list):
            return jsonify({"error": "Reviews must be provided as an array"}), 400

        normalized_items = []
        default_rating = data.get("rating", 0)
        default_platform = data.get("platform", "")
        default_category = data.get("category", "")

        for item in raw_reviews:
            if isinstance(item, str):
                review_text = item.strip()
                rating = coerce_rating(default_rating)
                platform = default_platform
                category = default_category
            elif isinstance(item, dict):
                review_text = str(item.get("review", "")).strip()
                rating = coerce_rating(item.get("rating", default_rating))
                platform = item.get("platform", default_platform)
                category = item.get("category", default_category)
            else:
                continue

            if not review_text:
                continue

            normalized_items.append({
                "review": review_text,
                "rating": rating,
                "platform": platform,
                "category": category,
            })

        if not normalized_items:
            return jsonify({"error": "Add at least one review to analyze"}), 400
        if len(normalized_items) > MAX_BATCH_REVIEWS_PER_REQUEST:
            return jsonify({
                "error": f"Batch limit is {MAX_BATCH_REVIEWS_PER_REQUEST} reviews per run",
                "max_batch_reviews": MAX_BATCH_REVIEWS_PER_REQUEST,
            }), 400

        username = data.get("username", "")
        persist = parse_bool(data.get("persist", False), default=False)

        _, access_error, status_code = validate_analysis_access(
            username,
            persist,
            review_count=len(normalized_items),
        )
        if access_error:
            return jsonify({"error": access_error}), status_code

        results = []
        review_docs = []

        for index, item in enumerate(normalized_items, start=1):
            artifacts = build_analysis_artifacts(
                item["review"],
                item["rating"],
                username,
                item["platform"],
                item["category"],
            )

            result_row = {
                "id": index,
                "review": item["review"],
                **artifacts["response"],
            }
            results.append(result_row)
            review_docs.append(artifacts["review_data"])

        if persist and review_docs:
            reviews_collection.insert_many(review_docs)
            for doc in review_docs:
                simhash_hex = doc.get("simhash")
                simhash_value = int(simhash_hex, 16) if simhash_hex else None
                cache_add(doc.get("norm_review"), simhash_value, doc.get("review"))

        logging.info("Batch analyzed by %s (%s reviews)", username or "guest", len(results))
        return jsonify({
            "processed": len(results),
            "max_batch_reviews": MAX_BATCH_REVIEWS_PER_REQUEST,
            "results": results,
            "summary": build_batch_summary(results),
        })
    except Exception as exc:
        logging.exception("Analyze batch error %s", exc)
        return jsonify({"error": "Batch analysis failed"}), 500


@app.route("/history/<username>")
def history(username):
    reviews = [
        serialize_doc(doc)
        for doc in reviews_collection.find({"username": username}, {}).sort("timestamp", -1)
    ]
    return jsonify(reviews)


@app.route("/dashboard/<username>")
def dashboard(username):
    try:
        user_doc = users_collection.find_one({"username": username}, user_projection())
        user_reviews = [serialize_doc(doc) for doc in reviews_collection.find({"username": username}, {})]
        total_reviews = len(user_reviews)
        fake_reviews = sum(1 for review in user_reviews if review.get("result") == "Fake")
        genuine_reviews = total_reviews - fake_reviews

        sentiments = Counter(review.get("sentiment", "Neutral") for review in user_reviews)
        weekly_counts = {"Mon": 0, "Tue": 0, "Wed": 0, "Thu": 0, "Fri": 0, "Sat": 0, "Sun": 0}
        rating_distribution = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        word_list = []
        activity = []
        recent_reviews = []

        for review in user_reviews:
            rating_key = str(review.get("rating", 0))
            if rating_key in rating_distribution:
                rating_distribution[rating_key] += 1

            ts = parse_timestamp(review.get("timestamp"))
            if ts:
                weekly_counts[ts.strftime("%a")] += 1

            word_list.extend((review.get("review") or "").lower().split())
            activity.append({
                "review": review.get("review"),
                "result": review.get("result"),
                "time": review.get("timestamp"),
            })
            recent_reviews.append({
                "user": review.get("username"),
                "review": review.get("review"),
                "result": review.get("result"),
                "confidence": review.get("confidence"),
            })

        top_words = Counter(word_list).most_common(10)
        genuine_ratio = round((genuine_reviews / total_reviews) * 100, 2) if total_reviews else 0
        return jsonify({
            "total_reviews": total_reviews,
            "fake_reviews": fake_reviews,
            "genuine_reviews": genuine_reviews,
            "genuine_ratio": genuine_ratio,
            "sentiment": {
                "positive": sentiments.get("Positive", 0),
                "neutral": sentiments.get("Neutral", 0),
                "negative": sentiments.get("Negative", 0),
            },
            "weekly": weekly_counts,
            "rating_distribution": rating_distribution,
            "top_words": top_words,
            "fake_spike": fake_reviews > 5,
            "recent_reviews": recent_reviews[-5:],
            "activity": activity[-10:],
            "sessions": normalize_user_record(user_doc).get("login_count", 0) if user_doc else 0,
        })
    except Exception as exc:
        logging.exception("Dashboard error %s", exc)
        return jsonify({"error": "Dashboard analytics failed"}), 500


@app.route("/allreviews")
def all_reviews():
    reviews = [serialize_doc(doc) for doc in reviews_collection.find({}, {})]
    return jsonify(reviews)


@app.route("/track/download", methods=["POST"])
def track_download():
    data = request.get_json(silent=True) or {}
    download_logs_collection.insert_one({
        "username": data.get("username") or "guest",
        "file_name": data.get("file_name") or f"report-{int(now_local().timestamp())}.pdf",
        "file_type": data.get("file_type") or "PDF",
        "source": data.get("source") or "unknown",
        "timestamp": now_string(),
    })
    return jsonify({"message": "Download tracked"})


@app.route("/track/upload", methods=["POST"])
def track_upload():
    data = request.get_json(silent=True) or {}
    upload_logs_collection.insert_one({
        "username": data.get("username") or "guest",
        "file_name": data.get("file_name") or "unknown",
        "file_size": data.get("file_size") or 0,
        "status": data.get("status") or "processing",
        "source": data.get("source") or "unknown",
        "error": data.get("error"),
        "timestamp": now_string(),
    })
    return jsonify({"message": "Upload tracked"})


@app.route("/feedback", methods=["POST"])
def submit_feedback():
    data = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Feedback message required"}), 400
    feedback_collection.insert_one({
        "username": data.get("username") or "guest",
        "rating": data.get("rating"),
        "message": message,
        "timestamp": now_string(),
    })
    return jsonify({"message": "Feedback submitted"})


@app.route("/admin/overview")
def admin_overview():
    username = request.args.get("username")
    unauthorized = require_admin(username)
    if unauthorized:
        return unauthorized
    return jsonify(build_admin_overview())


@app.route("/admin/users")
def admin_users():
    username = request.args.get("username")
    unauthorized = require_admin(username)
    if unauthorized:
        return unauthorized
    return jsonify(compute_user_rows())


@app.route("/admin/reviews")
def admin_reviews():
    username = request.args.get("username")
    unauthorized = require_admin(username)
    if unauthorized:
        return unauthorized
    reviews = [serialize_doc(doc) for doc in reviews_collection.find({}, {}).sort("timestamp", -1)]
    return jsonify(reviews)


@app.route("/admin/delete-review", methods=["POST"])
def delete_review():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    unauthorized = require_admin(username)
    if unauthorized:
        return unauthorized

    review_id = data.get("id")
    review_text = data.get("review")
    if review_id:
        try:
            result = reviews_collection.delete_one({"_id": ObjectId(review_id)})
        except Exception:
            return jsonify({"error": "Invalid review id"}), 400
    else:
        result = reviews_collection.delete_one({"review": review_text})

    if result.deleted_count == 0:
        return jsonify({"error": "Review not found"}), 404

    record_audit(username, "delete_review", review_id or review_text, {})
    return jsonify({"message": "Review deleted"})


@app.route("/admin/user-action", methods=["POST"])
def admin_user_action():
    data = request.get_json(silent=True) or {}
    actor = data.get("username")
    unauthorized = require_admin(actor)
    if unauthorized:
        return unauthorized

    target_username = (data.get("target_username") or "").strip().lower()
    action = data.get("action")
    if not target_username or not action:
        return jsonify({"error": "Target user and action required"}), 400

    user = users_collection.find_one({"username": target_username})
    if not user:
        return jsonify({"error": "User not found"}), 404

    if target_username == actor and action in {"ban", "delete"}:
        return jsonify({"error": "Primary admin cannot ban or delete the active admin account"}), 400

    update = {}
    response_extra = {}

    if action == "ban":
        update["status"] = "blocked"
    elif action == "unblock":
        update["status"] = "active"
    elif action == "reset_password":
        new_password = data.get("new_password") or "Temp@1234"
        update["password"] = new_password
        response_extra["temporary_password"] = new_password
    elif action == "set_role":
        role = data.get("role") or "Normal user"
        update["role"] = role
        update["is_admin"] = role.lower() == "admin"
    elif action == "set_limit":
        try:
            update["usage_limit_per_day"] = int(data.get("usage_limit_per_day"))
        except (TypeError, ValueError):
            return jsonify({"error": "Valid usage limit required"}), 400
    elif action == "set_plan":
        update["plan"] = data.get("plan") or "Free"
    elif action == "delete":
        users_collection.delete_one({"username": target_username})
        reviews_collection.delete_many({"username": target_username})
        record_audit(actor, action, target_username, {})
        return jsonify({"message": "User deleted"})
    else:
        return jsonify({"error": "Unsupported action"}), 400

    if update:
        users_collection.update_one({"username": target_username}, {"$set": update})
    record_audit(actor, action, target_username, update)
    return jsonify({"message": "User updated", **response_extra})


if __name__ == "__main__":
    print("Server running on http://127.0.0.1:5000")
    app.run(debug=True, port=5000)
