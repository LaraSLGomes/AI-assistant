# Olivia - Advanced AI Personal Assistant

Olivia is a full-stack, personalized AI assistant built with a robust **Retrieval-Augmented Generation (RAG)** architecture. Designed to act as an efficient and highly analytical tech partner, the system seamlessly integrates a fast Python backend with a modern React frontend to provide context-aware responses and intelligent document analysis.

## Tech Stack & Architecture

- **Frontend:** Next.js (React)
- **Backend:** Python, FastAPI
- **AI & LLM:** Google Gemini (`gemini-3.5-flash`), LangChain
- **Vector Database:** Pinecone

## Project Structure

This repository is organized as a monorepo containing both the frontend and backend services:

- `backend/`
  - `main.py` - FastAPI application containing the core logic, upload endpoints, and the LLM streaming chat route.
  - `.env` - Environment variables configuration.
  - `.venv/` - Local Python virtual environment.
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

## Environment Variables

Create a `.env` file inside the `backend/` directory with the following keys:

```env
GOOGLE_API_KEY=your_google_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=ai-assistant-oficial
FRONTEND_URL=http://localhost:3000
