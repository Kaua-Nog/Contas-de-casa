import React, { useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { getApp } from 'firebase/app';
import { X, RefreshCw, FileSpreadsheet, CheckCircle2, ChevronRight, LogOut, Database, Plus } from 'lucide-react';

interface SheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initSheetsAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  const auth = getAuth(getApp());
  return auth.onAuthStateChanged((user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignInForSheets = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');

    const auth = getAuth(getApp());
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Falha ao obter token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logoutGoogle = async () => {
  const auth = getAuth(getApp());
  await auth.signOut();
  cachedAccessToken = null;
};

function extractSpreadsheetId(urlOrId: string) {
  if (urlOrId.includes('/d/')) {
    const match = urlOrId.match(/\/d\/([^/]+)/);
    return match ? match[1] : null;
  }
  return urlOrId;
}

export default function SheetsSyncModal({ isOpen, onClose }: SheetsSyncModalProps) {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  const [sheetInput, setSheetInput] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [logs, setLogs] = useState<{ id: string; msg: string; type: 'info' | 'success' | 'error' }[]>([]);

  useEffect(() => {
    // Load saved sheet URL from locals
    const saved = localStorage.getItem('sync_sheet_url');
    if (saved) setSheetInput(saved);

    const unsubscribe = initSheetsAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setLogs(prev => [...prev, { id: Math.random().toString(), msg, type }]);
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    addLog('Iniciando login no Google Workspace...', 'info');
    try {
      const result = await googleSignInForSheets();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        addLog(`Conectado como ${result.user.email}`, 'success');
      }
    } catch (err) {
      addLog('Falha ao autenticar. Tente novamente.', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    setNeedsAuth(true);
    setUser(null);
    addLog('Desconectado com sucesso.', 'info');
  };

  const createModelSheet = async () => {
    if (!cachedAccessToken) {
      addLog('Faça login primeiro.', 'error');
      setNeedsAuth(true);
      return;
    }
    
    setIsSyncing(true);
    setLogs([]);
    addLog('Criando planilha base...', 'info');
    
    try {
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cachedAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: "App Doméstico - Bot Mensagens"
          },
          sheets: [
            {
              properties: {
                title: "Sheet1"
              }
            }
          ]
        })
      });

      if (!res.ok) {
        throw new Error('Falha ao criar planilha. Verifique as permissões de gravação.');
      }

      const data = await res.json();
      const spreadsheetId = data.spreadsheetId;
      const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      setSheetInput(url);
      localStorage.setItem('sync_sheet_url', url);
      
      addLog(`Planilha criada com sucesso!`, 'success');
      
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:C1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cachedAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [['Mensagem do Bot', 'Status', 'Resultado IA']]
        })
      });

      addLog('Cabeçalho estruturado automaticamente. Você já pode integrar com o Zapier/Make!', 'success');
      
    } catch (e: any) {
      addLog(e.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSheet = async () => {
    const sheetId = extractSpreadsheetId(sheetInput.trim());
    if (!sheetId) {
      addLog('URL ou ID da planilha inválido.', 'error');
      return;
    }

    if (!cachedAccessToken) {
      addLog('Token de acesso expirado ou ausente. Faça login novamente.', 'error');
      setNeedsAuth(true);
      return;
    }

    localStorage.setItem('sync_sheet_url', sheetInput.trim());

    setIsSyncing(true);
    setLogs([]); // clear earlier logs
    addLog('Iniciando sincronização da Planilha...', 'info');

    try {
      // 1. Ler os dados (Assume Col A: Message, Col B: Status, Col C: Result)
      addLog('Buscando mensagens na planilha...', 'info');
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A:C`, {
        headers: { Authorization: `Bearer ${cachedAccessToken}` },
      });
      
      if (!res.ok) {
        const errObj = await res.json();
        throw new Error(`Erro na API Google Sheets: ${errObj?.error?.message || res.statusText}`);
      }

      const data = await res.json();
      const rows = data.values || [];

      let processedCount = 0;
      let newCount = 0;

      // Iterar e buscar não processados (pular a linha de cabeçalho, assumindo A1="Message", B1="Status")
      // Considerar todas as linhas se não houver cabeçalho explícito
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const msg = row[0];
        const status = row[1];
        
        // Pular se a mensagem for vazia, se for a primeira linha e parecer cabeçalho, ou se já estiver PROCESSADO
        if (!msg) continue;
        if (i === 0 && msg.toLowerCase().includes('message') || msg.toLowerCase() === 'mensagem') continue; 
        
        if (!status || status.trim() === '') {
          newCount++;
          // Nova mensagem!
          addLog(`Analisando: "${msg}"...`, 'info');
          
          try {
            const aiRes = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: msg }),
            });
            const aiData = await aiRes.json();
            
            if (aiData.success) {
              const botReply = aiData.replyText || 'Processado.';
              
              // Escrever de volta para a planilha: (Status na col B = PROCESSED, Result na Col C)
              const rowIndex = i + 1; // 1-based index for API
              const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!B${rowIndex}:C${rowIndex}?valueInputOption=USER_ENTERED`, {
                method: 'PUT',
                headers: { 
                  Authorization: `Bearer ${cachedAccessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  values: [['PROCESSED', botReply]]
                })
              });
              
              if (updateRes.ok) {
                processedCount++;
                if (aiData.intent === 'fallback') {
                  addLog(`Mensagem ignorada (Conversa normal na planilha).`, 'info');
                } else {
                  addLog(`Sucesso: Item reconhecido (${aiData.intent}).`, 'success');
                }
              } else {
                 addLog(`Erro ao salvar status na planilha (Linha ${rowIndex}).`, 'error');
              }

            } else {
              addLog(`A IA não conseguiu processar: "${msg}"`, 'error');
            }
          } catch (itemErr) {
            addLog(`Erro de rede ao processar: "${msg}"`, 'error');
          }
        }
      }

      if (newCount === 0) {
        addLog('Nenhuma nova mensagem na planilha para sincronizar.', 'info');
      } else {
        addLog(`Sincronização concluída. ${processedCount} mensagem(ns) processada(s) e inserida(s) no App!`, 'success');
      }

    } catch (err: any) {
      addLog(err.message, 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 h-full z-50 animate-fade-in">
      <div className="bg-[#0f172a] border border-indigo-900 w-full max-w-lg h-auto max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col transition-all">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between border-b border-indigo-950 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <FileSpreadsheet size={18} />
            </span>
            <div className="text-left leading-tight">
              <span className="text-slate-100 font-bold text-sm block">Sincronização com WhatsApp</span>
              <span className="text-slate-400 text-xs block mt-0.5">Ler mensagens direto de sua Planilha</span>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-full text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth State & Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6 flex flex-col bg-slate-950">
          {needsAuth ? (
            <div className="text-center space-y-6 flex-1 flex flex-col items-center justify-center">
              <div className="bg-slate-900 p-6 rounded-2xl w-full border border-slate-800">
                <FileSpreadsheet size={48} className="mx-auto text-indigo-400 mb-4" />
                <h3 className="text-slate-200 font-bold text-lg mb-2">Conectar Google Sheets</h3>
                <p className="text-slate-400 text-sm mb-6 max-w-sm mx-auto">
                  Faça login com sua conta Google para que o App possa ler e sincronizar as mensagens inseridas na planilha pelo seu bot Zapier/Make.
                </p>
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="mx-auto flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-slate-800 font-bold text-sm rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? (
                    <RefreshCw className="animate-spin" size={18} />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                  )}
                  <span>Entrar com Google</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-slate-200 text-xs font-bold block">Conectado como</span>
                    <span className="text-slate-400 text-xs font-mono">{user?.email}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-slate-500 hover:text-slate-300 p-2 rounded-lg transition-colors"
                  title="Sair"
                >
                  <LogOut size={16} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-slate-300 text-xs font-bold px-1 uppercase tracking-wider">URL da Planilha</label>
                <input
                  type="text"
                  value={sheetInput}
                  onChange={e => setSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1aBcD..."
                  className="w-full bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 text-slate-100 text-sm p-3.5 rounded-xl outline-none transition-all placeholder:text-slate-600"
                />
                <p className="text-[11px] text-slate-500 px-1 mt-1 leading-relaxed">
                  A planilha deve ter o seguinte formato de colunas ativas na aba "Sheet1":<br/>
                  <strong className="text-slate-400">Coluna A:</strong> Mensagem original do Bot/WhatsApp.<br/>
                  <strong className="text-slate-400">Coluna B:</strong> Flag interna de status (Ficará como PROCESSED).
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={syncSheet}
                  disabled={isSyncing || !sheetInput}
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  {isSyncing ? <RefreshCw className="animate-spin" size={16} /> : <Database size={16} />}
                  <span>Sincronizar Mensagens Agora</span>
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-widest">Ou</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <button
                  onClick={createModelSheet}
                  disabled={isSyncing}
                  className="w-full py-3.5 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 active:bg-emerald-600/30 text-emerald-400 font-bold rounded-xl border border-emerald-500/20 transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  <span>Criar Nova Planilha Base Padrão</span>
                </button>
              </div>

              {logs.length > 0 && (
                <div className="mt-4 p-4 bg-[#0a0f18] rounded-xl border border-slate-800 space-y-2.5 min-h-[120px] max-h-[180px] overflow-y-auto">
                  {logs.map(lg => (
                    <div key={lg.id} className="flex items-start gap-2.5 text-xs text-slate-300 font-mono">
                      {lg.type === 'info' && <ChevronRight size={14} className="text-slate-600 shrink-0 mt-0.5" />}
                      {lg.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />}
                      {lg.type === 'error' && <X size={14} className="text-rose-500 shrink-0 mt-0.5" />}
                      <span className={`leading-relaxed ${lg.type === 'success' ? 'text-emerald-400' : lg.type === 'error' ? 'text-rose-400' : ''}`}>
                        {lg.msg}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
