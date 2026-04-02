import ast
import astunparse

with open("c:/student dashboard/main.py", "r", encoding="utf-8") as f:
    source = f.read()

tree = ast.parse(source)

# We want to remove:
# - Imports of `backend.rag`
# - `rag_pipeline` function
# - `_groq_rag_reply` async function
# - `rag_chat` async function route
# - `rebuild_rag_index` route
# - `rebuild_rag_index_status` route
# - `_startup_build_rag_index` route
# - assignments to RAG vars like `RAG_ENGINE_AVAILABLE`, `_rag_generate`, `_RAG_REBUILD_STATE`, `_RAG_REBUILD_THREAD`

class RagRemover(ast.NodeTransformer):
    def visit_Import(self, node):
        for alias in node.names:
            if alias.name.startswith("backend.rag"):
                return None
            if alias.name == "rag_pipeline":
                return None
        return node
    
    def visit_ImportFrom(self, node):
        if node.module and node.module.startswith("backend.rag"):
            return None
        return node

    def visit_FunctionDef(self, node):
        names_to_remove = {"rag_pipeline", "_startup_build_rag_index"}
        if node.name in names_to_remove:
            return None
        return self.generic_visit(node)

    def visit_AsyncFunctionDef(self, node):
        names_to_remove = {
            "_groq_rag_reply", 
            "rag_chat", 
            "rebuild_rag_index", 
            "rebuild_rag_index_status",
            "_startup_build_rag_index"
        }
        if node.name in names_to_remove:
            return None
        return self.generic_visit(node)

    def visit_Assign(self, node):
        for target in node.targets:
            if isinstance(target, ast.Name):
                if target.id in {
                    "RAG_ENGINE_AVAILABLE", 
                    "_rag_generate", 
                    "_RAG_REBUILD_STATE", 
                    "_RAG_REBUILD_THREAD"
                }:
                    return None
        return self.generic_visit(node)
    
    def visit_Try(self, node):
        # Remove try blocks that import rag
        for body_node in node.body:
            if isinstance(body_node, ast.ImportFrom):
                if body_node.module and body_node.module.startswith("backend.rag"):
                    return None
        return self.generic_visit(node)

transformer = RagRemover()
new_tree = transformer.visit(tree)

# Note: AST unparse will change formatting. Instead, maybe it's safer to use regex or string replacements for precise lines, or just rewrite it with astunparse and format with black if available.
