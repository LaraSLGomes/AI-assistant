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

const defaultMessages: Message[] = [
  {
    id: 1,
    content: 'Olá! Como posso ajudar?',
    isUser: false,
    type: 'message'
  }
];

const Home = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return defaultMessages;

    try {
      const stored = window.localStorage.getItem('chat_messages');
      return stored ? JSON.parse(stored) : defaultMessages;
    } catch {
      return defaultMessages;
    }
  });
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('chat_messages', JSON.stringify(messages));
    } catch {
      // ignore storage errors
    }
  }, [messages]);

  const buildChatHistory = () => {
    return messages.map(msg => ({
      role: msg.isUser ? 'user' : 'assistant',
      content: msg.content
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userInput = currentMessage.trim();
    const newMessageId = messages.length > 0 ? Math.max(...messages.map(msg => msg.id)) + 1 : 1;
    const aiResponseId = newMessageId + 1;

    setMessages(prev => [
      ...prev,
      { id: newMessageId, content: userInput, isUser: true, type: 'message' },
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
    ]);

    setCurrentMessage('');
    setIsLoading(true);

    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      const chatHistory = [...buildChatHistory(), { role: 'user', content: userInput }];

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
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, isLoading: true }
                    : msg
                )
              );
            } else if (data.type === 'search_start') {
              const newSearchInfo: SearchInfo = {
                stages: ['searching'],
                query: data.query,
                urls: []
              };
              searchData = newSearchInfo;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                    : msg
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
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                    : msg
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
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === aiResponseId
                    ? { ...msg, content: streamedContent, searchInfo: newSearchInfo, isLoading: true }
                    : msg
                )
              );
            } else if (data.type === 'end') {
              if (searchData) {
                const finalSearchInfo = {
                  ...searchData,
                  stages: [...searchData.stages, 'writing']
                };
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, searchInfo: finalSearchInfo, isLoading: false }
                      : msg
                  )
                );
              } else {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === aiResponseId
                      ? { ...msg, isLoading: false }
                      : msg
                  )
                );
              }
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
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiResponseId
                  ? { ...msg, isLoading: false }
                  : msg
              )
            );
          }
        } catch {
          // ignorar fragmento final incompleto
        }
      }
    } catch (error) {
      console.error('Erro ao processar requisição de chat:', error);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === aiResponseId
            ? { ...msg, content: 'Erro ao conectar-se ao servidor.', isLoading: false }
            : msg
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
      {/* contêiner principal com sombra refinada e borda */}
      <div className="w-[70%] bg-white flex flex-col rounded-xl shadow-lg border border-gray-100 overflow-hidden h-[90vh]">
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
        <MessageArea messages={messages} />
        <InputBar
          currentMessage={currentMessage}
          setCurrentMessage={setCurrentMessage}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />
      </div>
    </div>
  );
};

export default Home;