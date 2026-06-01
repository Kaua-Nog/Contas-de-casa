import React, { useState, useMemo } from 'react';
import { HouseBill, MonthlySummary, ShoppingItem } from '../types';
import { 
  BarChart3, 
  HelpCircle, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  CheckCircle2, 
  Info,
  DollarSign,
  PieChart,
  ShoppingBag,
  Sparkles,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface MonthlyChartProps {
  bills: HouseBill[];
  currentMonth: string;
  shoppingItems?: ShoppingItem[];
}

const MonthlyChart = React.memo(function MonthlyChart({ bills, currentMonth, shoppingItems = [] }: MonthlyChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'costs' | 'shopping'>('costs');
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Shopping Dashboard Period States
  const [periodOption, setPeriodOption] = useState<'all' | 'today' | 'this-month' | 'custom'>('this-month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // Default to last 7 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [showMoreRanking, setShowMoreRanking] = useState(false);

  // Generate PDF Summary for Selected Month
  const handleGeneratePDF = () => {
    const selectedMonthBills = bills.filter(b => b.month === currentMonth);
    const doc = new jsPDF();
    
    // Title Layout
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text("Resumo de Contas Mensais", 14, 22);

    // Decorative underline beneath title
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1.5);
    doc.line(14, 26, 65, 26);
    
    // Metadata block
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    const today = new Date().toLocaleDateString('pt-BR');
    doc.text(`Documento emitido em: ${today}`, 14, 32);
    
    // Month conversion label
    const [year, monthNum] = currentMonth.split('-');
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const monthName = monthNames[parseInt(monthNum, 10) - 1] || monthNum;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(`Período de Referência: ${monthName} de ${year}`, 14, 45);
    
    // Solid border rule
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 49, 196, 49);
    
    // Overhead calculations
    const paidSum = selectedMonthBills.filter(b => b.paid).reduce((sum, b) => sum + b.value, 0);
    const pendingSum = selectedMonthBills.filter(b => !b.paid).reduce((sum, b) => sum + b.value, 0);
    const totalSum = paidSum + pendingSum;
    
    // Finance Overview Cards Simulation
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("CONSOLIDAÇÃO FINANCEIRA", 14, 58);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Contas Pagas:", 14, 66);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(16, 185, 129); // emerald-500/green
    doc.text(`R$ ${paidSum.toFixed(2)}`, 85, 66);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Contas Pendentes:", 14, 72);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(245, 158, 11); // amber-500
    doc.text(`R$ ${pendingSum.toFixed(2)}`, 85, 72);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Custo Mensal Total:", 14, 78);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(`R$ ${totalSum.toFixed(2)}`, 85, 78);
    
    // Table line separator
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 84, 196, 84);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("LISTAGEM DE CONTAS LANÇADAS", 14, 93);
    
    // Headers layout
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("CONTA / CATEGORIA / TÍTULO", 14, 101);
    doc.text("VENCIMENTO", 100, 101);
    doc.text("SITUAÇÃO", 140, 101);
    doc.text("VALOR (R$)", 196, 101, { align: "right" });
    
    // Table header rule
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.line(14, 104, 196, 104);
    
    let y = 111;
    
    if (selectedMonthBills.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("Não existem contas registradas para o mês selecionado.", 14, y);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      
      const categoryNames: Record<string, string> = {
        'agua': 'Água',
        'energia': 'Energia',
        'racao_gatos': 'Ração Gatos',
        'racao_cachorro': 'Ração Cachorro',
        'outros': 'Outros'
      };
      
      selectedMonthBills.forEach((b) => {
        // Page breaking mechanics
        if (y > 275) {
          doc.addPage();
          y = 20;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text("CONTA / CATEGORIA / TÍTULO", 14, y);
          doc.text("VENCIMENTO", 100, y);
          doc.text("SITUAÇÃO", 140, y);
          doc.text("VALOR (R$)", 196, y, { align: "right" });
          doc.line(14, y + 3, 196, y + 3);
          y += 10;
        }
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85); // slate-700
        
        const friendlyCat = categoryNames[b.type] || b.type;
        const titleText = b.customTitle ? `${friendlyCat} (${b.customTitle})` : friendlyCat;
        
        // Format Due Date ISO to pt-BR
        let friendlyDueDate = b.dueDate;
        try {
          if (b.dueDate) {
            const parts = b.dueDate.split('-');
            if (parts.length === 3) {
              friendlyDueDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
            }
          }
        } catch (err) {
          console.error(err);
        }
        
        doc.text(titleText, 14, y);
        doc.text(friendlyDueDate, 100, y);
        
        // Conditional colors/fonts for paid status
        if (b.paid) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(16, 185, 129);
          doc.text("PAGO", 140, y);
        } else {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(245, 158, 11);
          doc.text("PENDENTE", 140, y);
        }
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(51, 65, 85);
        doc.text(`R$ ${b.value.toFixed(2)}`, 196, y, { align: "right" });
        
        y += 8;
      });
    }
    
    doc.save(`resumo_contas_${currentMonth}.pdf`);
  };

  // --- TAB: COSTS (6 MONTHS BAR CHART) ---
  const getLast6MonthsStr = (): string[] => {
    const months: string[] = [];
    const [currYear, currMonth] = currentMonth.split('-').map(Number);
    
    for (let i = 5; i >= 0; i--) {
      let targetMonth = currMonth - i;
      let targetYear = currYear;
      
      if (targetMonth <= 0) {
        targetMonth += 12;
        targetYear -= 1;
      }
      
      months.push(`${targetYear}-${targetMonth.toString().padStart(2, '0')}`);
    }
    return months;
  };

  const getMonthLabel = (yyyyMm: string): string => {
    const [, month] = yyyyMm.split('-');
    const names = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    return names[parseInt(month) - 1];
  };

  const monthsToDisplay = getLast6MonthsStr();

  const chartData: MonthlySummary[] = monthsToDisplay.map(mStr => {
    const mBills = bills.filter(b => b.month === mStr);
    const paid = mBills.filter(b => b.paid).reduce((sum, b) => sum + b.value, 0);
    const pending = mBills.filter(b => !b.paid).reduce((sum, b) => sum + b.value, 0);

    return {
      month: mStr,
      monthName: getMonthLabel(mStr),
      paid,
      pending,
      total: paid + pending
    };
  });

  const maxTotal = Math.max(...chartData.map(d => d.total), 50);
  const [selectedCostMonth, setSelectedCostMonth] = useState<string>(currentMonth);
  
  // Keep original hovered logic, but use selectedCostMonth if nothing hovered
  const activeCostMonthStr = hoveredIndex !== null ? chartData[hoveredIndex].month : selectedCostMonth;
  const activeMonthBills = useMemo(() => bills.filter(b => b.month === activeCostMonthStr), [bills, activeCostMonthStr]);
  const activeMonthTotal = activeMonthBills.reduce((sum, b) => sum + b.value, 0);

  const costsByCategory = useMemo(() => {
    const categoryNames: Record<string, string> = {
      'agua': 'Água',
      'energia': 'Energia',
      'racao_gatos': 'Ração Gatos',
      'racao_cachorro': 'Ração Cachorro',
      'outros': 'Outros'
    };
    
    const totals: Record<string, number> = {};
    activeMonthBills.forEach(b => {
      const cat = categoryNames[b.type] || 'Outros';
      totals[cat] = (totals[cat] || 0) + b.value;
    });
    
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [activeMonthBills]);

  const maxCostValue = costsByCategory.length > 0 ? costsByCategory[0].value : 1;



  // --- TAB: INTEGRATED SHOPPING LIST PIE-CHART ---
  const activePurchasedItems = useMemo(() => {
    return shoppingItems.filter(item => {
      if (!item.checked && !item.concluded) return false;
      
      const itemDateStr = item.date || '';
      if (periodOption === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (itemDateStr !== todayStr) return false;
      } else if (periodOption === 'this-month') {
        const itemMonth = itemDateStr.substring(0, 7); // Format: YYYY-MM
        if (itemMonth !== currentMonth) return false;
      } else if (periodOption === 'custom') {
        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      }
      
      return true;
    });
  }, [shoppingItems, periodOption, currentMonth, startDate, endDate]);

  const categories = ['Alimentos', 'Bebidas', 'Limpeza', 'Higiene', 'Outros'];
  const categoryTotals = categories.map(cat => {
    const items = activePurchasedItems.filter(item => (item.category || '').trim().toLowerCase() === cat.trim().toLowerCase());
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      name: cat,
      value: totalQty,
      color: cat.toLowerCase() === 'alimentos' ? 'var(--color-alimentos)' : // Adaptive Sky blue
             cat.toLowerCase() === 'bebidas' ? 'var(--color-bebidas)' :    // Adaptive Purple
             cat.toLowerCase() === 'limpeza' ? 'var(--color-limpeza)' :    // Adaptive Teal
             cat.toLowerCase() === 'higiene' ? 'var(--color-higiene)' :    // Adaptive Pink
             'var(--color-outros)',                         // Adaptive Slate
      itemCount: items.length
    };
  }).filter(c => c.value > 0);

  const totalShoppingQty = categoryTotals.reduce((sum, c) => sum + c.value, 0);

  // Pie chart variables using absolute SVG rotation to guarantee a completely closed circular layout
  let accumulatedPercent = 0;
  const donutCircumference = 314.159; // 2 * pi * 50
  const slices = categoryTotals.map((slice) => {
    const percent = totalShoppingQty > 0 ? slice.value / totalShoppingQty : 0;
    const strokeLength = percent * donutCircumference;
    const startAngle = accumulatedPercent * 360; // rotation angle in degrees
    accumulatedPercent += percent;
    return {
      ...slice,
      percent,
      strokeLength,
      startAngle
    };
  });

  // Filter based on selected category and then sort by quantity
  const allMatchingRankingItems = useMemo(() => {
    return [...activePurchasedItems]
      .filter(item => !selectedCategory || (item.category || '').trim().toLowerCase() === selectedCategory.trim().toLowerCase())
      .sort((a, b) => b.quantity - a.quantity);
  }, [activePurchasedItems, selectedCategory]);

  const rankingLimit = showMoreRanking ? 15 : 4;
  const rankingTopItems = useMemo(() => allMatchingRankingItems.slice(0, rankingLimit), [allMatchingRankingItems, rankingLimit]);

  const maxItemQty = allMatchingRankingItems.length > 0 ? allMatchingRankingItems[0].quantity : 1;


  return (
    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-card)] shadow-sm p-6 h-full flex flex-col transition-colors duration-200" id="monthly-chart-card">
      
      {/* Upper Tab switcher header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-card)] mb-6" id="chart-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shadow-xs">
            {activeTab === 'costs' ? <BarChart3 size={20} /> : <PieChart size={20} />}
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-main)]">
              {activeTab === 'costs' ? 'Histórico de Custos' : 'Dashboard de Compras'}
            </h2>
            <p className="text-xs text-[var(--text-sub)] font-bold">
              {activeTab === 'costs' 
                ? 'Custos totais consolidados das contas dos últimos 6 meses' 
                : 'Distribuição e estatísticas dos itens da lista de compras'}
            </p>
          </div>
        </div>

        {/* Outer Tabs switcher & PDF Button Wrapper */}
        <div className="flex items-center gap-2.5 self-center sm:self-auto">
          {activeTab === 'costs' && (
            <button
              onClick={handleGeneratePDF}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold text-[#ffffff] bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-xs select-none cursor-pointer uppercase tracking-wider"
              title="Gerar PDF com resumo das contas"
              id="chart-download-pdf-btn"
            >
              <FileDown size={13} className="animate-pulse" />
              <span>Gerar PDF</span>
            </button>
          )}

          <div className="flex bg-[var(--bg-input)] p-1 rounded-xl border border-[var(--border-input)]">
            <button
              onClick={() => {
                setActiveTab('costs');
                setSelectedCategory(null);
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'costs' 
                  ? 'bg-[var(--bg-input-hover)] text-[var(--text-main)] shadow-2xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
              }`}
            >
              Custos
            </button>
            <button
              onClick={() => setActiveTab('shopping')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === 'shopping' 
                  ? 'bg-indigo-600 text-white shadow-2xs' 
                  : 'text-[var(--text-sub)] hover:text-indigo-400'
              }`}
            >
              <PieChart size={12} />
              Dashboard
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'costs' ? (
          <motion.div
            key="costs-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
          >
            {/* SVG Interactive Chart Canvas */}
            <div className="relative pt-6 pb-2 mb-4" id="svg-chart-container">
              {hoveredIndex !== null && (
                <div className="absolute top-0 left-0 right-0 mx-auto bg-[var(--bg-card)] border border-[var(--border-input)] text-[var(--text-main)] rounded-xl py-1.5 px-3.5 shadow-md flex justify-between items-center text-xs max-w-sm transition-all z-35">
                  <span className="font-bold text-[11px] uppercase tracking-wide">{chartData[hoveredIndex].monthName} / {chartData[hoveredIndex].month.split('-')[0]}</span>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-[var(--text-sub)]">Pago: <b className="text-emerald-400">R${chartData[hoveredIndex].paid.toFixed(0)}</b></span>
                    <span className="text-[var(--text-sub)]">Pendente: <b className="text-amber-400">R${chartData[hoveredIndex].pending.toFixed(0)}</b></span>
                    <span className="text-[var(--text-main)] border-l border-[var(--border-card)] pl-3">Total: <b>R${chartData[hoveredIndex].total.toFixed(0)}</b></span>
                  </div>
                </div>
              )}

              <div className="w-full flex items-end justify-between h-[180px] px-2 mb-2">
                {chartData.map((item, index) => {
                  const paidPct = (item.paid / maxTotal) * 100;
                  const pendingPct = (item.pending / maxTotal) * 100;
                  const totalPct = (item.total / maxTotal) * 100;
                  const isCurrent = item.month === currentMonth;

                  return (
                    <div 
                      key={item.month} 
                      className={`flex-1 flex flex-col items-center group cursor-pointer ${item.month === selectedCostMonth ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setSelectedCostMonth(item.month)}
                    >
                      <div className="w-full flex justify-center items-end h-[150px] relative">
                        {/* Grid Lines behind bars */}
                        <div className="absolute left-0 right-0 w-full h-[1px] bg-[var(--border-card)] bottom-1/4 -z-5 pointer-events-none opacity-40"></div>
                        <div className="absolute left-0 right-0 w-full h-[1px] bg-[var(--border-card)] bottom-2/4 -z-5 pointer-events-none opacity-40"></div>
                        <div className="absolute left-0 right-0 w-full h-[1px] bg-[var(--border-card)] bottom-3/4 -z-5 pointer-events-none opacity-40"></div>

                        {/* Stacking Bars */}
                        <div className="w-[32px] sm:w-[42px] flex flex-col justify-end h-full relative rounded-t-lg overflow-hidden transition-all group-hover:shadow-xs group-hover:brightness-110">
                          {/* Pending Expense section */}
                          <div 
                            style={{ height: `${pendingPct}%` }} 
                            className="bg-amber-400 opacity-90 transition-all duration-300"
                          ></div>
                          {/* Paid Expense section */}
                          <div 
                            style={{ height: `${paidPct}%` }} 
                            className="bg-emerald-500 transition-all duration-300"
                          ></div>
                        </div>
                      </div>

                      {/* X-Axis Labels */}
                      <div className="mt-2 text-center select-none">
                        <span className={`text-[11px] font-extrabold block ${isCurrent ? 'text-indigo-400 underline decoration-2 underline-offset-4' : 'text-[var(--text-sub)]'}`}>
                          {item.monthName}
                        </span>
                        {isCurrent && <span className="text-[7px] bg-indigo-500/20 text-indigo-300 px-1 rounded-sm block mt-0.5 uppercase font-black tracking-wider">Mês Atual</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend and Info Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto border-t border-[var(--border-card)] pt-5 bg-[var(--bg-card)]">
              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-extrabold text-[var(--text-sub)] uppercase tracking-wider block mb-3">Legenda das Contas</span>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-sm bg-emerald-500 block shadow-2xs"></span>
                      <span className="text-xs font-bold text-[var(--text-body)]">Contas Pagas</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-400/20 bg-amber-400/5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3.5 h-3.5 rounded-sm bg-amber-400 block shadow-2xs"></span>
                      <span className="text-xs font-bold text-[var(--text-body)]">Contas Pendentes</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 text-[10px] text-[var(--text-sub)] flex items-center gap-1 font-medium">
                  <Info size={12} className="text-indigo-400" />
                  <span>Clique nas colunas do gráfico para ver os detalhes do mês.</span>
                </div>
              </div>

              <div className="flex flex-col border border-[var(--border-card)] rounded-2xl bg-[var(--bg-input)]/40 p-4">
                <div className="flex items-center justify-between mb-3 border-b border-[var(--border-card)] pb-2">
                  <span className="text-[11px] font-extrabold text-[var(--text-main)] uppercase tracking-wider">
                    {getMonthLabel(activeCostMonthStr)} / {activeCostMonthStr.split('-')[0]}
                  </span>
                  <span className="text-xs font-mono font-bold text-indigo-400">R$ {activeMonthTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '140px' }}>
                  {costsByCategory.length === 0 ? (
                    <div className="text-center font-bold text-xs py-4 text-[var(--text-sub)]">
                      Nenhuma conta neste mês.
                    </div>
                  ) : (
                    costsByCategory.map(cat => {
                      const widthPct = (cat.value / maxCostValue) * 100;
                      return (
                        <div key={cat.name} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-body)]">
                            <span className="truncate pr-2">{cat.name}</span>
                            <span className="font-mono flex-shrink-0">R$ {cat.value.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-[var(--bg-input)] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${widthPct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="shopping-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col"
          >
            {/* Date & Period Selection Section */}
            <div className="mb-5 p-3.5 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-input)]/20 flex flex-col gap-3 animate-fade-in" id="shopping-period-filter-dash">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-indigo-400" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)]">Período de Visualização</span>
                </div>
                
                <div className="flex items-center gap-1 bg-[var(--bg-input)] p-0.5 rounded-lg border border-[var(--border-input)] text-xs">
                  <button
                    onClick={() => setPeriodOption('all')}
                    className={`px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      periodOption === 'all' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Tudo
                  </button>
                  <button
                    onClick={() => setPeriodOption('today')}
                    className={`px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      periodOption === 'today' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Hoje
                  </button>
                  <button
                    onClick={() => setPeriodOption('this-month')}
                    className={`px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      periodOption === 'this-month' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Este Mês
                  </button>
                  <button
                    onClick={() => setPeriodOption('custom')}
                    className={`px-2.5 py-1 font-bold rounded-md transition-all cursor-pointer ${
                      periodOption === 'custom' 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'text-[var(--text-sub)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>
              </div>

              {periodOption === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-1 p-2.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-card)] animate-fade-in-down">
                  <div>
                    <label className="text-[10px] font-extrabold text-[var(--text-sub)] uppercase block mb-1">De (Início)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-body)] font-mono font-medium focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-[var(--text-sub)] uppercase block mb-1">Até (Fim)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-lg text-[var(--text-body)] font-mono font-medium focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {totalShoppingQty === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 py-12 text-[var(--text-sub)]">
                <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full mb-3">
                  <ShoppingBag size={32} />
                </div>
                <p className="text-sm font-semibold text-[var(--text-body)]">Nenhum item adicionado no mercado</p>
                <p className="text-xs text-[var(--text-sub)] mt-1 max-w-[280px] leading-normal font-bold">
                  Insira novos itens na Lista de Compras para gerar as métricas e o gráfico de pizza consolidado!
                </p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                
                {/* Visual Donut Pie Chart column */}
                <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                  <div className="relative w-[150px] h-[150px]">
                    <svg width="150" height="150" viewBox="0 0 140 140" className="transform -rotate-90 w-full h-full">
                      {slices.map((slice, index) => {
                        const isHovered = hoveredSlice === index;
                        const isSelected = selectedCategory?.toLowerCase() === slice.name.toLowerCase();
                        
                        // Intelligent opacity to emphasize selected or hovered slices and dim the rest
                        const opacity = hoveredSlice !== null
                          ? (isHovered ? "1" : "0.5")
                          : (selectedCategory ? (isSelected ? "1" : "0.25") : "1");

                        return (
                          <circle
                            key={slice.name}
                            cx="70"
                            cy="70"
                            r="50"
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth={isSelected ? "22" : (isHovered ? "20" : "15")}
                            strokeDasharray={`${slice.strokeLength} 314.159`}
                            strokeDashoffset={0}
                            opacity={opacity}
                            className={`transition-all duration-200 cursor-pointer ${isSelected ? 'drop-shadow-xs' : ''}`}
                            style={{ 
                              transform: `rotate(${slice.startAngle}deg)`,
                              transformOrigin: '70px 70px' 
                            }}
                            onMouseEnter={() => setHoveredSlice(index)}
                            onMouseLeave={() => setHoveredSlice(null)}
                            onClick={() => setSelectedCategory(curr => curr?.toLowerCase() === slice.name.toLowerCase() ? null : slice.name)}
                          />
                        );
                      })}
                      
                      {/* Innermost overlay circle mapping */}
                      <circle cx="70" cy="70" r="39" fill="var(--bg-card)" className="transition-colors duration-200" />
                    </svg>

                    {/* Centered Stats dynamic display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none select-none">
                      {hoveredSlice !== null ? (
                        <>
                          <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-widest truncate max-w-[90px]">
                            {slices[hoveredSlice].name}
                          </span>
                          <span className="text-lg font-extrabold text-[var(--text-main)] leading-none mt-0.5">
                            {slices[hoveredSlice].value} un
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-sub)] mt-0.5">
                            {(slices[hoveredSlice].percent * 100).toFixed(0)}%
                          </span>
                        </>
                      ) : selectedCategory !== null ? (
                        <>
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest truncate max-w-[90px]">
                            {selectedCategory}
                          </span>
                          <span className="text-lg font-extrabold text-[var(--text-main)] leading-none mt-0.5">
                            {categoryTotals.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase())?.value || 0} un
                          </span>
                          <span className="text-[8px] font-bold text-[var(--text-sub)] mt-0.5">
                            {((categoryTotals.find(c => c.name.toLowerCase() === selectedCategory.toLowerCase())?.value || 0) / (totalShoppingQty || 1) * 100).toFixed(0)}% do total
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold text-[var(--text-sub)] uppercase tracking-widest">
                            Total Geral
                          </span>
                          <span className="text-xl font-black text-[var(--text-main)] leading-none mt-0.5">
                            {totalShoppingQty}
                          </span>
                          <span className="text-[9px] font-bold text-[var(--text-sub)] mt-0.5">
                            itens
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-[10px] font-bold text-[var(--text-sub)] mt-4 flex items-center gap-1">
                    <Info size={10} className="text-indigo-400" />
                    <span>Clique nas fatias ou legenda para filtrar itens</span>
                  </p>
                </div>

                {/* Categories legends and Ranking List */}
                <div className="md:col-span-7 space-y-4">
                  
                  {/* Slices representation details list */}
                  <div>
                    <span className="text-[11px] font-extrabold text-[var(--text-sub)] uppercase tracking-wider block mb-2">Porcentagem por Categorias</span>
                    <div className="grid grid-cols-2 gap-2">
                      {slices.map((slice, index) => {
                        const isSelected = selectedCategory?.toLowerCase() === slice.name.toLowerCase();
                        return (
                          <div 
                            key={slice.name}
                            onClick={() => setSelectedCategory(curr => curr?.toLowerCase() === slice.name.toLowerCase() ? null : slice.name)}
                            className={`flex items-center justify-between p-2 rounded-xl transition-all border cursor-pointer select-none ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xs'
                                : hoveredSlice === index 
                                  ? 'bg-[var(--bg-input-hover)] border-[var(--border-input)]' 
                                  : 'bg-[var(--bg-input)]/45 border-transparent hover:border-[var(--border-card)]'
                            }`}
                            onMouseEnter={() => setHoveredSlice(index)}
                            onMouseLeave={() => setHoveredSlice(null)}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full block flex-shrink-0" style={{ backgroundColor: slice.color }}></span>
                              <span className="text-xs font-semibold text-[var(--text-body)] truncate">{slice.name}</span>
                            </div>
                            <span className="text-xs font-mono font-bold text-[var(--text-sub)]">{(slice.percent * 100).toFixed(0)}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Ranking Most Purchased individual items list */}
                  <div className="border-t border-[var(--border-card)] pt-3">
                    <span className="text-[11px] font-extrabold text-[var(--text-sub)] uppercase tracking-wider block mb-2 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1">
                        <Sparkles size={11} className="text-indigo-400" />
                        <span>Produtos com Maior Quantidade {selectedCategory ? `em ${selectedCategory}` : ''}</span>
                      </span>
                      {selectedCategory && (
                        <button 
                          onClick={() => setSelectedCategory(null)}
                          className="text-[9px] bg-red-400/15 text-red-500 border border-red-500/35 hover:bg-indigo-500/20 px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider transition-all select-none cursor-pointer"
                        >
                          Limpar Filtro
                        </button>
                      )}
                    </span>
                    <div className="space-y-1.5 font-sans">
                      {rankingTopItems.length === 0 ? (
                        <div className="text-center font-bold text-xs py-3 text-[var(--text-sub)]">
                          Nenhum produto cadastrado para essa categoria.
                        </div>
                      ) : (
                        rankingTopItems.map((item) => {
                          const widthPct = (item.quantity / maxItemQty) * 100;
                          const isChecked = item.checked;
                          return (
                            <div key={item.id} className="bg-[var(--bg-input)]/40 p-2 rounded-xl border border-[var(--border-card)] flex items-center justify-between gap-3 text-xs leading-none">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold truncate block pr-2 text-[var(--text-body)]">{item.name}</span>
                                  <span className="font-mono font-bold text-[var(--text-sub)] flex-shrink-0">{item.quantity} un</span>
                                </div>
                                <div className="w-full bg-[var(--bg-input)] h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${widthPct}%` }}></div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}

                      {allMatchingRankingItems.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowMoreRanking(prev => !prev)}
                          className="w-full py-2 hover:bg-slate-500/10 text-center text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 transition-all uppercase tracking-wider rounded-lg border border-dashed border-indigo-400/20 hover:border-indigo-400/40 select-none cursor-pointer mt-2"
                        >
                          {showMoreRanking ? 'Exibir Menos ▲' : `Exibir Mais (${allMatchingRankingItems.length - 4} adicionais) ▼`}
                        </button>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default MonthlyChart;
