import React, { useMemo } from 'react';
import { HouseBill, ShoppingItem } from '../types';
import { useShoppingStats } from '../hooks/useShoppingStats';
import { 
  PiggyBank, 
  ShoppingCart
} from 'lucide-react';

interface DashboardOverviewProps {
  bills: HouseBill[];
  shoppingItems: ShoppingItem[];
  currentMonth: string;
  type?: 'shopping' | 'bills' | 'all';
}

const DashboardOverview = React.memo(function DashboardOverview({ bills, shoppingItems, currentMonth, type = 'all' }: DashboardOverviewProps) {
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

  const totalShoppingMarketSpent = useMemo(() => {
    return currentMonthPurchasedItems.reduce((acc, item) => acc + (item.price || 0), 0);
  }, [currentMonthPurchasedItems]);

  return (
    <div className={`grid grid-cols-1 ${type === 'all' ? 'md:grid-cols-12 gap-6' : 'gap-0'}`} id="dashboard-overview-area">
      {/* 1. Market Shopping Card */}
      {(type === 'all' || type === 'shopping') && (
        <div className={`${type === 'all' ? 'md:col-span-6' : ''} bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-500/30 transition-all flex flex-col justify-between`}>
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

          <div className="mt-5 space-y-2 border-t border-[var(--border-card)] pt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-sub)]">Atendidos/Comprados este mês:</span>
              <span className="text-sm font-extrabold font-mono text-indigo-400">{shoppingCheckedCount} de {shoppingItemsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-sub)]">Gasto computado no mês:</span>
              <span className="text-sm font-extrabold font-mono text-emerald-500">R$ {totalShoppingMarketSpent.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Month Expenses Status Card */}
      {(type === 'all' || type === 'bills') && (
        <div className={`${type === 'all' ? 'md:col-span-6' : ''} bg-[var(--bg-card)] border border-[var(--border-card)] rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all flex flex-col justify-between`}>
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
      )}
    </div>
  );
});

export default DashboardOverview;
