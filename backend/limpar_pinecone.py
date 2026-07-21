import os 
from dotenv import load_dotenv 
from pinecone import Pinecone

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
    print("erro: chaves não encontrada")
    exit()

print(f"conectando ao indice: {PINECONE_INDEX_NAME}")

pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(PINECONE_INDEX_NAME)

index.delete(delete_all=True)

print("deletado com sucesso!")