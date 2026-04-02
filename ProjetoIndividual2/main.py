
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from sqlmodel import SQLModel, create_engine

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
