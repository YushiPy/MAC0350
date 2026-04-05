from sqlmodel import Field, SQLModel


class Aluno(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str
