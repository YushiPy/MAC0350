
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates


app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

curtidas = 0

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
	return templates.TemplateResponse("index.html", {"request": request})

@app.get("/curtidas", response_class=HTMLResponse)
async def _curtidas(request: Request):
	return templates.TemplateResponse("curtidas.html", {"request": request, "curtidas": curtidas})

@app.post("/curtir")
async def curtir():
	global curtidas
	curtidas += 1
	
	return curtidas

@app.post("/limpar-curtidas")
async def limpar_curtidas():
	global curtidas
	curtidas = 0
	
	return curtidas

@app.get("/professor-page", response_class=HTMLResponse)
async def professor_page(request: Request):
	return templates.TemplateResponse("professor-page.html", {"request": request, "static": "/static/professor-page"})

@app.get("/jupiterweb", response_class=HTMLResponse)
async def jupiterweb(request: Request):
	return templates.TemplateResponse("jupiterweb.html", {"request": request, "static": "/static/jupiterweb"})
