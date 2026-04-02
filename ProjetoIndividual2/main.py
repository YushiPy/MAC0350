
from sqlalchemy.exc import IntegrityError

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from sqlmodel import SQLModel, Session, create_engine, select
import bcrypt

from models import User

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
async def get_main_page(request: Request):
	return templates.TemplateResponse("index.html", {"request": request, "static": STATIC_PATH})

@app.get("/header", response_class=HTMLResponse)
async def get_header(request: Request):
	return templates.TemplateResponse("header.html", {"request": request, "static": STATIC_PATH})

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

	def make_success(message: str) -> HTMLResponse:
		return HTMLResponse(f'<p style="color: green; font-size: 1.5rem; margin: 0;">{message}</p>')

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

	response = make_success("User created successfully. You can now log in.")

	return response


def authenticate_user(username: str, password: str) -> bool:

	with Session(engine) as session:

		user = session.exec(select(User).where(User.username == username)).first()

		if user is None:
			return False

		return verify_password(password, user.password_hash)

@app.post("/login", response_class=HTMLResponse)
async def post_login(
	request: Request,
	username: str = Form(...),
	password: str = Form(...)
):

	username = username.strip()
	password = password.strip()

	def make_error(message: str) -> HTMLResponse:
		return HTMLResponse(f'<p style="color: red; font-size: 1.5rem; margin: 0;">{message}</p>')

	def make_success(message: str) -> HTMLResponse:
		return HTMLResponse(f'<p style="color: green; font-size: 1.5rem; margin: 0;">{message}</p>')

	if authenticate_user(username, password):
		return make_success("Login successful")
	else:
		return make_error("Invalid username or password")

