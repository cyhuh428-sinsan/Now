from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class TemplatePayload(StrictModel):
    name: str = Field(min_length=1, max_length=240)
    content_template: str
    title_template: str = ""
    description: str = ""
    properties: dict[str, str] = Field(default_factory=dict)
    variables: list[Literal["date", "time", "title"]] = Field(default_factory=list)

    @model_validator(mode="after")
    def plain_template(self):
        if "NOW_ENCRYPTED_V1:" in self.content_template:
            raise ValueError("encrypted_template_forbidden")
        return self


class Tags(StrictModel):
    all: list[str] = Field(default_factory=list)
    any: list[str] = Field(default_factory=list)


class Scope(StrictModel):
    topic_id: str | None = None
    category_id: str | None = None


class Period(StrictModel):
    from_: str | None = Field(default=None, alias="from")
    to: str | None = None

    @model_validator(mode="after")
    def valid_period(self):
        values = []
        for value in (self.from_, self.to):
            if value is not None:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    raise ValueError("timezone required")
                values.append(parsed)
        if len(values) == 2 and values[0] > values[1]:
            raise ValueError("date range invalid")
        return self


class QueryFilter(StrictModel):
    text: str = ""
    tags: Tags = Field(default_factory=Tags)
    scope: Scope = Field(default_factory=Scope)
    favorite: bool | None = None
    updated: Period = Field(default_factory=Period)


class Sort(StrictModel):
    field: Literal["updated_at", "title"] = "updated_at"
    direction: Literal["asc", "desc"] = "desc"


class QueryPayload(StrictModel):
    name: str = Field(min_length=1, max_length=240)
    order: int = 0
    filter: QueryFilter = Field(default_factory=QueryFilter)
    sort: Sort = Field(default_factory=Sort)


class CanvasCard(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    type: Literal["note", "text"]
    noteId: str = Field(default="", max_length=120)
    text: str = Field(default="", max_length=600)
    x: float = Field(ge=0, allow_inf_nan=False)
    y: float = Field(ge=0, allow_inf_nan=False)
    width: float = Field(ge=180, le=360, allow_inf_nan=False)
    color: str = Field(default="blue", max_length=24)

    @model_validator(mode="after")
    def no_note_body_cache(self):
        if (self.type == "note" and self.text) or (self.type == "text" and self.noteId):
            raise ValueError("note_reference_or_text_only")
        return self


class CanvasEdge(StrictModel):
    id: str = Field(min_length=1, max_length=120)
    from_: str = Field(alias="from", min_length=1, max_length=120)
    to: str = Field(min_length=1, max_length=120)
    label: str = Field(default="", max_length=60)


class CanvasPayload(StrictModel):
    title: str = Field(min_length=1, max_length=80)
    cards: list[CanvasCard] = Field(max_length=500)
    edges: list[CanvasEdge] = Field(max_length=1000)
    zoom: float = Field(ge=0.1, le=1.8, allow_inf_nan=False)

    @model_validator(mode="after")
    def valid_graph(self):
        ids = {card.id for card in self.cards}
        if len(ids) != len(self.cards) or len({edge.id for edge in self.edges}) != len(self.edges):
            raise ValueError("duplicate_graph_id")
        pairs = set()
        for edge in self.edges:
            pair = (edge.from_, edge.to)
            if edge.from_ == edge.to or not set(pair) <= ids or pair in pairs:
                raise ValueError("invalid_graph_edge")
            pairs.add(pair)
        return self


class Mutation(StrictModel):
    owner_id: str = Field(min_length=1, max_length=80)
    schema_version: Literal[1]
    base_version: int = Field(ge=0)
    mutation_id: str

    @model_validator(mode="after")
    def valid_mutation_id(self):
        self.mutation_id = str(UUID(self.mutation_id))
        return self


class ResourceWrite(Mutation):
    payload: dict
