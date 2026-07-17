"use client"
import React, { useRef } from 'react';

type InputBarProps = {
    currentMessage: string;
    setCurrentMessage: (message: string) => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
    onFileUpload?: (file: File) => void;
    isUploading?: boolean;
    disabled?: boolean;
};

const InputBar = ({ currentMessage, setCurrentMessage, onSubmit, onFileUpload, isUploading = false, disabled = false }: InputBarProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentMessage(e.target.value);
    }

    const handlePaperclipClick = () => {
        if (!disabled && !isUploading) {
            fileInputRef.current?.click();
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onFileUpload) {
            onFileUpload(file);
        }
        // Limpa o input para permitir enviar o mesmo arquivo novamente, se necessário
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    return (
        <form onSubmit={onSubmit} className="p-4 bg-white border-t border-gray-100">
            <div className="flex items-center bg-[#F9F9F5] rounded-full p-2 shadow-sm border border-gray-200">
                
                {/* Input de arquivo invisível */}
                <input 
                    type="file" 
                    accept="application/pdf"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />

                {/* Botão de Upload (Clipe de Papel) */}
                <button
                    type="button"
                    onClick={handlePaperclipClick}
                    disabled={disabled || isUploading}
                    className={`p-2 rounded-full transition-all duration-200 flex-shrink-0 ${isUploading ? 'text-teal-500 animate-pulse' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                    title="Enviar PDF"
                >
                    {isUploading ? (
                        <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                        </svg>
                    )}
                </button>

                <input
                    type="text"
                    placeholder="Digite sua mensagem..."
                    value={currentMessage}
                    onChange={handleChange}
                    disabled={disabled || isUploading}
                    className="flex-grow px-3 py-2 bg-transparent focus:outline-none text-sm text-gray-700 disabled:opacity-60"
                />

                <button
                    type="submit"
                    disabled={disabled || isUploading || !currentMessage.trim()}
                    className="bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-600 hover:to-teal-500 rounded-full p-2 ml-1 shadow-sm transition-all duration-200 group disabled:cursor-not-allowed disabled:opacity-40 flex-shrink-0"
                >
                    <svg className="w-5 h-5 text-white transform rotate-45 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                    </svg>
                </button>
            </div>
        </form>
    )
}

export default InputBar;