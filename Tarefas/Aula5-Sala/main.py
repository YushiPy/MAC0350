
from typing import Annotated

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel

import http.client


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

class User(BaseModel):

	username: str
	password_hash: int
	bio: str | None = None

USERS: list[User] = [
	User(username="gabriel", password_hash=hash("senha"), bio="Hello, I'm Gabriel!"),
	User(username="leticia", password_hash=hash("senha")),
]

class UserData(BaseModel):

	username: str
	password: str

class LoginData(BaseModel):

	username: str
	password: str

class BioUpdateData(BaseModel):
	new_bio: str

@app.get("/")
def read_root() -> HTMLResponse:
	return templates.TemplateResponse("signup.html", {"request": {}})

@app.get("/login")
def read_login() -> HTMLResponse:
	return templates.TemplateResponse("login.html", {"request": {}})

@app.post("/users")
def create_user(data: UserData) -> User:
	
	username = data.username
	password = data.password

	user = User(username=username, password_hash=hash(password))

	USERS.append(user)

	return user

@app.post("/login")
def login(data: LoginData, response: Response):

	username = data.username
	password = data.password

	found_user = None

	for user in USERS:
		if user.username == username and user.password_hash == hash(password):
			found_user = user
			break

	if found_user is None:
		raise HTTPException(status_code=http.client.NOT_FOUND, detail="User not found")

	response.set_cookie(key="session_user", value=username)

	return {"message": "Logged in successfully"}

def get_active_user(session_user: Annotated[str | None, Cookie()] = None) -> User:

	if session_user is None:
		raise HTTPException(status_code=http.client.UNAUTHORIZED, detail="Not logged in.")

	user = next((user for user in USERS if user.username == session_user), None)

	if user is None:
		raise HTTPException(status_code=http.client.NOT_FOUND, detail="Invalid session user.")

	return user

@app.get("/home")
def home(user: User = Depends(get_active_user)) -> HTMLResponse:
	return templates.TemplateResponse("home.html", {"request": {}, "user": user})

@app.post("/home/update_bio")
def update_bio(data: BioUpdateData, user: User = Depends(get_active_user)) -> dict[str, str]:

	user.bio = data.new_bio

	return {"message": "Bio updated successfully"}
