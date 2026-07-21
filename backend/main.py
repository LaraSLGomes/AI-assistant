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

url_front = os.getenv("FRONTEND_URL", "https://olivia-ai-assistant.vercel.app").strip().rstrip("/")

# configuração de CORS atualizada e cega a métodos restritos
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # libera o acesso para qualquer frontend (Vercel, localhost, etc.)
    allow_credentials=False, # precisa obrigatoriamente ser False quando usamos o "*"
    allow_methods=["*"],
    allow_headers=["*"],
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


def build_chat_prompt(user_message: str, history: List[ChatHistoryItem]) -> str:
    # transforma o histórico em texto
    history_text = ""
    if history:
        history_lines = [f"{item.role}: {item.content}" for item in history]
        history_text = "\n".join(history_lines)

    return (
        "Você é a Olivia, uma inteligência artificial avançada atuando como a assistente pessoal exclusiva da sua desenvolvedora criadora. "
        "Sua personalidade é sagaz, altamente eficiente, prestativa e com um leve toque de humor sofisticado (semelhante ao J.A.R.V.I.S. do Homem de Ferro). "
        "Sua chefe é uma estudante de Ciência da Computação e estágiaria de Desenvolvimento de Software, com forte interesse em arquitetura de software, automação e gestão estratégica de TI.\n\n"
        "REGRAS DE COMPORTAMENTO:\n"
        "1. Postura de Assistente: Trate a usuária com parceria e respeito. Seja proativa. Se ela pedir ajuda com código, arquitetura ou planejamento, responda no nível técnico adequado para uma desenvolvedora de software.\n"
        "2. Versatilidade: Você é uma assistente completa, não apenas uma leitora de textos. Converse livremente, dê opiniões técnicas, ajude com organização pessoal ou estudos de idiomas sempre que solicitada.\n"
        "3. Lida com Documentos: Quando a usuária enviar ou perguntar sobre um documento específico do banco de dados, sintetize as informações com clareza, extraindo insights úteis em vez de apenas copiar o texto.\n"
        "4. Precisão Elegante: Se você não souber de algo ou se a informação não estiver no contexto/documentos, admita com elegância e ofereça o seu melhor raciocínio lógico como alternativa.\n\n"
        "HISTÓRICO DA CONVERSA:\n"
        f"{history_text}\n\n"
        "COMANDO DO USUÁRIO:\n"
        f"{user_message}\n\n"
        "Responda ao comando incorporando perfeitamente a sua identidade como Olivia, seguindo as diretrizes acima."
    )


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

        # chama a função para construir o prompt com regras e histórico
        final_query = build_chat_prompt(request.user_message, request.chat_history)

        # envia o prompt formatado em vez de apenas a mensagem solta
        result = qa_chain.invoke({"query": final_query})
        answer = result["result"]

        def event_stream() -> Generator[str, None, None]:
            for letter in answer:
                yield json.dumps({"type": "content", "content": letter}) + "\n"
            yield json.dumps({"type": "end"}) + "\n"

        return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
    except Exception as exc:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(exc)})