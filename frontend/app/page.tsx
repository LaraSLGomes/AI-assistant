"use client"

import Header from '@/components/Header';
import InputBar from '@/components/InputBar';
import MessageArea from '@/components/MessageArea';
import React, { FormEvent, useState } from 'react';

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

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      content: 'Olá! Como posso ajudar?',
      isUser: false,
      type: 'message'
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentMessage.trim()) {
      // mensagem do usuário no chat
      const newMessageId = messages.length > 0 ? Math.max(...messages.map(msg => msg.id)) + 1 : 1;

      setMessages(prev => [
        ...prev,
        {
          id: newMessageId,
          content: currentMessage,
          isUser: true,
          type: 'message'
        }
      ]);

      const userInput = currentMessage;
      setCurrentMessage(""); // limpar o campo de entrada imediatamente

      let aiResponseId = newMessageId + 1;
      try {
        // criar espaço reservado para a resposta da ia
        setMessages(prev => [
          ...prev,
          {
            id: aiResponseId,
            content: "",
            isUser: false,
            type: 'message',
            isLoading: true,
            searchInfo: {
              stages: [],
              query: "",
              urls: []
            }
          }
        ]);

        // usar variável de ambiente para a URL da API
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const response = await fetch(`${apiBaseUrl}/chat_stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_message: userInput, checkpoint_id: checkpointId }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`Servidor retornou status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = "";
        let partial = "";
        let searchData: SearchInfo | null = null;

        while (true) {
          const { value, done: readerDone } = await reader.read();
          if (value) {
            partial += decoder.decode(value, { stream: true });
          }

          const lines = partial.split("\n");
          partial = lines.pop() ?? "";

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
                  query: searchData?.query || "",
                  urls,
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
                  query: searchData?.query || "",
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
                    stages: [...searchData.stages, 'writing'],
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
              console.error("Error parsing stream JSON:", err, line);
            }
          }

          if (readerDone) {
            break;
          }
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
        console.error("Erro ao processar requisição de chat:", error);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === aiResponseId
              ? { ...msg, content: "Erro ao conectar-se ao servidor.", isLoading: false }
              : msg
          )
        );
      }
    }
  };

  return (
    <div className="flex justify-center bg-gray-100 min-h-screen py-8 px-4">
      {/* contêiner principal com sombra refinada e borda */}
      <div className="w-[70%] bg-white flex flex-col rounded-xl shadow-lg border border-gray-100 overflow-hidden h-[90vh]">
        <Header />
        <MessageArea messages={messages} />
        <InputBar currentMessage={currentMessage} setCurrentMessage={setCurrentMessage} onSubmit={handleSubmit} />
      </div>
    </div>
  );
};

export default Home;