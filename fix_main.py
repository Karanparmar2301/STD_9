import re

with open('c:/student dashboard/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

# clean up previously appended bad lines
text = text.replace("from backend.api.routes import router as rag_router\napp.include_router(rag_router, tags=['RAG'])", "")
text = text.replace("from backend.api.routes import router as rag_router\napp.include_router(rag_router, prefix='/api/rag', tags=['RAG'])", "")

# insert correctly
if "app.include_router(rag_router" not in text:
    split_target = 'if __name__ == "__main__":'
    if split_target in text:
        parts = text.split(split_target)
        new_text = parts[0] + "from backend.api.routes import router as rag_router\napp.include_router(rag_router, prefix='/api/rag', tags=['RAG'])\n\n" + split_target + parts[1]
        with open('c:/student dashboard/main.py', 'w', encoding='utf-8') as f:
            f.write(new_text)
        print("Fixed routes")
    else:
        print("Couldn't find __main__ block")
else:
    print("Route already exists")
