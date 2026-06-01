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

    if (!file.type.startsWith('image/')) {
      alert('Por favor, envie apenas fotos de comprovantes ou faturas.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        text: `📸 Foto enviada: ${file.name}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        mediaUrl: reader.result as string,
        isImage: true
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
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] w-full max-w-4xl h-[90vh] max-h-[850px] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row transition-all">
        
        {/* Left Side: Information */}
        <div className="flex-1 border-r border-[var(--border-card)] flex flex-col p-6 min-h-0 bg-slate-900/10 hidden md:flex">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-card)] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-[var(--text-main)]">Assistente Virtual</h3>
                <p className="text-[10px] text-[var(--text-sub)] uppercase tracking-widest font-extrabold">Chat Interativo</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-[var(--text-main)]">
            <div className="space-y-4 animate-fade-in font-medium leading-relaxed">
              <div className="p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)]">
                <h4 className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider mb-2">💡 Experimente o Assistente</h4>
                <p className="text-[11px] text-[var(--text-sub)] mb-3">
                  Use o chat à direita para pedir lançamentos na casa de forma natural. As alterações são sincronizadas direto na dashboard!
                </p>
                
                <div className="space-y-2.5 text-[11px] font-semibold">
                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-input)] rounded-xl flex items-start gap-2.5 hover:border-slate-650 transition-colors cursor-pointer" onClick={() => setInputVal('adicionar 3 detergentes e 2 pacotes de macarrão')}>
                    <ChevronRight size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p>
                      <span className="text-[var(--text-main)] block font-bold">🛒 Lista de Compras:</span>
                      "adicionar 3 detergentes e 2 pacotes de macarrão"
                    </p>
                  </div>

                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-input)] rounded-xl flex items-start gap-2.5 hover:border-slate-650 transition-colors cursor-pointer" onClick={() => setInputVal('lançar energia Enel R$ 139,40 vencimento dia 15')}>
                    <ChevronRight size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p>
                      <span className="text-[var(--text-main)] block font-bold">⚡ Contas Domésticas:</span>
                      "lançar energia Enel R$ 139,40 vencimento dia 15"
                    </p>
                  </div>

                  <div className="p-2.5 bg-[var(--bg-card)] border border-[var(--border-input)] rounded-xl flex items-start gap-2.5 hover:border-slate-650 transition-colors cursor-pointer" onClick={() => setInputVal('comprar sabonete, xampu e condicionador')}>
                    <ChevronRight size={13} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <p>
                      <span className="text-[var(--text-main)] block font-bold">🧼 Multi-itens sem quantidade:</span>
                      "comprar sabonete, xampu e condicionador"
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-1 text-[11px] text-[var(--text-sub)]">
                <p className="flex items-center gap-1.5 font-extrabold text-indigo-400 uppercase tracking-wider mb-1.5">
                  <ImageIcon size={12} />
                  <span>Lançando com imagens:</span>
                </p>
                <p>
                  Clique no ícone de clipe de papel <Paperclip size={11} className="inline-block mx-0.5" /> para enviar comprovantes ou contas e testar o OCR inteligente.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Virtual Mobile Device Smartphone UI Layout */}
        <div className="flex-1 max-w-sm w-full mx-auto md:max-w-none bg-[#0b141a] md:w-[380px] flex flex-col min-h-0 select-none shadow-inner rounded-3xl md:rounded-l-none overflow-hidden">
          
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
              accept="image/*"
              className="hidden"
            />
            {/* Attachment paperclip trigger button element */}
            <button
              type="button"
              onClick={handleImageUploadClick}
              disabled={isTyping}
              className="text-slate-300 hover:text-slate-100 p-1.5 disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
              title="Mandar Foto comprovante/boleto"
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
    </div>
  );
}
