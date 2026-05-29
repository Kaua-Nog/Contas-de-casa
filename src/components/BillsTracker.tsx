import React, { useState } from 'react';
import { HouseBill, BillType } from '../types';
import { 
  Plus, 
  Trash2, 
  Droplet, 
  Zap, 
  Cat, 
  Dog, 
  FileText, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  Clock,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Upload,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BillsTrackerProps {
  bills: HouseBill[];
  selectedMonth: string; // Format: "YYYY-MM"
  onMonthChange: (month: string) => void;
  onAddBill: (type: BillType, value: number, dueDate: string, customTitle?: string, paid?: boolean) => void;
  onToggleBillPaid: (id: string) => void;
  onRemoveBill: (id: string) => void;
}

const CATEGORY_META = {
  agua: {
    label: 'Água',
    icon: Droplet,
    bg: 'cat-btn-agua',
    colorText: 'text-blue-300',
    dot: 'bg-blue-400'
  },
  energia: {
    label: 'Energia',
    icon: Zap,
    bg: 'cat-btn-energia',
    colorText: 'text-amber-300',
    dot: 'bg-amber-400'
  },
  racao_gatos: {
    label: 'Ração Gatos',
    icon: Cat,
    bg: 'cat-btn-racao_gatos',
    colorText: 'text-fuchsia-300',
    dot: 'bg-fuchsia-400'
  },
  racao_cachorro: {
    label: 'Ração Cachorro',
    icon: Dog,
    bg: 'cat-btn-racao_cachorro',
    colorText: 'text-orange-300',
    dot: 'bg-orange-400'
  },
  outros: {
    label: 'Outros',
    icon: FileText,
    bg: 'cat-btn-outros',
    colorText: 'text-slate-300',
    dot: 'bg-slate-400'
  }
};

export default function BillsTracker({
  bills,
  selectedMonth,
  onMonthChange,
  onAddBill,
  onToggleBillPaid,
  onRemoveBill
}: BillsTrackerProps) {
  const [billType, setBillType] = useState<BillType>('agua');
  const [customTitle, setCustomTitle] = useState('');
  const [valueStr, setValueStr] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    // Default to today
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [isPaidOnAdd, setIsPaidOnAdd] = useState(false);

  // AI OCR States
  const [addMode, setAddMode] = useState<'manual' | 'ia'>('manual');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isPreFilledByAi, setIsPreFilledByAi] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setAnalysisError('Formato inválido. Por favor, envie uma foto (JPEG/PNG/WebP) ou PDF.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setIsPreFilledByAi(false);

    // Stagger loading messages for friendly feedback
    const STAGES = [
      "Preparando documento...",
      "Processando tamanho do arquivo...",
      "Enviando para a Inteligência Artificial Gemini...",
      "Analisando faturamento e cabeçalho...",
      "Identificando o fornecedor (SABESP, Enel, etc)...",
      "Extraindo valores, datas de vencimento e tipo...",
      "Decifrando dados e formatando JSON...",
      "Quase lá, finalizando leitura..."
    ];
    let stageIdx = 0;
    setLoadingStage(STAGES[0]);
    const stageInterval = setInterval(() => {
      stageIdx++;
      if (stageIdx < STAGES.length) {
        setLoadingStage(STAGES[stageIdx]);
      }
    }, 1200);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          if (!reader.result) {
            throw new Error('Falha ao ler o arquivo selecionado.');
          }
          const base64Data = (reader.result as string).split(',')[1];
          const response = await fetch('/api/analyze-bill', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fileData: base64Data,
              mimeType: file.type
            })
          });

          clearInterval(stageInterval);

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody.error || `Erro de resposta do servidor (${response.status})`);
          }

          const result = await response.json();
          if (result.success && result.data) {
            const { type: extType, customTitle: extTitle, value: extVal, dueDate: extDate } = result.data;
            
            // Set values extracted by IA
            if (extType && ['agua', 'energia', 'racao_gatos', 'racao_cachorro', 'outros'].includes(extType)) {
              setBillType(extType as BillType);
            } else {
              setBillType('outros');
            }
            
            setCustomTitle(extTitle || '');
            
            if (extVal && !isNaN(extVal)) {
              setValueStr(extVal.toString());
            } else {
              setValueStr('');
            }

            if (extDate) {
              setDueDate(extDate);
            }

            setIsPreFilledByAi(true);
            setAddMode('manual'); // Switch to manual so they can review and click register
          } else {
            throw new Error(result.error || 'Não foi possível extrair dados válidos da conta.');
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          setAnalysisError(innerErr.message || 'Erro ao comunicar com servidor. Tente usar o preenchimento manual.');
        } finally {
          setIsAnalyzing(false);
          clearInterval(stageInterval);
        }
      };

      reader.onerror = () => {
        clearInterval(stageInterval);
        setIsAnalyzing(false);
        setAnalysisError('Falha ao ler o arquivo local.');
      };

      reader.readAsDataURL(file);
    } catch (err: any) {
      clearInterval(stageInterval);
      setIsAnalyzing(false);
      setAnalysisError(err.message || 'Ocorreu um erro ao processar o arquivo.');
    }
  };

  // Parse month year for displaying
  const getBrazilianMonthYearLabel = (monthYyyyMm: string) => {
    const [year, month] = monthYyyyMm.split('-');
    const months = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    return `${months[parseInt(month) - 1]} / ${year}`;
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const monthStr = prevMonth.toString().padStart(2, '0');
    onMonthChange(`${prevYear}-${monthStr}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth === 13) {
      nextMonth = 1;
      nextYear += 1;
    }
    const monthStr = nextMonth.toString().padStart(2, '0');
    onMonthChange(`${nextYear}-${monthStr}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(valueStr);
    if (isNaN(val) || val <= 0) return;

    onAddBill(billType, val, dueDate, billType === 'outros' ? customTitle.trim() : undefined, isPaidOnAdd);
    
    // Clear & reset
    setValueStr('');
    setCustomTitle('');
    setIsPaidOnAdd(false);
  };

  // Pre-fill fields helper for active categories
  const handleShortcutSelect = (type: BillType) => {
    setBillType(type);
    setCustomTitle('');
  };

  // Filter bills for selected month
  const activeMonthBills = bills.filter(b => b.month === selectedMonth);

  const totalPaid = activeMonthBills
    .filter(b => b.paid)
    .reduce((sum, b) => sum + b.value, 0);

  const totalPending = activeMonthBills
    .filter(b => !b.paid)
    .reduce((sum, b) => sum + b.value, 0);

  const grandTotal = totalPaid + totalPending;

  return (
    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-card)] shadow-sm p-6 h-full flex flex-col transition-colors duration-200" id="bills-tracker-card">
      {/* Month Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-card)]" id="bills-tracker-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl shadow-xs">
            <TrendingUp size={20} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-main)]">Contas da Casa</h2>
            <p className="text-xs text-[var(--text-sub)] font-bold">Controle de utilidades, residência e pets da casa</p>
          </div>
        </div>

        {/* Month Selector widget */}
        <div className="flex items-center gap-1.5 self-center sm:self-auto bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-input)]">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 hover:bg-[var(--bg-input-hover)] text-[var(--text-body)] rounded-lg transition-colors cursor-pointer"
            title="Mês Anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-extrabold text-[var(--text-main)] min-w-[124px] text-center px-1">
            {getBrazilianMonthYearLabel(selectedMonth)}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-1.5 hover:bg-[var(--bg-input-hover)] text-[var(--text-body)] rounded-lg transition-colors cursor-pointer"
            title="Próximo Mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Bill creation form */}
      <div className="py-5 border-b border-[var(--border-card)] mt-2" id="bills-creation-box">
        {/* Dual Mode Tab Selector */}
        <div className="flex items-center justify-between border-b border-[var(--border-card)] pb-3 mb-4">
          <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-wider flex items-center gap-1.5">
            <Plus size={12} className="text-emerald-400" />
            Nova Conta da Casa
          </span>
          <div className="flex bg-[var(--bg-input)] p-0.5 rounded-lg border border-[var(--border-input)]">
            <button
              type="button"
              onClick={() => {
                setAddMode('manual');
                setAnalysisError(null);
              }}
              className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer ${addMode === 'manual' ? 'bg-[var(--bg-input-hover)] text-[var(--text-main)] shadow-2xs' : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'}`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => {
                setAddMode('ia');
                setAnalysisError(null);
              }}
              className={`text-[10px] font-bold px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1 ${addMode === 'ia' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-[var(--text-sub)] hover:text-indigo-400'}`}
            >
              <Sparkles size={11} className="animate-pulse text-indigo-300" />
              IA Gemini ✨
            </button>
          </div>
        </div>

        {addMode === 'ia' && (
          <div id="ia-upload-step" className="space-y-3">
            {isAnalyzing ? (
              <div className="border border-dashed border-indigo-500/25 bg-[var(--bg-input)]/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center animate-pulse min-h-[175px]">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-indigo-200/20 border-t-indigo-500 animate-spin mb-4 flex items-center justify-center"></div>
                  <Sparkles size={16} className="absolute top-3.5 left-3.5 text-indigo-400 animate-bounce" />
                </div>
                <h4 className="text-sm font-semibold text-[var(--text-main)]">Processando com Gemini AI</h4>
                <p className="text-xs text-indigo-400 font-bold mt-1 font-mono">{loadingStage}</p>
                <span className="text-[10px] text-[var(--text-sub)] mt-3 block">Não feche a página, decifrando dados do documento em tempo real.</span>
              </div>
            ) : (
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative min-h-[175px] flex flex-col items-center justify-center ${
                  dragActive 
                    ? 'border-indigo-500 bg-[var(--bg-input-hover)]/40' 
                    : 'border-[var(--border-input)] bg-[var(--bg-input)]/50 hover:bg-[var(--bg-input-hover)]/50 hover:border-slate-550'
                }`}
              >
                <input 
                  type="file" 
                  id="ia-file-input"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl mb-3">
                  <Upload size={24} />
                </div>
                <h4 className="text-sm font-extrabold text-[var(--text-main)]">Escanear Boleto por Foto / PDF</h4>
                <p className="text-xs text-[var(--text-sub)] mt-1 max-w-[280px] mx-auto font-bold leading-normal">
                  Arraste a foto ou boleto em PDF aqui, ou <span className="text-indigo-400 font-extrabold underline">clique para selecionar</span>
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-[var(--text-sub)] font-mono">
                  <span>PNG, JPG, WEBP, PDF</span>
                  <span>•</span>
                  <span>Max 20MB</span>
                </div>
              </div>
            )}

            {analysisError && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/15 rounded-xl text-red-400 text-xs">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <div className="font-bold">{analysisError}</div>
              </div>
            )}

            <p className="text-[11px] text-[var(--text-sub)] flex items-center justify-center gap-1.5 text-center mt-2 font-bold select-none">
              <Sparkles size={11} className="text-indigo-400" />
              <span>A IA preenche o tipo, nome, valor e vencimento automaticamente!</span>
            </p>
          </div>
        )}

        {addMode === 'manual' && (
          <div className="space-y-4">
            {isPreFilledByAi && (
              <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-300 text-xs shadow-3xs animate-pulse">
                <div className="flex items-center gap-2 font-bold">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>✨ Informações preenchidas automaticamente pela IA!</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreFilledByAi(false)}
                  className="text-[10px] font-extrabold uppercase tracking-wide underline text-emerald-450 hover:text-emerald-300 cursor-pointer"
                >
                  Entendi
                </button>
              </div>
            )}

            {/* Shortcuts Buttons */}
            <div className="flex flex-wrap gap-1.5 mb-1">
              {(['agua', 'energia', 'racao_gatos', 'racao_cachorro', 'outros'] as BillType[]).map(type => {
                const meta = CATEGORY_META[type];
                const IconComponent = meta.icon;
                const isSelected = billType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleShortcutSelect(type)}
                    className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected 
                        ? 'bg-indigo-600 text-white border-indigo-650 shadow-sm' 
                        : `${meta.bg} hover:border-slate-500`
                    }`}
                  >
                    <IconComponent size={13} />
                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3" id="bills-form">
              {billType === 'outros' && (
                <div className="sm:col-span-12">
                  <input
                    type="text"
                    placeholder="Descrição personalizada (Ex: Internet, Aluguel, IPTU...)"
                    value={customTitle}
                    onChange={(e) => {
                      setCustomTitle(e.target.value);
                      setIsPreFilledByAi(false);
                    }}
                    maxLength={40}
                    required
                    className={`w-full px-4 py-3 text-sm bg-[var(--bg-input)] border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50 ${
                      isPreFilledByAi 
                        ? 'border-emerald-500/30 ring-4 ring-emerald-500/5 focus:ring-emerald-500/10 focus:border-emerald-500' 
                        : 'border-[var(--border-input)]'
                    }`}
                  />
                </div>
              )}

              <div className="sm:col-span-4 relative">
                <span className="absolute left-3 top-3.5 text-xs text-[var(--text-sub)] font-bold">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0,00"
                  value={valueStr}
                  onChange={(e) => {
                    setValueStr(e.target.value);
                    setIsPreFilledByAi(false);
                  }}
                  required
                  className={`w-full pl-8 pr-3 py-3 text-sm bg-[var(--bg-input)] border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-mono font-bold text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50 ${
                    isPreFilledByAi 
                      ? 'border-emerald-500/30 ring-4 ring-emerald-500/5 focus:ring-[#23cf8c] focus:border-[#23cf8c]' 
                      : 'border-[var(--border-input)]'
                  }`}
                />
              </div>

              <div className="sm:col-span-4 relative">
                <Calendar size={14} className="absolute left-3 top-3.5 text-[var(--text-sub)]" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    setIsPreFilledByAi(false);
                  }}
                  required
                  className={`w-full pl-9 pr-3 py-3 text-sm bg-[var(--bg-input)] border rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#23cf8c] transition-all text-[var(--text-body)] font-semibold ${
                    isPreFilledByAi 
                      ? 'border-emerald-500/30 ring-4 ring-emerald-500/5 focus:border-[#23cf8c]' 
                      : 'border-[var(--border-input)]'
                  }`}
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2 pl-1 select-none">
                <input
                  type="checkbox"
                  id="isPaidAdd"
                  checked={isPaidOnAdd}
                  onChange={(e) => setIsPaidOnAdd(e.target.checked)}
                  className="w-4 h-4 text-emerald-500 bg-[var(--bg-input)] border-[var(--border-input)] rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="isPaidAdd" className="text-xs font-bold text-[var(--text-sub)] cursor-pointer text-nowrap">
                  Já Paga
                </label>
              </div>

              <button
                type="submit"
                className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                <Plus size={16} />
                Lançar
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Main Monthly Expenses List */}
      <div className="flex-1 overflow-y-auto py-4 min-h-[220px] max-h-[380px]" id="bills-items-list">
        {activeMonthBills.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[var(--text-sub)]">
            <AlertCircle size={36} className="stroke-1 text-[var(--text-sub)] mb-2" />
            <p className="text-sm font-medium">Nenhuma conta cadastrada</p>
            <p className="text-xs text-[var(--text-sub)]">Lance as despesas deste mês usando os botões acima</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence initial={false}>
              {activeMonthBills.map(bill => {
                const meta = CATEGORY_META[bill.type] || CATEGORY_META.outros;
                const IconComponent = meta.icon;
                const displayTitle = bill.type === 'outros' && bill.customTitle ? bill.customTitle : meta.label;

                // Simple date formatter to Portuguese format
                const formatLocaleDate = (dateStr: string) => {
                  try {
                    const [year, month, day] = dateStr.split('-');
                    return `${day}/${month}/${year.substring(2)}`;
                  } catch {
                    return dateStr;
                  }
                };

                const emoji = bill.type === 'agua' ? '💧' : bill.type === 'energia' ? '⚡' : bill.type === 'racao_gatos' ? '🐱' : bill.type === 'racao_cachorro' ? '🐶' : '📑';
                const emojiBg = bill.type === 'agua' ? 'bg-cyan-500/10 text-cyan-400' : bill.type === 'energia' ? 'bg-amber-500/10 text-amber-400' : bill.type === 'racao_gatos' ? 'bg-fuchsia-500/10 text-fuchsia-400' : bill.type === 'racao_cachorro' ? 'bg-orange-500/10 text-orange-400' : 'bg-slate-500/10 text-slate-400';

                return (
                  <motion.div
                    key={bill.id}
                    layout
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                      bill.paid 
                        ? 'bg-[var(--bg-input)]/50 border-[var(--border-card)]/50 opacity-60' 
                        : 'bg-[var(--bg-input)] border-[var(--border-input)] hover:border-slate-650 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Left category-colored emoji background card representational */}
                      <div className={`w-12 h-12 ${emojiBg} rounded-xl flex items-center justify-center text-xl font-bold font-sans flex-shrink-0 shadow-xs`}>
                        {emoji}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-extrabold block truncate ${bill.paid ? 'text-[var(--text-sub)] line-through' : 'text-[var(--text-main)]'}`}>
                            {displayTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--text-sub)] font-bold">
                          <span>Venc. {formatLocaleDate(bill.dueDate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-sm font-mono font-extrabold block ${bill.paid ? 'text-[var(--text-sub)] font-medium' : 'text-[var(--text-main)]'}`}>
                          R$ {bill.value.toFixed(2)}
                        </span>
                        
                        {/* Interactive paid text badge */}
                        <button
                          type="button"
                          onClick={() => onToggleBillPaid(bill.id)}
                          className={`text-[9px] font-extrabold uppercase mt-1 tracking-wider border rounded-md px-1.5 py-0.5 pointer transition-all cursor-pointer inline-block ${
                            bill.paid 
                              ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20' 
                              : 'bg-amber-500/10 border-amber-500/15 text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          {bill.paid ? 'Pago' : 'Pendente'}
                        </button>
                      </div>

                      <button
                        onClick={() => onRemoveBill(bill.id)}
                        className="p-1.5 text-[var(--text-sub)] hover:text-red-450 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Excluir conta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Totals Summary Footer */}
      <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-card)] pt-4 bg-[var(--bg-card)] mt-auto" id="bills-footer-summary">
        <div className="p-3 rounded-xl bg-[var(--bg-input)] border border-[var(--border-card)] text-center">
          <span className="text-[9px] font-bold text-[var(--text-sub)] uppercase tracking-wider block mb-0.5">Pendentes</span>
          <span className="text-xs sm:text-sm font-extrabold font-mono text-amber-400">
            R$ {totalPending.toFixed(2)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
          <span className="text-[9px] font-bold text-[var(--text-sub)] uppercase tracking-wider block mb-0.5">Contas Pagas</span>
          <span className="text-xs sm:text-sm font-extrabold font-mono text-emerald-400">
            R$ {totalPaid.toFixed(2)}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-input-hover)] border border-[var(--border-input)] text-[var(--text-main)] text-center shadow-xs">
          <span className="text-[9px] font-medium text-[var(--text-sub)] uppercase tracking-wider block mb-0.5">Total Geral</span>
          <span className="text-xs sm:text-sm font-extrabold font-mono">
            R$ {grandTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
