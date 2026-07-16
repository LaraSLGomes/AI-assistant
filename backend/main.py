import json
import os
import uuid
from typing import Generator, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from langchain_pinecone import PineconeVectorStore

load_dotenv()

app = FastAPI()

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = [frontend_url]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=True,
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY não configurada no backend")

embeddings = OpenAIEmbeddings()

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")
if not PINECONE_INDEX_NAME:
    raise RuntimeError("PINECONE_INDEX_NAME não configurado no backend")

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def home():
    return {"message": "API rodando\!"}

@app.post("/uploads")
def upload_file(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    if file.filename.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path)

    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_documents(documents)

    vectorstore = PineconeVectorStore.from_documents(
        chunks,
        embeddings,
        index_name=PINECONE_INDEX_NAME
    )

    return {"message": f"Arquivo {file.filename} enviado e vetorizado com sucesso\!"}

@app.get("/chat_stream/{user_message}")
def chat_stream(user_message: str, checkpoint_id: Optional[str] = None):
    vectorstore = PineconeVectorStore.from_existing_index(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings
    )

    retriever = vectorstore.as_retriever()

    qa_chain = RetrievalQA.from_chain_type(
        llm=ChatOpenAI(model="gpt-3.5-turbo", temperature=0.2),
        chain_type="stuff",
        retriever=retriever
    )

    answer = qa_chain.run(user_message)

    if checkpoint_id is None:
        checkpoint_id = str(uuid.uuid4())

    def event_stream() -> Generator[str, None, None]:
        yield f"data: {json.dumps({'type': 'checkpoint', 'checkpoint_id': checkpoint_id})}\n\n"
        for letter in answer:
            payload = {"type": "content", "content": letter}
            yield f"data: {json.dumps(payload)}\n\n"
        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/retrieve")
def retrieve_answer(query: str):
    vectorstore = PineconeVectorStore.from_existing_index(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings
    )

    retriever = vectorstore.as_retriever()

    qa_chain = RetrievalQA.from_chain_type(
        llm=ChatOpenAI(model="gpt-3.5-turbo"),
        chain_type="stuff",
        retriever=retriever
    )

    result = qa_chain.run(query)

    return {"message": "Answer generated successfully", "answer": result}
