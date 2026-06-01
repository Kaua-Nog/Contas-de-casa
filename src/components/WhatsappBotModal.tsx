import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  MessageSquare, 
  Check, 
  CheckCheck, 
  Paperclip, 
  Image as ImageIcon,
  Copy,
  Info,
  Smartphone,
  ChevronRight,
  Sparkles,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string;
  mediaUrl?: string;
  isImage?: boolean;
}

interface WhatsappBotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WhatsappBotModal({ isOpen, onClose }: WhatsappBotModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: '🤖 *Olá! Eu sou o assistente virtual do Lar em Ordem.*\n\nEstou pronto para te ajudar a manter o lar sob controle diretamente pelo WhatsApp! \n\n*O que eu posso fazer por você?*\n\n🛒 *Lista de Compras:* Escreva coisas como *"adicionar 3 caixas de leite, arroz e detergente Ypê"* e eu lanço tudo imediatamente para você.\n\n⚡ *Contas Domésticas:* Envie mensagens como *"lançar conta Enel de R$ 134 vencimento dia 15/06"*\n\n📸 *Leitor de Comprovantes/Boletos:* Envie uma foto nítida de qualquer boleto, conta de luz/água ou cupom fiscal do supermercado. Eu leio com inteligência artificial e lanço automaticamente!\n\n_Digite um comando para testar agora mesmo no simulador!_',
      sender: 'bot',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'simulador' | 'tutorial'>('simulador');
  const [copied, setCopied] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/webhook/whatsapp-bot` 
    : 'https://seu-dominio.com/api/webhook/whatsapp-bot';

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [isOpen, messages, isTyping]);

  if (!isOpen) return null;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processMessage = async (text: string, fileBase64?: string, mimeType?: string) => {
    setIsTyping(true);
    
    try {
      const response = await fetch('/api/webhook/whatsapp-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          fileData: fileBase64 || '',
          mimeType: mimeType || '',
          sender: '5511999999999'
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
          text: '🤖 *Erro no Bot:*\nNão foi possível processar esse comando. Verifique os valores enviados, verifique se sua chave GEMINI_API_KEY está configurada e tente novamente.',
          sender: 'bot',
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `bot-${Date.now()}`,
        text: '❌ *Erro de Conectividade:*\nO servidor está processando sua solicitação mas houve uma falha de conexão. Verifique se o servidor backend está online.',
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

    // Trigger AI response simulation
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
    // Basic WhatsApp bold markdown style (*text* to <strong>text</strong>)
    const regex = /\*(.*?)\*/g;
    const newlineRegex = /\n/g;
    
    let formatted = txt.replace(regex, '<strong>$1</strong>');
    formatted = formatted.replace(newlineRegex, '<br />');
    return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 h-full z-50 animate-fade-in" id="whatsapp-bot-modal">
      <div className="bg-[var(--bg-card)] border border-[var(--border-card)] w-full max-w-4xl h-[90vh] max-h-[850px] rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row transition-all">
        
        {/* Left Side: Information & Tutorial Configuration */}
        <div className="flex-1 border-r border-[var(--border-card)] flex flex-col p-6 min-h-0 bg-slate-900/10">
          <div className="flex items-center justify-between pb-4 border-b border-[var(--border-card)] mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/15 text-emerald-400 rounded-xl">
                <Smartphone size={20} />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-[var(--text-main)]">Integração WhatsApp</h3>
                <p className="text-[10px] text-[var(--text-sub)] uppercase tracking-widest font-extrabold">Configuração & Webhooks</p>
              </div>
            </div>

            {/* Mobile close only */}
            <button 
              onClick={onClose}
              className="md:hidden p-1.5 hover:bg-[var(--bg-input)] rounded-full text-[var(--text-sub)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tab Selection */}
          <div className="flex gap-2 mb-4 bg-[var(--bg-input)] p-1.5 rounded-xl border border-[var(--border-input)]">
            <button
              onClick={() => setActiveTab('simulador')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'simulador' 
                  ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
              }`}
            >
              Simular Chat
            </button>
            <button
              onClick={() => setActiveTab('tutorial')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'tutorial' 
                  ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
              }`}
            >
              Conectar WhatsApp Real
            </button>
          </div>

          {/* Left panel body scroll */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs text-[var(--text-main)]" id="tutorial-content-scroll">
            {activeTab === 'tutorial' ? (
              <div className="space-y-4 font-semibold leading-relaxed animate-fade-in text-[var(--text-sub)]">
                <div className="bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-2xl text-[var(--text-main)]">
                  <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs mb-2 uppercase tracking-wide">
                    <Sparkles size={14} className="animate-pulse" />
                    <span>Seu Webhook Prontinho</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed mb-3">
                    Use o link abaixo nas configurações do seu gateway preferido do WhatsApp (Evolution API, Baileys, Z-API, ou Twilio) para receber fotos e áudios diretamente no app:
                  </p>
                  
                  <div className="flex items-center gap-2 bg-slate-950/20 border border-[var(--border-input)] p-3 rounded-xl">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="w-full bg-transparent font-mono text-[10px] focus:outline-none text-[var(--text-main)] truncate"
                    />
                    <button
                      onClick={handleCopyWebhook}
                      className="p-1.5 hover:bg-[var(--bg-card)] text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors flex-shrink-0"
                      title="Copiar URL do Webhook"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 px-1">
                  <h4 className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider">Como funciona hoje?</h4>
                  <p>
                    O backend da aplicação em <code className="font-mono bg-[var(--bg-input)] px-1 rounded">server.ts</code> expõe uma rota robusta de processamento de linguagem natural e OCR acoplada à IA oficial do Gemini.
                  </p>
                  
                  <ol className="space-y-2 list-decimal list-inside text-xs font-semibold pl-1">
                    <li>
                      <span className="text-[var(--text-main)]">Configurar Gatilhos:</span> No seu painel de API do WhatsApp, aponte a recepção de mensagens para o URL copiado acima como método <code className="font-mono bg-[var(--bg-input)] px-1 py-0.5 rounded text-indigo-400">POST</code>.
                    </li>
                    <li>
                      <span className="text-[var(--text-main)]">Processamento Instantâneo:</span> Quando você ou alguém do seu grupo de casa envia texto ou foto para o bot, o servidor processa tudo usando IA.
                    </li>
                    <li>
                      <span className="text-[var(--text-main)]">Sincronização Firestore:</span> O sistema escreve em tempo real e de forma segura nas coleções de compras ou de despesas diretamente do seu banco.
                    </li>
                  </ol>

                  <div className="p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)] mt-4">
                    <div className="flex gap-2 text-[var(--text-main)] mb-1">
                      <Info size={14} className="text-indigo-400 flex-shrink-0 mt-0.5" />
                      <span className="font-extrabold">Nota técnica importante:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-semibold">
                      O webhook aceita cargas úteis nativas do Twilio ou da Evolution API, facilitando a portabilidade rápida de instâncias locais e contêineres de código aberto.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in font-medium leading-relaxed">
                <div className="p-4 bg-[var(--bg-input)] rounded-2xl border border-[var(--border-input)]">
                  <h4 className="text-xs font-extrabold text-[var(--text-main)] uppercase tracking-wider mb-2">💡 Experimente o Bot agora</h4>
                  <p className="text-[11px] text-[var(--text-sub)] mb-3">
                    Você não precisa subir nenhum gateway externo para começar! Use o telefone do simulador à direita para mandar comandos e verificar como as alterações são salvas diretamente no banco Firestore de forma imediata.
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
                    Clique no ícone de clipe de papel <Paperclip size={11} className="inline-block mx-0.5" /> no teclado do chat ou envie uma imagem arrastando arquivos para a tela simulada para extrair dados por OCR com o Gemini!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Virtual Mobile Device Smartphone UI Layout */}
        <div className="flex-1 max-w-sm w-full mx-auto md:max-w-none bg-[#0b141a] md:w-[380px] flex flex-col min-h-0 select-none shadow-inner">
          
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
              {/* Desktop close only button inside simulator frame */}
              <button 
                onClick={onClose}
                className="p-1.5 hover:bg-[#2a3942] rounded-full text-slate-300 transition-colors cursor-pointer"
                title="Fechar Painel"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Chat scrolling log window elements */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 flex flex-col justify-between min-h-0 bg-[#0b141a]/95 pattern-whatsapp">
            <div className="space-y-3.5 flex-1 w-full" id="wpp-messages-log">
              {/* Security info disclaimer text row */}
              <div className="mx-auto w-fit max-w-[240px] text-center px-3 py-1.5 bg-[#182229] border border-[#222d34] text-[#8696a0] rounded-lg text-[9px] font-extrabold uppercase tracking-widest leading-normal">
                🔒 Criptografia ponta a ponta simulada
              </div>

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

          {/* Footer Input Controls Phone Form element */}
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
