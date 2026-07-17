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
    // ignorar erros de parse
  }

  return {
    sessions: [initialSession],
    currentSessionId: initialSession.id
  };
};

const Home = () => {
  // correção do erro de Hydration do Next.js
  const [isMounted, setIsMounted] = useState(false);
  
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadInitialState().sessions);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => loadInitialState().currentSessionId);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted) {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ sessions, currentSessionId }));
      } catch {
        // ignorar erros de storage
      }
    }
  }, [sessions, currentSessionId, isMounted]);

  const currentSession = sessions.find(session => session.id === currentSessionId) ?? sessions[0];

  const createNewChat = () => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`;
    const title = `Nova conversa ${sessions.length + 1}`;
    const newSession: ChatSession = { id, title, messages: [] };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(id);
    setCurrentMessage('');
    setCheckpointId(null);
  };

  const switchSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setCheckpointId(null);
    setEditingSessionId(null);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      if (newSessions.length === 0) {
        const id = `session-${Date.now()}`;
        setCurrentSessionId(id);
        return [{ id, title: 'Nova conversa', messages: [] }];
      }
      if (currentSessionId === sessionId) {
        setCurrentSessionId(newSessions[0].id);
      }
      return newSessions;
    });
  };

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const saveEditedTitle = (e?: React.FormEvent | React.FocusEvent) => {
    if (e) e.preventDefault();
    if (!editingSessionId) return;

    setSessions(prev => prev.map(s => 
      s.id === editingSessionId ? { ...s, title: editTitle.trim() || 'Chat sem título' } : s
    ));
    setEditingSessionId(null);
  };

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true);
    try {
      // ajuste direto para o IP local evitando conflito 
      const apiBaseUrl = 'http://127.0.0.1:8000';
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${apiBaseUrl}/uploads`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Servidor retornou status ${response.status}`);
      }
      alert('Documento enviado e processado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      alert('Falha ao enviar documento. Verifique se o backend está rodando.');
    } finally {
      setUploadLoading(false);
    }
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
        searchInfo: { stages: [], query: '', urls: [] }
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
      // Ajuste direto para o IP local evitando conflito com IPv6 do localhost no Mac
      const apiBaseUrl = 'http://127.0.0.1:8000';
      const response = await fetch(`${apiBaseUrl}/chat_stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        if (value) partial += decoder.decode(value, { stream: true });

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
                prev.map(session => session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { ...msg, content: streamedContent, isLoading: true } : msg
                      )
                    }
                  : session)
              );
            } else if (data.type === 'search_start') {
              const newSearchInfo: SearchInfo = { stages: ['searching'], query: data.query, urls: [] };
              searchData = newSearchInfo;
              setSessions(prev =>
                prev.map(session => session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true } : msg
                      )
                    }
                  : session)
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
                prev.map(session => session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true } : msg
                      )
                    }
                  : session)
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
                prev.map(session => session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true } : msg
                      )
                    }
                  : session)
              );
            } else if (data.type === 'end') {
              setSessions(prev =>
                prev.map(session => session.id === sessionId
                  ? {
                      ...session,
                      messages: session.messages.map(msg =>
                        msg.id === aiResponseId ? { 
                          ...msg, 
                          isLoading: false, 
                          searchInfo: searchData ? { ...searchData, stages: [...searchData.stages, 'writing'] } : msg.searchInfo 
                        } : msg
                      )
                    }
                  : session)
              );
            }
          } catch (err) {
            console.error('Error parsing stream JSON:', err, line);
          }
        }
        if (done) break;
      }

      // restauração do bloco de processamento final que evita o infinito "carregando"
      if (partial.trim()) {
        try {
          const data = JSON.parse(partial);
          if (data.type === 'end') {
            setSessions(prev =>
              prev.map(session => session.id === sessionId
                ? { ...session, messages: session.messages.map(msg => msg.id === aiResponseId ? { ...msg, isLoading: false } : msg) }
                : session)
            );
          }
        } catch {
          // ignore incomplete trailing chunk
        }
      }

    } catch (error) {
      console.error('Erro ao processar requisição de chat:', error);
      setSessions(prev =>
        prev.map(session => session.id === sessionId
          ? { ...session, messages: session.messages.map(msg => msg.id === aiResponseId ? { ...msg, content: 'Erro ao conectar-se ao servidor.', isLoading: false } : msg) }
          : session)
      );
    } finally {
      setIsLoading(false);
    }
  };

  // previne renderização antes do Hydration do Next.js
  if (!isMounted) return null;

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen py-8 px-4 font-sans">
      <div className="flex w-full max-w-[1400px] gap-4">
        
        {/* Sidebar */}
        <aside className="w-72 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Sessões</h2>
            <button
              type="button"
              onClick={createNewChat}
              className="rounded-md bg-[#4A3F71] px-3 py-1 text-white text-xs font-medium hover:bg-[#5E507F] transition"
            >
              Novo Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.map(session => {
              const isActive = session.id === currentSessionId;
              const isEditing = editingSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => !isEditing && switchSession(session.id)}
                  className={`group w-full text-left px-4 py-3 border-b border-gray-100 transition cursor-pointer flex justify-between items-center ${isActive ? 'bg-[#F3F3EE]' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    {isEditing ? (
                      <form onSubmit={saveEditedTitle} className="flex">
                        <input 
                          autoFocus
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={saveEditedTitle}
                          className="w-full bg-white border border-teal-300 rounded px-1 py-0.5 text-sm outline-none"
                        />
                      </form>
                    ) : (
                      <div className={`text-sm font-medium truncate ${isActive ? 'text-[#4A3F71]' : 'text-gray-700'}`}>
                        {session.title}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 truncate mt-0.5">{session.messages.length} mensagem(s)</div>
                  </div>

                  {/* Botões de Ação */}
                  {!isEditing && (
                    <div className="hidden group-hover:flex items-center gap-2">
                      <button onClick={(e) => startEditing(e, session)} className="text-gray-400 hover:text-teal-600" title="Renomear">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                      </button>
                      <button onClick={(e) => deleteSession(e, session.id)} className="text-gray-400 hover:text-red-500" title="Deletar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Área Principal */}
        <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex flex-col relative">
          <Header />
          <div className="flex-1 overflow-hidden flex flex-col">
            <MessageArea messages={currentSession?.messages ?? []} />
          </div>
          <InputBar
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            onSubmit={handleSubmit}
            onFileUpload={handleFileUpload}
            isUploading={uploadLoading}
            disabled={isLoading}
          />
        </div>

      </div>
    </div>
  );
};

export default Home;