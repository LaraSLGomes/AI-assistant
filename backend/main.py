import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from langchain_pinecone import PineconeVectorStore

load_dotenv()

app = FastAPI()
embeddings = OpenAIEmbeddings()

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def home():
    return {"message": "API rodando!"}

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
    
    # envia os embeddings diretamente para a nuvem do Pinecone
    vectorstore = PineconeVectorStore.from_documents(
        chunks, 
        embeddings, 
        index_name=PINECONE_INDEX_NAME
    )
    
    return {"message": f"Arquivo {file.filename} enviado e vetorizado com sucesso!"}

@app.get("/retrieve")
def retrieve_answer(query: str):
    # busca referência do índice criado diretamente na nuvem
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