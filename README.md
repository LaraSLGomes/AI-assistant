# Olivia - Advanced AI Personal Assistant

Olivia is a full-stack, personalized AI assistant built with a robust **Retrieval-Augmented Generation (RAG)** architecture. Designed to act as an efficient and highly analytical tech partner, the system seamlessly integrates a fast Python backend with a modern React frontend to provide context-aware responses and intelligent document analysis.

## Tech Stack & Architecture

- **Frontend:** Next.js (React), deployed on Vercel
- **Backend:** Python, FastAPI, deployed on Render
- **AI & LLM:** Google Gemini (`gemini-3.5-flash`), LangChain
- **Vector Database:** Pinecone

## Project Structure

This repository is organized as a monorepo containing both the frontend and backend services:

- `backend/`
  - `main.py` - FastAPI application containing the core logic, upload endpoints, and the LLM streaming chat route.
  - `.env` - Environment variables configuration.
  - `requirements.txt` - Python dependencies for deployment.
- `frontend/`
  - `app/page.tsx` - Main chat UI handling user interactions and backend requests.
  - `components/` - Reusable React components for the chat interface.
  - `package.json` - Next.js dependencies and scripts.

## Core Features

- **Document Ingestion (`POST /uploads`):** Accepts PDF or raw text files, splits them into manageable chunks using LangChain, generates embeddings via Google Generative AI, and stores them in Pinecone.
- **Context-Aware Streaming Chat (`POST /chat_stream`):** Leverages Pinecone to retrieve highly relevant document snippets based on the user's prompt. The Gemini model then synthesizes this context into a coherent answer, streaming the response back to the client in real-time.
- **Custom AI Persona:** The system includes a custom prompt builder that gives the AI a distinct, highly efficient, and proactive personality, tailored to assist with software development, strategic planning, and daily workflows.

## Data Flow

1. The user inputs a query via the Next.js interface.
2. The frontend sends the prompt and chat history to the FastAPI backend.
3. The backend vectorizes the query and searches the Pinecone index for contextual matches.
4. Pinecone returns the most relevant document chunks.
5. The backend injects these chunks, alongside behavior rules and chat history, into the Gemini model.
6. The model generates the response, which the backend streams back to the frontend using `ReadableStream`.

## Deployment

The application is designed to be easily deployed using modern cloud platforms.

### 1. Backend (Render)
Create a new **Web Service** on [Render](https://render.com/) pointing to the `backend` directory.
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`
- **Environment Variables:**
  - `PYTHON_VERSION`: `3.11.9` *(Required for Langchain compatibility)*
  - `GOOGLE_API_KEY`: Your Google Gemini API Key
  - `PINECONE_API_KEY`: Your Pinecone API Key
  - `PINECONE_INDEX_NAME`: Your vector database index name
  - `FRONTEND_URL`: `https://your-frontend-app.vercel.app` *(Without trailing slash, required for CORS)*

### 2. Frontend (Vercel)
Import the repository into [Vercel](https://vercel.com/) and set the root directory to `frontend`.
- **Framework Preset:** Next.js
- **Environment Variables:**
  - `NEXT_PUBLIC_API_URL`: `https://your-backend-app.onrender.com` *(Without trailing slash)*

## Local Development

### Running the Backend

Open a terminal and start the FastAPI server:

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload 
```
*The API will be available at `http://127.0.0.1:8000`.*

### Running the Frontend

Open a new terminal and start the Next.js development server:

```bash
cd frontend
npm install
npm run dev
```
*The application UI will be available at `http://localhost:3000`.*

## Important Notes

- **Vector Storage:** Pinecone stores mathematical representations (vectors), not raw text. To populate the knowledge base, you must upload documents via the UI or the `POST /uploads` endpoint.
- **Fallback Knowledge:** Even if no documents are uploaded, Olivia will use her baseline training to answer general queries and assist with tasks.
- **CORS Policy:** The backend is configured with a wildcard (`*`) to accept requests from any origin, ensuring smooth communication with the Vercel deployment while running serverless.
