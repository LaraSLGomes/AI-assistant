# AI Assistant (Olivia)

Este projeto é uma aplicação de chat com backend em FastAPI e frontend em Next.js. Ele usa Google Gemini para geração de texto e Pinecone para indexação vetorial de documentos, formando uma arquitetura estilo RAG (Retrieval-Augmented Generation).

## Estrutura do projeto

- `backend/`
  - `main.py` - API FastAPI com rota de upload e rota de chat streaming.
  - `.env` - variáveis de ambiente para chave Google e Pinecone.
  - `.venv/` - ambiente Python local.
- `frontend/`
  - `app/page.tsx` - chat UI que envia requisições para o backend.
  - `components/` - componentes React para chat.
  - `package.json` - dependências do Next.js 16.

## O que o sistema faz

- `POST /uploads` recebe PDF ou texto, divide em chunks, gera embeddings e armazena no Pinecone.
- `POST /chat_stream` usa Pinecone para recuperar documentos relevantes e Google Gemini para gerar uma resposta.
- o frontend consome o stream de resposta via `fetch` + `ReadableStream`.

## Como funciona

1. O usuário digita uma pergunta no frontend.
2. O frontend envia essa pergunta ao backend.
3. O backend consulta o índice Pinecone usando embeddings.
4. Pinecone retorna os trechos mais relevantes.
5. O backend passa esses trechos para o modelo Gemini.
6. O modelo gera a resposta e o backend envia ao frontend em streaming.

## Variáveis de ambiente

Crie um arquivo `backend/.env` com:

```env
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=ai-assistant
FRONTEND_URL=http://localhost:3000
```

## Como rodar

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload 
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse o frontend em `http://localhost:3000`.

## Observações importantes

- O Pinecone armazena vetores, não textos literais. Para popular o índice, envie documentos via `POST /uploads`.
- O chat pode responder normalmente com conhecimento geral mesmo sem documentos carregados.
- Se quiser respostas baseadas na sua base, carregue documentos relevantes e faça perguntas relacionadas.
- O backend usa atualmente `gemini-3.5-flash` como modelo de geração.

## Como testar o chat

Use a rota de chat para enviar mensagens:

```bash
curl -X POST http://127.0.0.1:8000/chat_stream \
  -H 'Content-Type: application/json' \
  -d '{"user_message":"Oi"}'
```

## O que falta

- mais tratamento de erros no frontend/backed
- armazenamento dos metadados de upload
- interface de upload de arquivos no frontend

---

Este README reflete o estado atual do projeto e o fluxo de dados entre frontend, backend, Pinecone e Google Gemini.