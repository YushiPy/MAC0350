# Este import será importante em algum lugar...
# Dica: Olhe as outras dicas : D

from sqlmodel import Field, Relationship, SQLModel


class Aluno(SQLModel, table=True):

    nusp: int | None = Field(default=None, primary_key=True)

    nome: str | None = Field(default=None)
    idade: int | None = Field(default=None)
    tarefas: list[Tarefa] = Relationship(back_populates="aluno")
    # Implemente aqui os registros para o nome e idade do aluno.

    # Atente-se a como a tarefa referência os alunos.
    #
    # É só uma tarefa, ou são várias tarefas?
    # Pelo modelo de Tarefa, devemos preparar algo a mais
    # para que possamos pegar o aluno pela tarefa?

    # A dica está nos imports.


class Tarefa(SQLModel, table=True):

    id: int | None = Field(default=None, primary_key=True)
    nome: str
    duracao: int
    aluno_nusp: int = Field(foreign_key="aluno.nusp")

    aluno: Aluno = Relationship(back_populates="tarefas")
    # Dica numero 2:
    # "tarefas" deve ser o nome do atributo
    # que representa a relação no modelo Aluno
