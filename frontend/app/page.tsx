"use client"

import Header from '@/components/Header';
import InputBar from '@/components/InputBar';
import MessageArea from '@/components/MessageArea';
import React, { FormEvent, useEffect, useState } from 'react';

interface SearchInfo {
  stages: string[];
  query: string;
  urls: string[];
  error?: string;
}

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: SearchInfo;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

const LOCAL_STORAGE_KEY = 'chat_app_state';

const initialSession: ChatSession = {
  id: 'session-1',
  title: 'Nova conversa',
  messages: [
    {
      id: 1,
      content: 'Olá! Como posso ajudar?',
      isUser: false,
      type: 'message'
    }
  ]
};

const loadInitialState = () => {
  if (typeof window === 'undefined') {
    return {
      sessions: [initialSession],
      currentSessionId: initialSession.id
    };
  }

  try {
    const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { sessions: ChatSession[]; currentSessionId: string };
      if (parsed?.sessions?.length) {
        return {
          sessions: parsed.sessions,
          currentSessionId: parsed.currentSessionId || parsed.sessions[0].id
        };
      }
    }
  } catch {
    // ignore parse errors
  }

  return {
    sessions: [initialSession],
    currentSessionId: initialSession.id
  };
};

const Home = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadInitialState().sessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => loadInitialState().currentSessionId);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ sessions, currentSessionId }));
    } catch {
      // ignore storage errors
    }
  }, [sessions, currentSessionId]);

  const currentSession = sessions.find(session => session.id === currentSessionId) ?? sessions[0];

  const createNewChat = () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
    const title = `Nova conversa ${sessions.length + 1}`;
    const newSession: ChatSession = {
      id,
      title,
      messages: []
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(id);
    setCurrentMessage('');
    setCheckpointId(null);
  };

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setCheckpointId(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const sessionId = currentSessionId;
    const sessionMessages = sessions.find(session => session.id === sessionId)?.messages ?? [];
    const userInput = currentMessage.trim();
    const nextId = sessionMessages.length > 0 ? Math.max(...sessionMessages.map(msg => msg.id)) + 1 : 1;
    const aiResponseId = nextId + 1;

    const updatedMessages = [
      ...sessionMessages,
      { id: nextId, content: userInput, isUser: true, type: 'message' },
      {
        id: aiResponseId,
        content: '',
        isUser: false,
        type: 'message',
        isLoading: true,
        searchInfo: {
          stages: [],
          query: '',
          urls: []
        }
      }
    ];

    setSessions(prev =>
      prev.map(session =>
        session.id === sessionId ? { ...session, messages: updatedMessages } : session
      )
    );
    setCurrentMessage('');
    setIsLoading(true);

    const chatHistory = [...sessionMessages.map(msg => ({ role: msg.isUser ? 'user' : 'assistant', content: msg.content })), { role: 'user', content: userInput }];

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const response = await fetch(`${apiBaseUrl}/chat_stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_message: userInput,
          chat_history: chatHistory,
          checkpoint_id: checkpointId
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';
      let partial = '';
      let searchData: SearchInfo | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          partial += decoder.decode(value, { stream: true });
        }

        const lines = partial.split('\n');
        partial = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);

            if (data.type === 'checkpoint') {
              setCheckpointId(data.checkpoint_id);
            } else if (data.type === 'content') {
              streamedContent += data.content;
              setSessions(prev =>
                prev.map(session =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: session.messages.map(msg =>
                          msg.id === aiResponseId ? { ...msg, content: streamedContent, isLoading: true } : msg
                        )
                      }
                    : session
                )
              );
            } else if (data.type === 'search_start') {
              const newSearchInfo: SearchInfo = {
                stages: ['searching'],
                query: data.query,
                urls: []
              };
              searchData = newSearchInfo;
              setSessions(prev =>
                prev.map(session =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: session.messages.map(msg =>
                          msg.id === aiResponseId
                            ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                            : msg
                        )
                      }
                    : session
                )
              );
            } else if (data.type === 'search_results') {
              const urls = typeof data.urls === 'string' ? JSON.parse(data.urls) : data.urls;
              const newSearchInfo: SearchInfo = {
                stages: searchData ? [...searchData.stages, 'reading'] : ['reading'],
                query: searchData?.query || '',
                urls
              };
              searchData = newSearchInfo;
              setSessions(prev =>
                prev.map(session =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: session.messages.map(msg =>
                          msg.id === aiResponseId
                            ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                            : msg
                        )
                      }
                    : session
                )
              );
            } else if (data.type === 'search_error') {
              const newSearchInfo: SearchInfo = {
                stages: searchData ? [...searchData.stages, 'error'] : ['error'],
                query: searchData?.query || '',
                error: data.error,
                urls: []
              };
              searchData = newSearchInfo;
              setSessions(prev =>
                prev.map(session =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: session.messages.map(msg =>
                          msg.id === aiResponseId
                            ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                            : msg
                        )
                      }
                    : session
                )
              );
            } else if (data.type === 'end') {
              setSessions(prev =>
                prev.map(session =>
                  session.id === sessionId
                    ? {
                        ...session,
                        messages: session.messages.map(msg =>
                          msg.id === aiResponseId
                            ? {
                                ...msg,
                                isLoading: false,
                                searchInfo: searchData
                                  ? { ...searchData, stages: [...searchData.stages, 'writing'] }
                                  : msg.searchInfo
                              }
                            : msg
                        )
                      }
                    : session
                )
              );
            }
          } catch (err) {
            console.error('Error parsing stream JSON:', err, line);
          }
        }

        if (done) break;
      }

      if (partial.trim()) {
        try {
          const data = JSON.parse(partial);
          if (data.type === 'end') {
            setSessions(prev =>
              prev.map(session =>
                session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { ...msg, isLoading: false } : msg
                      )
                    }
                  : session
              )
            );
          }
        } catch {
          // ignore incomplete trailing chunk
        }
      }
    } catch (error) {
      console.error('Erro ao processar requisição de chat:', error);
      setSessions(prev =>
        prev.map(session =>
          session.id === sessionId
            ? {
                ...session,
                messages: session.messages.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: 'Erro ao conectar-se ao servidor.', isLoading: false }
                    : msg
                )
              }
            : session
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploadStatus(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleUploadSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) return;

    setUploadLoading(true);
    setUploadStatus(null);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${apiBaseUrl}/uploads`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }

      setUploadStatus('Documento enviado com sucesso.');
      setSelectedFile(null);
      event.currentTarget.reset();
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      setUploadStatus('Falha ao enviar documento. Tente novamente.');
    } finally {
      setUploadLoading(false);
    }
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen py-8 px-4">
      <div className="flex w-full max-w-[1400px] gap-4">
        <aside className="w-72 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Sessões</h2>
            <button
              type="button"
              onClick={createNewChat}
              className="rounded-md bg-blue-600 px-3 py-1 text-white text-xs font-medium hover:bg-blue-700 transition"
            >
              Novo Chat
            </button>
          </div>
          <div className="max-h-[calc(100vh-96px)] overflow-auto">
            {sessions.map(session => {
              const isActive = session.id === currentSessionId;
              return (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => switchSession(session.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition ${isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}
                >
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-gray-500 truncate">{session.messages.length} mensagem(s)</div>
                </button>
              );
            })}
          </div>
        </aside>
        <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
          <Header />
          <div className="px-6 py-4 border-b border-gray-200">
            <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!selectedFile || uploadLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {uploadLoading ? 'Enviando documento...' : 'Enviar PDF'}
              </button>
            </form>
            {uploadStatus && <p className="mt-2 text-sm text-gray-600">{uploadStatus}</p>}
          </div>
          <div className="flex-1 overflow-hidden">
            <MessageArea messages={currentSession?.messages ?? []} />
          </div>
          <InputBar
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSubmit={handleSubmit}
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default Home;
