# ai-backend/main.py

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
from dotenv import load_dotenv
from rag_pipeline import RAGPipeline, DOCS_DIR
import json
from typing import List, Optional

# Load environment variables (for GOOGLE_API_KEY)
load_dotenv()

# Configure Google Generative AI
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Define Pydantic Models for Request/Response
class InterviewAnalysisRequest(BaseModel):
    candidate_id: str
    job_id: str
    interview_transcript: str

class DocumentInfo(BaseModel):
    id: str
    name: str | None = None
    title: str | None = None

class LLMAnalysisResponse(BaseModel):
    summary: str
    strengths: List[str]
    weaknesses: List[str]
    potential_red_flags: List[str]
    suitability_score: Optional[int] = None
    recommendations: List[str]


def create_app() -> FastAPI:
    """
    Factory function to create and configure the FastAPI application.
    This helps Uvicorn's --reload functionality.
    """
    app = FastAPI()

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"], # Adjust based on your frontend's URL
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize the RAG Pipeline and LLM model within the factory function
    rag_pipeline_instance = RAGPipeline()
    llm_model_instance = genai.GenerativeModel('gemini-1.5-flash')
    print("FastAPI app, RAGPipeline, and Gemini model initialized within factory.")

    # --- Startup Logic for Document Ingestion ---
    @app.on_event("startup")
    async def startup_event():
        print("Application startup event triggered: Ingesting documents for RAG...")
        candidate_files = []
        candidates_dir = os.path.join(DOCS_DIR, "candidates")
        if os.path.exists(candidates_dir):
            candidate_files = [os.path.join(candidates_dir, f) for f in os.listdir(candidates_dir) if f.endswith(".txt")]
        
        job_files = []
        jobs_dir = os.path.join(DOCS_DIR, "jobs")
        if os.path.exists(jobs_dir):
            job_files = [os.path.join(jobs_dir, f) for f in os.listdir(jobs_dir) if f.endswith(".txt")]

        all_files_to_ingest = candidate_files + job_files
        
        if not all_files_to_ingest:
            print("Warning: No documents found in data/candidates or data/jobs to ingest. Please add .txt files.")
        else:
            rag_pipeline_instance.ingest_documents(all_files_to_ingest)
            print("Initial RAG documents ingested.")

    # --- API Endpoints ---

    @app.get("/")
    async def read_root():
        """Health check endpoint."""
        return {"message": "AI Interview Detector Backend (RAG+LLM) is running!"}

    @app.get("/get-available-documents")
    async def get_available_documents():
        candidates_dir = os.path.join(DOCS_DIR, "candidates")
        jobs_dir = os.path.join(DOCS_DIR, "jobs")

        available_candidates = []
        if os.path.exists(candidates_dir):
            for f in os.listdir(candidates_dir):
                if f.endswith(".txt"):
                    candidate_id = f.replace(".txt", "")
                    candidate_name = candidate_id.replace("candidate_", "").replace("_resume", "").replace("_", " ").title()
                    available_candidates.append(DocumentInfo(id=candidate_id, name=candidate_name))

        available_jobs = []
        if os.path.exists(jobs_dir):
            for f in os.listdir(jobs_dir):
                if f.endswith(".txt"):
                    job_id = f.replace(".txt", "")
                    job_title = job_id.replace("job_", "").replace("_", " ").title()
                    available_jobs.append(DocumentInfo(id=job_id, title=job_title))

        return {"candidates": available_candidates, "jobs": available_jobs}


    @app.post("/analyze-interview")
    async def analyze_interview(request: InterviewAnalysisRequest):
        candidate_file_path = os.path.join(DOCS_DIR, "candidates", f"{request.candidate_id}.txt")
        job_file_path = os.path.join(DOCS_DIR, "jobs", f"{request.job_id}.txt")

        candidate_resume_content = rag_pipeline_instance.get_document_content(candidate_file_path)
        job_description_content = rag_pipeline_instance.get_document_content(job_file_path)

        if "Error:" in candidate_resume_content or "Error:" in job_description_content:
            raise HTTPException(status_code=404, detail="Candidate resume or job description not found.")

        retrieval_query = f"Interview discussion about: {request.interview_transcript}\nCandidate background: {candidate_resume_content}\nJob requirements: {job_description_content}"
        relevant_chunks = rag_pipeline_instance.retrieve_context(retrieval_query, k=5)

        prompt_parts = [
            f"You are an AI Interview Analyst. Your task is to evaluate a candidate's interview performance based on their transcript, their resume, and the job description. Provide a structured analysis.",
            f"\n--- Candidate Resume ---\n{candidate_resume_content}",
            f"\n--- Job Description ---\n{job_description_content}",
            f"\n--- Interview Transcript ---\n{request.interview_transcript}",
            "\n--- Relevant Context from Documents (for deeper insights) ---",
            "\n".join(relevant_chunks),
            """
            --- Analysis Guidelines ---
            Provide your analysis in a JSON format with the following keys:
            {
              "summary": "A concise summary of the interview's overall impression.",
              "strengths": ["List specific strengths of the candidate demonstrated in the interview relative to the job and resume."],
              "weaknesses": ["List specific weaknesses or areas for improvement demonstrated in the interview relative to the job and resume."],
              "potential_red_flags": ["List any inconsistencies, vague answers, or concerning behaviors observed."],
              "suitability_score": "A score from 1 to 10 (10 being highly suitable), indicating how well the candidate fits the role based on all provided information.",
              "recommendations": ["Suggestions for next steps (e.g., proceed to next round, ask follow-up questions, consider for different role)."]
            }
            Ensure the JSON is well-formed and valid.
            """,
            "\n--- Begin Analysis JSON ---"
        ]
        
        try:
            response = llm_model_instance.generate_content(prompt_parts)
            llm_output = response.text.strip()
            json_start = llm_output.find('{')
            json_end = llm_output.rfind('}') + 1

            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_string = llm_output[json_start:json_end]
                analysis_report = json.loads(json_string)
                return LLMAnalysisResponse(**analysis_report)
            else:
                print(f"LLM did not return a clean JSON. Raw output: {llm_output}")
                raise HTTPException(status_code=500, detail="LLM response not in expected JSON format. Raw: " + llm_output[:500] + "...") # Limit output length

        except Exception as e:
            print(f"Error during LLM generation or parsing: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate analysis: {e}")

    return app # This return statement must be correctly indented to be part of create_app()
