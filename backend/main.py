from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from openai import OpenAI
import json
from pathlib import Path

app = FastAPI(title="Egzaminator IT API")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load prompts
PROMPTS_DIR = Path(__file__).parent / "prompts"

def load_prompt(filename: str) -> str:
    with open(PROMPTS_DIR / filename, "r", encoding="utf-8") as f:
        return f.read()

GUARDIAN_PROMPT = load_prompt("guardian.md")
CHECK_PROMPT = load_prompt("check.md")
LESSON_PROMPT = load_prompt("lesson.md")
WELCOME_PROMPT = load_prompt("welcome.md")
SUMMARY_PROMPT = load_prompt("summary.md")

# Models
class TechnologyLevel(BaseModel):
    technology: str
    level: int

class WelcomeRequest(BaseModel):
    technologies: List[TechnologyLevel]
    question_count: int

class GuardianRequest(BaseModel):
    question: str
    answer: str

class CheckRequest(BaseModel):
    question: str
    answer: str

class LessonRequest(BaseModel):
    question: str
    answer: str
    scoring: int
    comment: str

class QuestionData(BaseModel):
    question: str
    comment: str
    scoring: int

class SummaryRequest(BaseModel):
    questions: List[QuestionData]

# Helper function to call OpenAI
def call_openai(system_prompt: str, user_message: str) -> dict:
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")

@app.post("/api/exam/welcome")
async def welcome(request: WelcomeRequest):
    tech_list = "\n".join([f"- {t.technology} (poziom {t.level})" for t in request.technologies])
    user_message = f"""
Technologie i poziomy:
{tech_list}

Liczba pytań do wygenerowania: {request.question_count}
"""
    result = call_openai(WELCOME_PROMPT, user_message)
    return result

@app.post("/api/exam/guardian")
async def guardian(request: GuardianRequest):
    user_message = f"""
Pytanie: {request.question}

Odpowiedź użytkownika: {request.answer}
"""
    result = call_openai(GUARDIAN_PROMPT, user_message)
    return result

@app.post("/api/exam/check")
async def check(request: CheckRequest):
    user_message = f"""
Pytanie: {request.question}

Odpowiedź użytkownika: {request.answer}
"""
    result = call_openai(CHECK_PROMPT, user_message)
    return result

@app.post("/api/exam/lesson")
async def lesson(request: LessonRequest):
    user_message = f"""
Pytanie: {request.question}

Odpowiedź użytkownika: {request.answer}

Scoring: {request.scoring}/10

Komentarz: {request.comment}
"""
    result = call_openai(LESSON_PROMPT, user_message)
    return result

@app.post("/api/exam/summary")
async def summary(request: SummaryRequest):
    questions_text = "\n\n".join([
        f"Pytanie: {q.question}\nScoring: {q.scoring}/10\nKomentarz: {q.comment}"
        for q in request.questions
    ])
    user_message = f"Pytania i komentarze:\n\n{questions_text}"
    result = call_openai(SUMMARY_PROMPT, user_message)
    return result

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.get("/api/test")
async def test():
    return {"message": "Test endpoint działa!", "timestamp": "2024-01-01"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
