
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import hashlib, secrets

app = FastAPI()

# Simple in-memory user store — swap for a real DB later
users: dict[str, str] = {}

class AuthRequest(BaseModel):
	username: str
	password: str
	confirm_password: str | None = None

def hash_password(password: str) -> str:
	return hashlib.sha256(password.encode()).hexdigest()

@app.post("/auth/register")
def register(req: AuthRequest):
	if req.username in users:
		raise HTTPException(status_code=400, detail="Username already taken.")
	if req.confirm_password != req.password:
		raise HTTPException(status_code=400, detail="Passwords do not match.")
	users[req.username] = hash_password(req.password)
	return {"message": "Account created."}

@app.post("/auth/login")
def login(req: AuthRequest):
	stored = users.get(req.username)
	if not stored or stored != hash_password(req.password):
		raise HTTPException(status_code=401, detail="Invalid username or password.")
	# Replace this with a real JWT in production
	token = secrets.token_hex(32)
	return {"access_token": token}

# Serve your static files (html, css, js)
app.mount("/", StaticFiles(directory=".", html=True), name="static")
