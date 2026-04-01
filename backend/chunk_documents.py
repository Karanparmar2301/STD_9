from load_documents import load_pdfs
from langchain_text_splitters import RecursiveCharacterTextSplitter


def chunk_documents():

    documents = load_pdfs()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=300,
        separators=["\n\n", "\n", ".", " "]
    )

    chunks = text_splitter.split_documents(documents)

    print(f"Total Chunks Created: {len(chunks)}")

    return chunks


if __name__ == "__main__":

    chunks = chunk_documents()

    print(chunks[0])
