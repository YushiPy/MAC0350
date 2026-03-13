
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from pathlib import Path

app = FastAPI()

users: list[dict] = []

class User(BaseModel):
	nome: str
	idade: int

@app.get("/", response_class=HTMLResponse)
def index() -> str:
	return Path("index.html").read_text()

@app.post("/users")
def add_user(user: User) -> dict:
	users.append(user.model_dump())
	return users[-1]

@app.get("/users")
def get_users(index: int | None = Query(default=None)):
	if index is None:
		return users
	if 0 <= index < len(users):
		return users[index]
	return {"erro": "Índice inválido"}

@app.delete("/users")
def delete_users():
	users.clear()
	return {"mensagem": "Lista apagada"}
