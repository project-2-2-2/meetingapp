# ai-backend/rag_pipeline.py

import os
import shutil # Import shutil for rmtree
from langchain_community.document_loaders import TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import SentenceTransformerEmbeddings
from langchain_chroma import Chroma
from typing import List

# Define the directory for persistent ChromaDB storage
CHROMA_DB_PATH = "data/chroma_db"
DOCS_DIR = "data" # Parent directory for candidates and jobs

class RAGPipeline:
    """
    Manages document loading, chunking, embedding, and retrieval for RAG.
    Uses ChromaDB as the vector store and SentenceTransformer for embeddings.
    """
    def __init__(self):
        # Initialize the embedding model
        self.embeddings = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
        self.vectorstore = None
        self._initialize_vectorstore()
        print("RAGPipeline initialized.")

    def _initialize_vectorstore(self):
        """
        Initializes ChromaDB, loading from disk if it exists, otherwise creating.
        """
        # Ensure the directory exists first, as ChromaDB might expect it
        os.makedirs(CHROMA_DB_PATH, exist_ok=True)

        if os.path.exists(CHROMA_DB_PATH) and os.listdir(CHROMA_DB_PATH):
            print(f"Loading ChromaDB from {CHROMA_DB_PATH}")
            try:
                # When loading from a persistent directory, Chroma handles underlying client creation
                self.vectorstore = Chroma(persist_directory=CHROMA_DB_PATH, embedding_function=self.embeddings)
                # You might want to run a simple query to ensure it's functional
                # A small query to confirm the database is usable
                _ = self.vectorstore.similarity_search("test query for db check", k=1)
                print("ChromaDB loaded successfully.")
            except Exception as e:
                print(f"Error loading ChromaDB from {CHROMA_DB_PATH}, attempting to re-create: {e}")
                # If loading fails, it might be corrupted or incompatible, so remove and recreate
                if os.path.exists(CHROMA_DB_PATH):
                    shutil.rmtree(CHROMA_DB_PATH) # Remove existing, potentially corrupted dir
                    os.makedirs(CHROMA_DB_PATH) # Recreate empty dir
                self._create_new_vectorstore()
        else:
            print(f"ChromaDB not found at {CHROMA_DB_PATH} or is empty. Creating new.")
            self._create_new_vectorstore()

    def _create_new_vectorstore(self):
        """
        Creates a new ChromaDB instance. Persistence is managed by `persist_directory`
        on the Chroma class itself.
        """
        os.makedirs(CHROMA_DB_PATH, exist_ok=True) # Ensure dir exists
        self.vectorstore = Chroma(persist_directory=CHROMA_DB_PATH, embedding_function=self.embeddings)
        print(f"New ChromaDB created at {CHROMA_DB_PATH}.")

    def ingest_documents(self, doc_paths: List[str]):
        """
        Loads documents from specified paths, chunks them, and adds them to the vector store.
        """
        documents = []
        for path in doc_paths:
            if not os.path.exists(path):
                print(f"Warning: Document not found at {path}. Skipping.")
                continue
            try:
                loader = TextLoader(path)
                documents.extend(loader.load())
            except Exception as e:
                print(f"Error loading document {path}: {e}")

        if not documents:
            print("No documents loaded for ingestion.")
            return

        # Split documents into smaller chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)
        print(f"Ingesting {len(chunks)} chunks from {len(documents)} documents.")

        # Add chunks to the vector store. This will embed them and store them.
        self.vectorstore.add_documents(chunks)
        # Explicit persist() call is typically not needed here with newer Chroma/Langchain versions
        # as persistence is often handled automatically when persist_directory is set, or on client shutdown.
        print("Documents ingested and vector store updated.")

    def retrieve_context(self, query: str, k: int = 3) -> List[str]:
        """
        Retrieves relevant document chunks based on a query.
        """
        if not self.vectorstore:
            print("Vector store not initialized. Cannot retrieve context.")
            return []

        results = self.vectorstore.similarity_search(query, k=k)
        retrieved_texts = [doc.page_content for doc in results]
        print(f"Retrieved {len(retrieved_texts)} chunks for query: '{query[:50]}...'")
        return retrieved_texts

    def get_document_content(self, file_path: str) -> str:
        """
        Reads and returns the full content of a text document.
        """
        if not os.path.exists(file_path):
            return f"Error: File not found at {file_path}"
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file {file_path}: {e}"

# Example Usage (for testing or initial data loading)
if __name__ == "__main__":
    # Ensure data directories exist for this standalone test
    os.makedirs(os.path.join(DOCS_DIR, "candidates"), exist_ok=True)
    os.makedirs(os.path.join(DOCS_DIR, "jobs"), exist_ok=True)

    # Create dummy files if they don't exist for testing this script directly
    with open(os.path.join(DOCS_DIR, "candidates", "candidate_john_doe_resume.txt"), "w") as f:
        f.write("John Doe resume content for testing.")
    with open(os.path.join(DOCS_DIR, "jobs", "job_senior_sw_engineer.txt"), "w") as f:
        f.write("Senior Software Engineer job description for testing.")


    rag_pipeline = RAGPipeline()

    # Define paths to your candidate resumes and job descriptions
    candidate_resume_path = os.path.join(DOCS_DIR, "candidates", "candidate_john_doe_resume.txt")
    job_desc_path = os.path.join(DOCS_DIR, "jobs", "job_senior_sw_engineer.txt")

    # Ingest documents. This only needs to be run once or when documents change.
    print("\nIngesting documents...")
    rag_pipeline.ingest_documents([candidate_resume_path, job_desc_path])
    print("Document ingestion complete.")

    # Example retrieval
    print("\nRetrieving context for 'John Doe's experience with Python projects'...")
    retrieved_john_doe_context = rag_pipeline.retrieve_context("John Doe's experience with Python projects", k=2)
    for i, text in enumerate(retrieved_john_doe_context):
        print(f"--- Retrieved Context {i+1} ---")
        print(text[:200] + "...") # Print first 200 chars

    print("\nRetrieving context for 'required qualifications for software engineer'...")
    retrieved_job_context = rag_pipeline.retrieve_context("required qualifications for software engineer", k=1)
    for i, text in enumerate(retrieved_job_context):
        print(f"--- Retrieved Context {i+1} ---")
        print(text[:200] + "...")