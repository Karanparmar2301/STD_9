from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from ..services.retriever import perform_hybrid_search
from ..services.generator import generate_answer_from_context

router = APIRouter()

class AskRequest(BaseModel):
    query: str
    subject: Optional[str] = None
    year_class: Optional[int] = 9
    chapter: Optional[str] = None

class SourceModel(BaseModel):
    text: str
    subject: Optional[str]
    chapter: Optional[str]
    score: float

class AskResponse(BaseModel):
    answer: str
    sources: List[SourceModel]

@router.post("/ask", response_model=AskResponse)
async def ask_question(request: AskRequest):
    try:
        # Retrieve context
        top_k = 5
        results = perform_hybrid_search(
            query=request.query,
            subject=request.subject,
            year_class=request.year_class,
            chapter=request.chapter,
            top_k=top_k
        )
        
        if not results:
            return AskResponse(answer="This answer is not available in the textbook.", sources=[])
        
        # Guardrail on threshold
        semantic_threshold = 0.55 # Minimum relevance 
        filtered_results = [r for r in results if r["semantic_score"] > semantic_threshold]
        
        if not filtered_results:
            # Re-read
            if max(r["semantic_score"] for r in results) < semantic_threshold:
                 return AskResponse(answer="This answer is not available in the textbook.", sources=[])
                 
        # Build Context String (up to 1500 tokens / 6000 chars roughly)
        context_parts = []
        char_count = 0
        sources_list = []
        for r in filtered_results:
            if char_count + len(r["text"]) > 6000:
                break
            context_parts.append(r["text"])
            char_count += len(r["text"])
            
            sources_list.append(SourceModel(
                text=r["text"][:100] + "...", 
                subject=r["subject"],
                chapter=r["chapter"],
                score=r["final_score"]
            ))
            
        context_str = "\n---\n".join(context_parts)
        
        # Generate answer via LLM
        answer = generate_answer_from_context(
            query=request.query,
            context=context_str,
            subject=request.subject
        )
        
        return AskResponse(answer=answer, sources=sources_list)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import File, Form, UploadFile
from fastapi.responses import JSONResponse
@router.post('/api/assistant/rag-chat')
async def assistant_rag_chat(message: str = Form(...), student_name: str = Form('Student'), subject_filter: str = Form(''), image: UploadFile = File(None)):
    req = AskRequest(query=message, subject=subject_filter if subject_filter else None)
    res = await ask_question(req)
    return JSONResponse({'answer': res.answer, 'sources': [s.dict() for s in res.sources]})
