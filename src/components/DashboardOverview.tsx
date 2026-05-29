import React, { useMemo } from 'react';
import { HouseBill, ShoppingItem } from '../types';
import { useShoppingStats } from '../hooks/useShoppingStats';
import { 
  PiggyBank, 
  ShoppingCart, 
  Droplet, 
  Zap, 
  Cat, 
  Dog, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  XCircle
} from 'lucide-react';

interface DashboardOverviewProps {
  bills: HouseBill[];
  shoppingItems: ShoppingItem[];
  currentMonth: string;
}

const DashboardOverview = React.memo(function DashboardOverview({ bills, shoppingItems, currentMonth }: DashboardOverviewProps) {
  // 1. Calculations optimized with useMemo & custom hook useShoppingStats
  const activeMonthBills = useMemo(() => bills.filter(b => b.month === currentMonth), [bills, currentMonth]);
  
  const totalPaidBills = useMemo(() => 
    activeMonthBills.filter(b => b.paid).reduce((sum, b) => sum + b.value, 0), 
    [activeMonthBills]
  );
  
  const totalPendingBills = useMemo(() => 
    activeMonthBills.filter(b => !b.paid).reduce((sum, b) => sum + b.value, 0), 
    [activeMonthBills]
  );
  
  const pendingActiveShoppingItemsCount = useMemo(() => {
    return shoppingItems.filter(item => !item.concluded && !item.checked).length;
  }, [shoppingItems]);

  const currentMonthPurchasedItems = useMemo(() => {
    if (!currentMonth) return [];
    return shoppingItems.filter(item => {
      if (!item.checked && !item.concluded) return false;
      const itemMonth = (item.date || '').substring(0, 7);
      return itemMonth === currentMonth;
    });
  }, [shoppingItems, currentMonth]);

  const { 
    totalCount: shoppingItemsCount, 
    checkedCount: shoppingCheckedCount 
  } = useShoppingStats(currentMonthPurchasedItems);

  // 2. Pet food & Utilities checks
  const waterBill = useMemo(() => activeMonthBills.find(b => b.type === 'agua'), [activeMonthBills]);
  const energyBill = useMemo(() => activeMonthBills.find(b => b.type === 'energia'), [activeMonthBills]);
  const catsFoodBill = useMemo(() => activeMonthBills.find(b => b.type === 'racao_gatos'), [activeMonthBills]);
  const dogsFoodBill = useMemo(() => activeMonthBills.find(b => b.type === 'racao_cachorro'), [activeMonthBills]);

  const getStatusBadge = (bill: HouseBill | undefined) => {
    if (!bill) {
      return {
        text: 'Não Lançado',
        color: 'badge-nao-lancado',
        icon: <AlertTriangle size={13} className="text-current" />
      };
    }
    if (bill.paid) {
      return {
        text: `Pago: R$ ${bill.value.toFixed(0)}`,
        color: 'badge-pago',
        icon: <CheckCircle2 size={13} className="text-current" />
      };
    }
    return {
      text: `Pendente: R$ ${bill.value.toFixed(0)}`,
      color: 'badge-pendente',
      icon: <XCircle size={13} className="text-current" />
    };
  };

  const waterStat = getStatusBadge(waterBill);
  const energyStat = getStatusBadge(energyBill);
  const catsFoodStat = getStatusBadge(catsFoodBill);
  const dogsFoodStat = getStatusBadge(dogsFoodBill);  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="dashboard-overview-area">
      {/* 1. Market Shopping Card */}
      <div className="md:col-span-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-[var(--text-sub)] uppercase tracking-widest block">Lista de Compras</span>
            <span className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shadow-xs">
              <ShoppingCart size={18} />
            </span>
          </div>
          
          <div className="space-y-1">
            <span className="text-3xl font-display font-extrabold text-[var(--text-main)]">
              {pendingActiveShoppingItemsCount}
            </span>
            <span className="text-xs text-[var(--text-sub)] block font-bold">
              itens pendentes de comprar
            </span>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border-card)] pt-3 flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-sub)]">Atendidos/Comprados este mês:</span>
          <span className="text-sm font-extrabold font-mono text-indigo-400">{shoppingCheckedCount} de {shoppingItemsCount}</span>
        </div>
      </div>

      {/* 2. Month Expenses Status Card */}
      <div className="md:col-span-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-extrabold text-[var(--text-sub)] uppercase tracking-widest block">Contas Pendentes</span>
            <span className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl shadow-xs">
              <PiggyBank size={18} />
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-3xl font-display font-extrabold text-[var(--text-main)]">
              R$ {totalPendingBills.toFixed(2)}
            </span>
            <span className="text-xs text-[var(--text-sub)] block font-bold">valor pendente este mês</span>
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--border-card)] pt-3 flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-sub)]">Total pago este mês:</span>
          <span className="text-sm font-extrabold font-mono text-emerald-500">R$ {totalPaidBills.toFixed(2)}</span>
        </div>
      </div>

      {/* 3. Predefined Elements Tracker Panel (Water, Energy, Pets) */}
      <div className="md:col-span-4 bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all">
        <span className="text-[10px] font-extrabold text-[var(--text-sub)] uppercase tracking-widest block mb-4">Status Prioritários do Mês</span>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Water */}
          <div className="p-3 rounded-2xl border border-[var(--border-card)] flex flex-col gap-2 bg-[var(--bg-input)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-sub)] font-extrabold">
              <Droplet size={12} className="text-sky-400" />
              <span>Água</span>
            </div>
            <div className={`p-1.5 text-[9px] font-extrabold rounded-lg flex items-center gap-1 border shadow-2xs ${waterStat.color}`}>
              {waterStat.icon}
              <span className="truncate">{waterStat.text}</span>
            </div>
          </div>

          {/* Energy */}
          <div className="p-3 rounded-2xl border border-[var(--border-card)] flex flex-col gap-2 bg-[var(--bg-input)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-sub)] font-extrabold">
              <Zap size={12} className="text-amber-500" />
              <span>Energia</span>
            </div>
            <div className={`p-1.5 text-[9px] font-extrabold rounded-lg flex items-center gap-1 border shadow-2xs ${energyStat.color}`}>
              {energyStat.icon}
              <span className="truncate">{energyStat.text}</span>
            </div>
          </div>

          {/* Cat Food */}
          <div className="p-3 rounded-2xl border border-[var(--border-card)] flex flex-col gap-2 bg-[var(--bg-input)]">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-sub)] font-extrabold">
              <Cat size={12} className="text-fuchsia-400" />
              <span>Gatos</span>
            </div>
            <div className={`p-1.5 text-[9px] font-extrabold rounded-lg flex items-center gap-1 border shadow-2xs ${catsFoodStat.color}`}>
              {catsFoodStat.icon}
              <span className="truncate">{catsFoodStat.text}</span>
            </div>
          </div>

          {/* Dog Food */}
          <div className="p-3 rounded-2xl border border-[var(--border-card)] flex flex-col gap-2 bg-[var(--bg-input)]">
            <div className={`flex items-center gap-1.5 text-xs text-[var(--text-sub)] font-extrabold`}>
              <Dog size={12} className="text-orange-400" />
              <span>Cão</span>
            </div>
            <div className={`p-1.5 text-[9px] font-extrabold rounded-lg flex items-center gap-1 border shadow-2xs ${dogsFoodStat.color}`}>
              {dogsFoodStat.icon}
              <span className="truncate">{dogsFoodStat.text}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default DashboardOverview;
