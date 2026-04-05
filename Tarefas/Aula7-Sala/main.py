from fastapi import FastAPI
from sqlmodel import Session, select, SQLModel, create_engine
from models import Aluno, Tarefa

arquivo_sqlite = "exercicio_7.db"
url_sqlite = f"sqlite:///{arquivo_sqlite}"

engine = create_engine(url_sqlite)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


app = FastAPI()


@app.on_event("startup")
def on_startup() -> None:
    create_db_and_tables()


@app.post("/alunos")
def criar_aluno(aluno: Aluno):
    with Session(engine) as session:
        # Implemente aqui os comandos para adicionar, salvar e depois
        # como resposta da API:
        # retorne o objeto aluno da forma em que ele foi salvo no banco de dados.
        session.add(aluno)
        session.commit()
        session.refresh(aluno)

        return aluno


@app.post("/tarefas")
def criar_tarefa(tarefa: Tarefa):
    with Session(engine) as session:
        session.add(tarefa)
        session.commit()
        session.refresh(tarefa)
        return tarefa


@app.get("/alunos")
def listar_alunos():
    with Session(engine) as session:
        # Implemente aqui o comando para retornar:
        # A lista de TODOS os alunos
        # cadastrados no banco de dados.
        return session.exec(select(Aluno)).all()


@app.get("/tarefas")
def listar_tarefas():
    with Session(engine) as session:
        return session.exec(select(Tarefa)).all()


@app.get("/alunos/{aluno_nusp}/tarefas")
def listar_tarefas_do_aluno(aluno_nusp: int):
    with Session(engine) as session:
        # Implemente aqui os comandos para retornar:
        # A lista de tarefas associadas a um aluno.

        # você pode fazer esta consulta tanto
        # através da estruturação de uma consulta normal SQL,
        # quanto simplesmente pegando o Aluno
        # e retornando a propriedade implementada anteriormente.
        return (
            session.exec(select(Aluno).where(Aluno.nusp == aluno_nusp)).first().tarefas
        )
