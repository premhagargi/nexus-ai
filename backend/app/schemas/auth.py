from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    # User has no `name` column (see prisma/schema.prisma) — only email/password.
    workspace_name: str = Field(min_length=1, max_length=200, alias="workspaceName")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut
