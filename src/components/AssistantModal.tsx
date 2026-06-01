import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckCheck, 
  Paperclip, 
  Image as ImageIcon,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { motion } from 'motion/react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  mediaUrl?: string;
  isImage?: boolean; // added this
}

interface AssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AssistantModal({ isOpen, onClose }: AssistantModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: '🤖 *Olá! Eu sou o assistente virtual do Lar em Ordem.*\n\nEstou pronto para te ajudar a manter o lar sob controle!\n\n*O que eu posso fazer por você?*\n\n🛒 *Lista de Compras:* Escreva coisas como *"adicionar 3 caixas de leite, arroz e detergente Ypê"* e eu lanço tudo imediatamente para você.\n\n⚡ *Contas Domésticas:* Envie mensagens como *"lançar conta Enel de R$ 134 vencimento dia 15/06"*\n\n📸 *Leitor de Comprovantes/Boletos:* Envie uma foto do comprovante! Eu leio e lanço automaticamente!\n\n_Digite um comando para testar agora mesmo!_',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages, isTyping]);

  if (!isOpen) return null;

  const processMessage = async (text: string, fileBase64?: string, mimeType?: string) => {
    setIsTyping(true);
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          fileData: fileBase64 || '',
          mimeType: mimeType || ''
        })
      });

      const result = await response.json();
      
      setIsTyping(false);

      if (result.success && result.replyText) {
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          text: result.replyText,
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: `bot-${Date.now()}`,
          text: '🤖 *Erro no Bot:*\nNão foi possível processar esse comando. Verifique os valores enviados e tente novamente.',
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        text: '❌ *Erro de Conectividade:*\nHouve uma falha de conexão com o servidor.',
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = inputVal.trim();
    if (!txt) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      text: txt,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputVal('');

    processMessage(txt);
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      alert('Por favor, envie apenas fotos, PDFs ou documentos.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        text: `📎 Arquivo enviado: ${file.name}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        mediaUrl: file.type.startsWith('image/') ? reader.result as string : undefined,
        isImage: file.type.startsWith('image/')
      };

      setMessages(prev => [...prev, userMsg]);
      processMessage('', base64String, file.type);
    };
    reader.readAsDataURL(file);
  };

  const formatMessageText = (txt: string) => {
    const regex = /\*(.*?)\*/g;
    const newlineRegex = /\n/g;
    
    let formatted = txt.replace(regex, '<strong>$1</strong>');
    formatted = formatted.replace(newlineRegex, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 h-full z-50 animate-fade-in" id="assistant-modal">
      <div className="bg-[#0b141a] w-full max-w-md h-[90vh] max-h-[850px] rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all">
        {/* Mock Smartphone Statusbar Header */}
          <div className="bg-[#1f2c34] px-4 py-3.5 flex items-center justify-between border-b border-[#0b141a] flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Green Bot Avatar representational badge */}
              <div className="relative w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center font-extrabold text-white text-base overflow-hidden border border-emerald-500 shadow-sm">
                🤖
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border border-[#1f2c34] rounded-full"></span>
              </div>
              <div className="text-left leading-none">
                <span className="text-slate-100 font-extrabold text-xs block truncate tracking-wide">Lar em Ordem Bot</span>
                <span className="text-emerald-400 text-[10px] font-bold block mt-1 tracking-wider uppercase">online</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-[#2a3942] rounded-full text-slate-300 transition-colors cursor-pointer"
                title="Fechar Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat scrolling log window elements */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 flex flex-col justify-between min-h-0 bg-[#0b141a]/95 pattern-whatsapp">
            <div className="space-y-3.5 flex-1 w-full" id="wpp-messages-log">
              {messages.map(m => (
                <div 
                  key={m.id}
                  className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'} w-full animate-fade-in`}
                >
                  <div className={`relative max-w-[290px] rounded-2xl px-3.5 py-2.5 text-[11px] leading-relaxed shadow-sm font-semibold tracking-wide ${
                    m.sender === 'user' 
                      ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none' 
                      : 'bg-[#202c33] text-[#e9edef] rounded-tl-none'
                  }`}>
                    {m.isImage && m.mediaUrl && (
                      <div className="mb-2 max-w-[200px] overflow-hidden rounded-lg border border-[#2e3b43]">
                        <img src={m.mediaUrl} alt="Comprovante" className="max-h-[140px] w-full object-cover" />
                      </div>
                    )}
                    <div>
                      {formatMessageText(m.text)}
                    </div>
                    {/* Timestamp signature details row */}
                    <div className="flex items-center justify-end gap-1 text-[8px] text-[#8696a0] mt-1 font-mono font-bold leading-none select-none text-right w-full">
                      <span>{m.timestamp}</span>
                      {m.sender === 'user' && (
                        <CheckCheck size={11} className="text-emerald-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start w-full animate-pulse">
                  <div className="bg-[#202c33] text-emerald-400 font-extrabold rounded-2xl rounded-tl-none px-4 py-2.5 text-[10px] tracking-widest">
                    <span>BOT DIGITANDO...</span>
                  </div>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Footer Input Controls */}
          <form 
            onSubmit={handleSendText}
            className="bg-[#1f2c34] px-3.5 py-3 flex items-center gap-2.5 border-t border-[#0b141a] flex-shrink-0"
          >
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,application/pdf"
              className="hidden"
            />
            {/* Attachment paperclip trigger button element */}
            <button
              type="button"
              onClick={handleImageUploadClick}
              disabled={isTyping}
              className="text-slate-300 hover:text-slate-100 p-1.5 disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
              title="Mandar arquivo"
            >
              <Paperclip size={18} />
            </button>

            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isTyping}
              placeholder="Mensagem..."
              className="flex-1 bg-[#2a3942] hover:bg-[#32424b] text-xs font-semibold text-slate-100 placeholder-[#8696a0] focus:outline-none px-3.5 py-2.5 rounded-xl transition-all"
            />

            <button
              type="submit"
              disabled={isTyping || !inputVal.trim()}
              className="w-9 h-9 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 shadow-sm"
            >
              <Send size={14} className="ml-0.5" />
            </button>
          </form>

      </div>
    </div>
  );
}
