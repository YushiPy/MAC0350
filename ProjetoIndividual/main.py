
import base64
import re

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import hashlib, secrets
import os

app = FastAPI()

# Simple in-memory user store — swap for a real DB later
users: dict[str, str] = {}

DRAWINGS_DIR = "drawings"

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

class SaveDrawingRequest(BaseModel):
	username: str
	image_data: str  # Base64-encoded image data

@app.post("/drawings/save")
def save_image(req: SaveDrawingRequest):
	
	if req.username not in users:
		raise HTTPException(status_code=401, detail="Unauthorized.")

	if not os.path.exists(DRAWINGS_DIR):
		os.makedirs(DRAWINGS_DIR)

	user_folder = os.path.join(DRAWINGS_DIR, req.username)

	if not os.path.exists(user_folder):
		os.makedirs(user_folder)

	image_data = req.image_data
	data = image_data.split(",")[1] if "," in image_data else image_data
	print(image_data)
	drawings = [f for f in os.listdir(user_folder) if f.startswith("drawing_") and f.endswith(".png")]

	next_index = 0

	for file in drawings:
		regex_match = re.match(r"drawing_(\d+)\.png", file)
		if regex_match:
			index = int(regex_match.group(1))
			next_index = max(next_index, index + 1)

	with open(os.path.join(user_folder, f"drawing_{next_index}.png"), "wb") as f:
		f.write(base64.b64decode(data))

	return {"message": "Drawing saved."}

# Serve your static files (html, css, js)
app.mount("/", StaticFiles(directory=".", html=True), name="static")
