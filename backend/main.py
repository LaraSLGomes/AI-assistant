import json
import os
import traceback
import uuid
from typing import Generator, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI
from langchain.chains import RetrievalQA
from langchain_pinecone import PineconeVectorStore

load_dotenv()

app = FastAPI()

# Configuração de CORS original
frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = [
    frontend_url,
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

missing_vars = [
    name for name, val in [
        ("GOOGLE_API_KEY", GOOGLE_API_KEY),
        ("PINECONE_API_KEY", PINECONE_API_KEY),
        ("PINECONE_INDEX_NAME", PINECONE_INDEX_NAME),
    ] if not val
]
if missing_vars:
    print(f"[AVISO] Variáveis de ambiente ausentes: {', '.join(missing_vars)}")
    print("[AVISO] Confira o arquivo .env na pasta backend/")

embeddings = GoogleGenerativeAIEmbeddings(
    model="models/gemini-embedding-001",
    google_api_key=GOOGLE_API_KEY,
)

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/")
def home():
    return {"message": "API rodando!"}


@app.post("/uploads")
def upload_file(file: UploadFile = File(...)):
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(file.file.read())

        loader = PyPDFLoader(file_path) if file.filename.endswith(".pdf") else TextLoader(file_path)
        documents = loader.load()

        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = text_splitter.split_documents(documents)

        PineconeVectorStore.from_documents(
            chunks,
            embeddings,
            index_name=PINECONE_INDEX_NAME
        )

        return {"message": f"Arquivo {file.filename} enviado com sucesso!"}
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(exc)})


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_message: str
    chat_history: List[ChatHistoryItem] = []
    checkpoint_id: Optional[str] = None


@app.post("/chat_stream")
def chat_stream(request: ChatRequest):
    try:
        vectorstore = PineconeVectorStore.from_existing_index(
            index_name=PINECONE_INDEX_NAME,
            embedding=embeddings
        )

        qa_chain = RetrievalQA.from_chain_type(
            llm=ChatGoogleGenerativeAI(
                model="gemini-3.5-flash",
                google_api_key=GOOGLE_API_KEY,
            ),
            chain_type="stuff",
            retriever=vectorstore.as_retriever()
        )

        # .run() está deprecated desde langchain 0.1.0 e some na v1.0 -> trocado por .invoke()
        result = qa_chain.invoke({"query": request.user_message})
        answer = result["result"]

        def event_stream() -> Generator[str, None, None]:
            for letter in answer:
                yield json.dumps({"type": "content", "content": letter}) + "\n"
            yield json.dumps({"type": "end"}) + "\n"

        return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(exc)})