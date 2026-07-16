import React from 'react';

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  type: string;
  isLoading?: boolean;
  searchInfo?: any;
}

interface Props {
  messages: Message[];
}

export default function MessageArea({ messages }: Props) {
  return (
    <main className="flex-1 p-4 overflow-auto space-y-3 bg-white">
      {messages.map((msg) => (
        <div key={msg.id} className={msg.isUser ? 'text-right' : 'text-left'}>
          <div className={`inline-block px-3 py-2 rounded ${msg.isUser ? 'bg-blue-100' : 'bg-gray-100'}`}>
            {msg.isLoading ? '...' : msg.content}
          </div>
        </div>
      ))}
    </main>
  );
}
