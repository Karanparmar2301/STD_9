import asyncio
from backend.api.routes import AskRequest, ask_question
from backend.services.retriever import perform_hybrid_search

async def test():
    req = AskRequest(query="What is science?", subject="science")
    try:
        # manual test
        top_k = 5
        results = perform_hybrid_search(
            query=req.query,
            subject=req.subject,
            year_class=req.year_class,
            chapter=req.chapter,
            top_k=top_k
        )
        print("Results:", len(results))
        res = await ask_question(req)
        print("Final res:", res)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
