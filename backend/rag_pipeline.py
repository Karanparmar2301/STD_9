import os
from dotenv import load_dotenv
from groq import Groq
try:
    from retrieve_documents import search_documents
except ImportError:
    from backend.retrieve_documents import search_documents

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)
load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def build_context(docs):

    context = ""

    for doc in docs:

        context += f"""
Source: {doc['source']} Page: {doc['page']}

{doc['text']}
--------------------------------
"""

    return context


def generate_answer(question):

    docs = search_documents(question)

    context = build_context(docs)

    prompt = f"""
You are a helpful Class 8 school tutor.

Answer the student's question ONLY using the textbook context below.

If the answer is not in the context, say:
"I cannot find the answer in the provided textbooks."

Context:
{context}

Question:
{question}
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a helpful educational assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )

    return response.choices[0].message.content


if __name__ == "__main__":

    question = "What is photosynthesis?"

    answer = generate_answer(question)

    print("\nAI Answer:\n")
    print(answer)
