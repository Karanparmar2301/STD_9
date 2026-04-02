import os
from groq import Groq
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
load_dotenv(dotenv_path=env_path)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MODEL_NAME = "llama3-70b-8192"

def generate_answer_from_context(query, context, subject=None):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set")
    
    client = Groq(api_key=api_key)
    
    system_prompt = "You are a professional CBSE AI tutor for Class 8-10 students. Answer the student's question STRICTLY from the provided NCERT textbook context.\n\n" \
                    "- Do NOT hallucinate. Do NOT use outside knowledge.\n" \
                    "- If the provided context does NOT contain the answer, you must output EXACTLY and ONLY this warning sentence: 'This answer is not available in the textbook'.\n" \
                    "- Explain the concepts simply and clearly, as if teaching a student."
    
    if subject:
        system_prompt += f"\nThe subject is {subject}."
        
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context:\n{context}\n\nQuestion:\n{query}"}
    ]
    
    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=messages,
        temperature=0.0,
        max_tokens=512,
        top_p=0.1
    )
    
    return response.choices[0].message.content
