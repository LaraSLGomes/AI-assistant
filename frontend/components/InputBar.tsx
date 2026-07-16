import React from 'react';

interface Props {
  currentMessage: string;
  setCurrentMessage: (s: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function InputBar({ currentMessage, setCurrentMessage, onSubmit }: Props) {
  return (
    <form onSubmit={onSubmit} className="p-4 border-t bg-gray-50 flex gap-2">
      <input
        className="flex-1 p-2 border rounded"
        value={currentMessage}
        onChange={(e) => setCurrentMessage(e.target.value)}
        placeholder="digite sua mensagem..."
      />
      <button className="px-4 py-2 bg-blue-600 text-white rounded">enviar</button>
    </form>
  );
}
