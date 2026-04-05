from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager

from sqlmodel import SQLModel, col, create_engine, Session, select

from models import Aluno


@asynccontextmanager
async def initFunction(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(lifespan=initFunction)
app.mount("/static", StaticFiles(directory="static"), name="static")

arquivo_sqlite = "HTMX2.db"
url_sqlite = f"sqlite:///{arquivo_sqlite}"

engine = create_engine(url_sqlite)

templates = Jinja2Templates(directory=["Templates", "Templates/Partials"])


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


@app.get("/busca", response_class=HTMLResponse)
def busca(request: Request):
    return templates.TemplateResponse(request, "index.html", {"static": "/static"})


def buscar_alunos(busca):
    with Session(engine) as session:
        query = (
            select(Aluno).where(col(Aluno.nome).contains(busca)).order_by(Aluno.nome)
        )
        return session.exec(query).all()


PAGINATION_SIZE = 5
page_index = 0


@app.get("/lista", response_class=HTMLResponse)
def lista(request: Request, busca: str | None = "", shift: int | None = 0):
    global page_index

    alunos = buscar_alunos(busca)
    print(alunos)
    page_count = (len(alunos) + PAGINATION_SIZE - 1) // PAGINATION_SIZE

    if shift is not None:
        page_index = max(0, min(page_count - 1, page_index + shift))

    start_index = page_index * PAGINATION_SIZE
    end_index = start_index + PAGINATION_SIZE

    alunos = alunos[start_index:end_index]

    return templates.TemplateResponse(request, "lista.html", {"alunos": alunos})


@app.get("/editarAlunos")
def novoAluno(request: Request):
    return templates.TemplateResponse(request, "options.html")


@app.post("/novoAluno", response_class=HTMLResponse)
def criar_aluno(nome: str = Form(...)):
    with Session(engine) as session:
        novo_aluno = Aluno(nome=nome)
        session.add(novo_aluno)
        session.commit()
        session.refresh(novo_aluno)
        return HTMLResponse(
            content=f"<p>O(a) aluno(a) {novo_aluno.nome} foi registrado(a)!</p>"
        )


@app.delete("/deletaAluno", response_class=HTMLResponse)
def deletar_aluno(id: int):
    with Session(engine) as session:
        query = select(Aluno).where(Aluno.id == id)
        aluno = session.exec(query).first()
        if not aluno:
            raise HTTPException(404, "Aluno não encontrado")
        session.delete(aluno)
        session.commit()
        return HTMLResponse(
            content=f"<p>O(a) aluno(a) {aluno.nome} foi deletado(a)!</p>"
        )


@app.put("/atualizaAluno", response_class=HTMLResponse)
def atualizar_aluno(id: int = Form(...), novoNome: str = Form(...)):
    with Session(engine) as session:
        query = select(Aluno).where(Aluno.id == id)
        aluno = session.exec(query).first()
        if not aluno:
            raise HTTPException(404, "Aluno não encontrado")
        nomeAntigo = aluno.nome
        aluno.nome = novoNome
        session.commit()
        session.refresh(aluno)
        return HTMLResponse(
            content=f"<p>O(a) aluno(a) {nomeAntigo} foi atualizado(a) para {aluno.nome}!</p>"
        )
