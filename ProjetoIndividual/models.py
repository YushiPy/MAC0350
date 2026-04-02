
from datetime import datetime

from sqlmodel import Field, Relationship, SQLModel

class User(SQLModel, table=True):
	id: int | None = Field(default=None, primary_key=True)
	username: str = Field(index=True, unique=True)
	password_hash: str
	  
	drawings: list[Drawing] = Relationship(back_populates="user")


class Drawing(SQLModel, table=True):

	id: int | None = Field(default=None, primary_key=True)
	user_id: int = Field(foreign_key="user.id")

	data: str # JSON string containing the drawing data

	created_at: datetime = Field(default_factory=datetime.utcnow)
	modified_at: datetime = Field(default_factory=datetime.utcnow)

	user: User | None = Relationship(back_populates="drawings")
