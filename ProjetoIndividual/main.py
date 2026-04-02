
import json

from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError

from fastapi import Cookie, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from sqlmodel import SQLModel, Session, create_engine, select

import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from models import Drawing, User

SECRET_KEY = "ASFQEUBFOEUQB)!#H) #) UR)(*#!U&R) &)*#!&UR) &$#!)_( &$#)"
serializer = URLSafeTimedSerializer(SECRET_KEY)

def create_token(username: str) -> str:
	return serializer.dumps(username)

def decode_token(token: str) -> str | None:
	try:
		return serializer.loads(token, max_age=7 * 24 * 3600)  # 7 days
	except (BadSignature, SignatureExpired):
		return None




@asynccontextmanager
async def initFunction(app: FastAPI):
	create_db_and_tables()
	yield

STATIC_PATH = "/static"

app = FastAPI(lifespan=initFunction)
app.mount(STATIC_PATH, StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory=["templates"])

arquivo_sqlite = "tpp.db"
url_sqlite = f"sqlite:///{arquivo_sqlite}"
engine = create_engine(url_sqlite)

def create_db_and_tables():
	SQLModel.metadata.create_all(engine)

@app.get("/", response_class=HTMLResponse)
async def get_main_page(request: Request, session: str | None = Cookie(default=None)):
	username = decode_token(session) if session else None
	return templates.TemplateResponse("index.html", {"request": request, "static": STATIC_PATH, "username": username})

@app.get("/header", response_class=HTMLResponse)
async def get_header(request: Request, session: str | None = Cookie(default=None)):
	username = decode_token(session) if session else None
	return templates.TemplateResponse("header.html", {"request": request, "static": STATIC_PATH, "username": username})

@app.get("/login", response_class=HTMLResponse)
async def get_login(request: Request):
	return templates.TemplateResponse("login.html", {"request": request, "static": STATIC_PATH})

@app.get("/signup", response_class=HTMLResponse)
async def get_signup(request: Request):
	return templates.TemplateResponse("signup.html", {"request": request, "static": STATIC_PATH})

def hash_password(password: str) -> str:
	return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
	return bcrypt.checkpw(password.encode(), hashed.encode())

def create_user(username: str, password: str):

	password_hash = hash_password(password)

	with Session(engine) as session:

		user = User(username=username, password_hash=password_hash)
		session.add(user)
		session.commit()
		session.refresh(user)

		return user

@app.post("/signup", response_class=HTMLResponse)
async def post_signup(
	request: Request,
	username: str = Form(...),
	password: str = Form(...),
	confirm_password: str = Form(...)
):
	
	username = username.strip()
	password = password.strip()
	confirm_password = confirm_password.strip()

	def make_error(message: str) -> HTMLResponse:
		return HTMLResponse(f'<p style="color: red; font-size: 1.5rem; margin: 0;">{message}</p>')

	if password != confirm_password:
		return make_error("Passwords do not match")

	if len(username) == 0:
		return make_error("Username cannot be empty")
	
	if len(password) < 1:
		return make_error("Password must be at least 1 characters long")
	
	if not all(c.isalnum() or c in "_-." for c in username):
		return make_error("Username can only contain letters, numbers, underscores, hyphens and dots")
	
	if not all(c.isprintable() for c in password):
		return make_error("Password cannot contain non-printable characters")
	
	if username.startswith(".") or username.endswith("."):
		return make_error("Username cannot start or end with a dot")

	MAX_USERNAME_LENGTH = 100

	if len(username) > MAX_USERNAME_LENGTH:
		return make_error(f"Username cannot be longer than {MAX_USERNAME_LENGTH} characters")

	try:
		create_user(username, password)
	except IntegrityError:
		return make_error("Username already exists")
	except Exception as e:
		return make_error("An error occurred while creating the user")

	token = create_token(username)
	response = HTMLResponse("", headers={"HX-Trigger": json.dumps({"loginSuccess": {"username": username}})})
	response.set_cookie("session", token, httponly=True, samesite="lax")

	return response


def authenticate_user(username: str, password: str) -> bool:

	with Session(engine) as session:

		user = session.exec(select(User).where(User.username == username)).first()

		if user is None:
			return False

		return verify_password(password, user.password_hash)

@app.post("/login", response_class=HTMLResponse)
async def post_login(request: Request, username: str = Form(...), password: str = Form(...)):

	username = username.strip()
	password = password.strip()

	if not authenticate_user(username, password):
		return HTMLResponse(f'<p style="color: red; font-size: 1.5rem; margin: 0;">Invalid username or password</p>')

	token = create_token(username)
	response = HTMLResponse("", headers={"HX-Trigger": json.dumps({"loginSuccess": {"username": username}})})
	response.set_cookie("session", token, httponly=True, samesite="lax")
	return response

@app.post("/logout", response_class=HTMLResponse)
async def post_logout(request: Request):
	response = HTMLResponse("", headers={"HX-Trigger": "logoutSuccess"})
	response.delete_cookie("session")
	return response

@app.get("/canvas", response_class=HTMLResponse)
async def get_canvas(request: Request):
	return templates.TemplateResponse("canvas.html", {"request": request, "static": STATIC_PATH})


class DrawingData(BaseModel):

	startPoint: list[float]
	targetPoint: list[float]
	polygons: list[list[list[float]]]

	currentPolygon: int | None
	currentPolygonVertex: int | None
	scrollSensitivity: float
	snapping: bool
	showVertexLine: bool

	camera: dict[str, list[float] | float]

	dataURL: str
	width: int
	height: int

@app.post("/drawings/save")
async def save_drawing(request: Request, data: DrawingData, session: str | None = Cookie(default=None)):

	username = decode_token(session) if session else None

	if username is None:
		raise HTTPException(status_code=401, detail="Unauthorized")
	
	with Session(engine) as db:

		user = db.exec(select(User).where(User.username == username)).first()

		if not user:
			return HTMLResponse("User not found", status_code=404)

		user_id: int = user.id # type: ignore
		data_json = json.dumps(data.model_dump())

		drawing = Drawing(user_id=user_id, data=data_json)
		db.add(drawing)
		db.commit()

	return HTMLResponse("OK")

@app.get("/drawings")
async def get_drawings(request: Request, session: str | None = Cookie(default=None)):

    username = decode_token(session) if session else None

    if not username:
        return JSONResponse("Unauthorized", status_code=401)

    with Session(engine) as db:

        user = db.exec(select(User).where(User.username == username)).first()

        if not user:
            return JSONResponse("User not found", status_code=404)

        drawings = [{"id": d.id, "created_at": d.created_at.isoformat(), "modified_at": d.modified_at.isoformat()} for d in user.drawings]

    return JSONResponse(drawings)
