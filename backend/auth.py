import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

_bearer = HTTPBearer(auto_error=False)

def _init():
    if firebase_admin._apps:
        return
    key_path = Path(__file__).parent / "serviceAccountKey.json"
    if key_path.exists():
        cred = credentials.Certificate(str(key_path))
    else:
        # Fallback: path from env var (useful for deployed environments)
        env_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
        if not env_path:
            raise RuntimeError(
                "Firebase not configured. Add backend/serviceAccountKey.json "
                "or set FIREBASE_SERVICE_ACCOUNT_PATH env var."
            )
        cred = credentials.Certificate(env_path)
    firebase_admin.initialize_app(cred)

def verify_token(credentials: HTTPAuthorizationCredentials = Security(_bearer)):
    _init()
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decoded = firebase_auth.verify_id_token(credentials.credentials)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
