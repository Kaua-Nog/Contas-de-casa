import React, { useState, useEffect } from 'react';
import { ShoppingItem, HouseBill, BillType } from './types';
import DashboardOverview from './components/DashboardOverview';
import ShoppingList from './components/ShoppingList';
import BillsTracker from './components/BillsTracker';
import MonthlyChart from './components/MonthlyChart';
import ConfirmModal from './components/ConfirmModal';
import { db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  CalendarDays, 
  RefreshCw,
  Info,
  Cloud,
  Check,
  Sun,
  Moon
} from 'lucide-react';

// Get current date values
const INITIAL_DATE = new Date();
const CURRENT_MONTH_STR = `${INITIAL_DATE.getFullYear()}-${(INITIAL_DATE.getMonth() + 1).toString().padStart(2, '0')}`;

// Mock database to populate if database snap is empty
const INITIAL_SHOPPING_MOCK: ShoppingItem[] = [
  { id: 'shop-1', name: 'Arroz integral 5kg', quantity: 1, category: 'Alimentos', checked: false },
  { id: 'shop-2', name: 'Leite integral (Caixa)', quantity: 4, category: 'Alimentos', checked: true },
  { id: 'shop-3', name: 'Ração Sachê Gatos Whiskas', quantity: 12, category: 'Alimentos', checked: false },
  { id: 'shop-4', name: 'Detergente Neutro Ypê', quantity: 2, category: 'Limpeza', checked: true },
  { id: 'shop-5', name: 'Sabonete Dove', quantity: 3, category: 'Higiene', checked: false },
  { id: 'shop-6', name: 'Macarrão Espaguete Adria', quantity: 2, category: 'Alimentos', checked: false }
];

const INITIAL_BILLS_MOCK: HouseBill[] = [
  // Current month
  { id: 'bill-c1', type: 'agua', value: 48.90, month: CURRENT_MONTH_STR, dueDate: `${CURRENT_MONTH_STR}-10`, paid: true },
  { id: 'bill-c2', type: 'energia', value: 135.20, month: CURRENT_MONTH_STR, dueDate: `${CURRENT_MONTH_STR}-18`, paid: false },
  { id: 'bill-c3', type: 'racao_gatos', value: 129.90, month: CURRENT_MONTH_STR, dueDate: `${CURRENT_MONTH_STR}-05`, paid: true },
  { id: 'bill-c4', type: 'racao_cachorro', value: 179.90, month: CURRENT_MONTH_STR, dueDate: `${CURRENT_MONTH_STR}-22`, paid: false },
  { id: 'bill-c5', type: 'outros', customTitle: 'Internet Fibra', value: 99.90, month: CURRENT_MONTH_STR, dueDate: `${CURRENT_MONTH_STR}-15`, paid: true },

  // Last Month
  { id: 'bill-p1-1', type: 'agua', value: 44.50, month: getOffsetMonth(-1), dueDate: `${getOffsetMonth(-1)}-10`, paid: true },
  { id: 'bill-p1-2', type: 'energia', value: 121.80, month: getOffsetMonth(-1), dueDate: `${getOffsetMonth(-1)}-18`, paid: true },
  { id: 'bill-p1-3', type: 'racao_gatos', value: 129.90, month: getOffsetMonth(-1), dueDate: `${getOffsetMonth(-1)}-05`, paid: true },
  { id: 'bill-p1-4', type: 'racao_cachorro', value: 179.90, month: getOffsetMonth(-1), dueDate: `${getOffsetMonth(-1)}-22`, paid: true },

  // Current Month - 2
  { id: 'bill-p2-1', type: 'agua', value: 52.30, month: getOffsetMonth(-2), dueDate: `${getOffsetMonth(-2)}-10`, paid: true },
  { id: 'bill-p2-2', type: 'energia', value: 142.10, month: getOffsetMonth(-2), dueDate: `${getOffsetMonth(-2)}-18`, paid: true },
  { id: 'bill-p2-3', type: 'racao_gatos', value: 129.90, month: getOffsetMonth(-2), dueDate: `${getOffsetMonth(-2)}-05`, paid: true },

  // Current Month - 3
  { id: 'bill-p3-1', type: 'agua', value: 46.00, month: getOffsetMonth(-3), dueDate: `${getOffsetMonth(-3)}-10`, paid: true },
  { id: 'bill-p3-2', type: 'energia', value: 118.50, month: getOffsetMonth(-3), dueDate: `${getOffsetMonth(-3)}-18`, paid: true },
  { id: 'bill-p3-3', type: 'racao_cachorro', value: 179.90, month: getOffsetMonth(-3), dueDate: `${getOffsetMonth(-3)}-22`, paid: true },

  // Current Month - 4
  { id: 'bill-p4-1', type: 'agua', value: 41.20, month: getOffsetMonth(-4), dueDate: `${getOffsetMonth(-4)}-10`, paid: true },
  { id: 'bill-p4-2', type: 'energia', value: 110.40, month: getOffsetMonth(-4), dueDate: `${getOffsetMonth(-4)}-18`, paid: true },
  { id: 'bill-p4-3', type: 'racao_gatos', value: 129.90, month: getOffsetMonth(-4), dueDate: `${getOffsetMonth(-4)}-05`, paid: true },
  { id: 'bill-p4-4', type: 'racao_cachorro', value: 179.90, month: getOffsetMonth(-4), dueDate: `${getOffsetMonth(-4)}-22`, paid: true },

  // Current Month - 5
  { id: 'bill-p5-1', type: 'agua', value: 49.80, month: getOffsetMonth(-5), dueDate: `${getOffsetMonth(-5)}-10`, paid: true },
  { id: 'bill-p5-2', type: 'energia', value: 139.00, month: getOffsetMonth(-5), dueDate: `${getOffsetMonth(-5)}-18`, paid: true },
];

function getOffsetMonth(offset: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + offset);
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [selectedMonth, setSelectedMonth] = useState<string>(CURRENT_MONTH_STR);
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);
  const [bills, setBills] = useState<HouseBill[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [dbSynced, setDbSynced] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    type?: 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {}
  });

  // 1. Setup Firestore Real-time Listeners
  useEffect(() => {
    // Escutar lista de compras
    const unsubShopping = onSnapshot(collection(db, 'shopping_items'), (snapshot) => {
      const itemsList: ShoppingItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        itemsList.push({
          id: doc.id,
          name: data.name,
          category: data.category,
          quantity: data.quantity,
          checked: data.checked,
          date: data.date || '',
          concluded: !!data.concluded
        } as ShoppingItem);
      });
      setShoppingItems(itemsList);
      setDbSynced(true);
    }, (error) => {
      console.error("Erro ao sincronizar Firestore compras: ", error);
      showNotification("Erro na conexão com banco de dados em nuvem.");
    });

    // Escutar contas
    const unsubBills = onSnapshot(collection(db, 'bills'), (snapshot) => {
      const billsList: HouseBill[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        billsList.push({
          id: doc.id,
          type: data.type,
          customTitle: data.customTitle,
          value: parseFloat(data.value) || 0,
          month: data.month,
          dueDate: data.dueDate,
          paid: data.paid
        } as HouseBill);
      });
      setBills(billsList);
    }, (error) => {
      console.error("Erro ao sincronizar Firestore contas: ", error);
    });

    return () => {
      unsubShopping();
      unsubBills();
    };
  }, []);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // 2. Shopping List Actions synced to Cloud Firestore
  const handleAddShoppingItem = async (name: string, category: string, quantity: number, date?: string) => {
    const itemId = `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    // Normalize category to standard title-case form
    let normalizedCategory = (category || 'Outros').trim();
    const match = ['alimentos', 'bebidas', 'limpeza', 'higiene', 'outros'].indexOf(normalizedCategory.toLowerCase());
    if (match !== -1) {
      const standardCategories = ['Alimentos', 'Bebidas', 'Limpeza', 'Higiene', 'Outros'];
      normalizedCategory = standardCategories[match];
    }

    const newItem: ShoppingItem = {
      id: itemId,
      name,
      category: normalizedCategory,
      quantity,
      checked: false,
      date: '', // No date initially
      concluded: false
    };

    try {
      await setDoc(doc(db, 'shopping_items', itemId), newItem);
      showNotification(`"${name}" salvo na Nuvem!`);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao salvar item na Nuvem.');
    }
  };

  const handleToggleShoppingItem = async (id: string) => {
    const target = shoppingItems.find(item => item.id === id);
    if (!target) return;

    try {
      const nextState = !target.checked;
      const updateData: Partial<ShoppingItem> = { checked: nextState };
      
      if (nextState) {
        // Assign today's date automatically as the item is placed into the cart
        updateData.date = new Date().toISOString().split('T')[0];
      } else {
        // Clear date as the item is returned to pending
        updateData.date = '';
      }

      await updateDoc(doc(db, 'shopping_items', id), updateData);
      if (nextState) {
        showNotification(`"${target.name}" colocado no carrinho! 🛒`);
      }
    } catch (err) {
      console.error(err);
      showNotification('Erro ao atualizar item na Nuvem.');
    }
  };

  const handleUpdateQuantity = async (id: string, change: number) => {
    const target = shoppingItems.find(item => item.id === id);
    if (!target) return;

    try {
      const nextQty = Math.max(1, target.quantity + change);
      await updateDoc(doc(db, 'shopping_items', id), { quantity: nextQty });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveShoppingItem = (id: string) => {
    const target = shoppingItems.find(item => item.id === id);
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Item de Compras',
      description: `Tem certeza de que deseja remover "${target.name}" da lista de compras na Nuvem?`,
      confirmText: 'Excluir',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'shopping_items', id));
          showNotification(`"${target.name}" removido.`);
        } catch (err) {
          console.error(err);
          showNotification('Erro ao remover da Nuvem.');
        }
      }
    });
  };

  const handleClearShoppingList = () => {
    const activeItems = shoppingItems.filter(item => !item.concluded);
    if (activeItems.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Esvaziar Lista de Compras',
      description: 'Tem certeza de que deseja apagar todos os itens ativos (não concluídos) da sua lista de compras da Nuvem? Os itens já concluídos no histórico serão preservados.',
      confirmText: 'Esvaziar',
      type: 'danger',
      onConfirm: async () => {
        try {
          await Promise.all(activeItems.map(item => deleteDoc(doc(db, 'shopping_items', item.id))));
          showNotification('Lista de compras ativa esvaziada na Nuvem.');
        } catch (err) {
          console.error(err);
          showNotification('Erro ao limpar lista na Nuvem.');
        }
      }
    });
  };

  const handleMarkAllShopping = async (checked: boolean) => {
    try {
      const activeItems = shoppingItems.filter(item => !item.concluded);
      const todayStr = new Date().toISOString().split('T')[0];
      await Promise.all(activeItems.map(item => 
        updateDoc(doc(db, 'shopping_items', item.id), { 
          checked,
          date: checked ? todayStr : ''
        })
      ));
      showNotification(checked ? 'Todos os itens ativos colocados no carrinho!' : 'Todos os itens ativos marcados como faltando.');
    } catch (err) {
      console.error(err);
      showNotification('Erro ao atualizar na Nuvem.');
    }
  };

  const handleConcludePurchase = async () => {
    const itemsInCart = shoppingItems.filter(item => !item.concluded && item.checked);
    if (itemsInCart.length === 0) {
      showNotification('Nenhum item no carrinho para concluir!');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Concluir Compra',
      description: `Tem certeza de que deseja concluir a compra de ${itemsInCart.length} item(ns) no carrinho? Eles sairão da lista ativa e serão salvos no histórico e dashboards do aplicativo.`,
      confirmText: 'Concluir Compra',
      type: 'warning',
      onConfirm: async () => {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          await Promise.all(itemsInCart.map(item => 
            updateDoc(doc(db, 'shopping_items', item.id), { 
              concluded: true,
              checked: true,
              date: item.date || todayStr
            })
          ));
          showNotification('Compra concluída com sucesso! Histórico atualizado. 🎉');
        } catch (err) {
          console.error(err);
          showNotification('Erro ao concluir compra na Nuvem.');
        }
      }
    });
  };

  // 3. Bills Tracker Actions synced to Cloud Firestore
  const handleAddBill = async (type: BillType, value: number, dueDate: string, customTitle?: string, paid = false) => {
    const billMonth = dueDate.substring(0, 7); // "YYYY-MM"
    const billId = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const newBill: HouseBill = {
      id: billId,
      type,
      customTitle: customTitle || '',
      value,
      dueDate,
      month: billMonth,
      paid
    };

    try {
      await setDoc(doc(db, 'bills', billId), newBill);
      const label = type === 'outros' && customTitle ? customTitle : getTypeName(type);
      showNotification(`Conta de "${label}" salva na Nuvem!`);
    } catch (err) {
      console.error(err);
      showNotification('Erro ao salvar conta na Nuvem.');
    }
  };

  const handleToggleBillStatus = async (id: string) => {
    const target = bills.find(bill => bill.id === id);
    if (!target) return;

    try {
      const nextPaid = !target.paid;
      await updateDoc(doc(db, 'bills', id), { paid: nextPaid });
      const label = target.type === 'outros' && target.customTitle ? target.customTitle : getTypeName(target.type);
      showNotification(`Conta "${label}" ${nextPaid ? 'Paga ✅' : 'Pendente ⏳'}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveBill = (id: string) => {
    const target = bills.find(b => b.id === id);
    if (!target) return;
    const label = target.type === 'outros' && target.customTitle ? target.customTitle : getTypeName(target.type);

    setConfirmModal({
      isOpen: true,
      title: 'Excluir Conta',
      description: `Tem certeza de que deseja excluir a conta de "${label}" no valor de R$ ${target.value.toFixed(2)} da sua Nuvem?`,
      confirmText: 'Excluir',
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'bills', id));
          showNotification(`Conta de "${label}" excluída da Nuvem.`);
        } catch (err) {
          console.error(err);
          showNotification('Erro ao excluir conta.');
        }
      }
    });
  };

  const getTypeName = (type: BillType): string => {
    switch (type) {
      case 'agua': return 'Água';
      case 'energia': return 'Energia';
      case 'racao_gatos': return 'Ração dos Gatos';
      case 'racao_cachorro': return 'Ração do Cachorro';
      default: return 'Outros';
    }
  };

  const resetAllToDefaults = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Redefinir Banco de Dados',
      description: 'Deseja realmente apagar todas as contas e compras atuais para carregar os dados demonstrativos padrão de água, energia e mercado?',
      confirmText: 'Redefinir',
      type: 'warning',
      onConfirm: async () => {
        try {
          // Clear active items
          await Promise.all(shoppingItems.map(item => deleteDoc(doc(db, 'shopping_items', item.id))));
          await Promise.all(bills.map(bill => deleteDoc(doc(db, 'bills', bill.id))));

          // Push new mock items
          await Promise.all(INITIAL_SHOPPING_MOCK.map(item => setDoc(doc(db, 'shopping_items', item.id), item)));
          await Promise.all(INITIAL_BILLS_MOCK.map(bill => setDoc(doc(db, 'bills', bill.id), bill)));

          setSelectedMonth(CURRENT_MONTH_STR);
          showNotification('Nuvem redefinida para os dados padrão!');
        } catch (err) {
          console.error("Erro ao resetar dados: ", err);
          showNotification('Erro ao sincronizar redefinição na Nuvem.');
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] py-8 px-4 sm:px-6 lg:px-8 font-sans animate-fades transition-colors duration-200" id="main-layout-container">
      {/* Dynamic Toast notifications overlay bar */}
      {toastMessage && (
        <div className="fixed top-5 right-5 bg-slate-900 border border-slate-800 text-white py-3 px-4 rounded-2xl shadow-lg z-50 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Sparkles size={14} className="text-yellow-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main container */}
      <div className="max-w-7xl mx-auto space-y-8" id="dashboard-limits-enforcer">
        {/* Navigation & Cover Profile header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-card)] pb-8" id="app-general-header">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2 info-badge-indigo font-extrabold text-[10px] w-fit px-3 py-1 rounded-full uppercase tracking-widest shadow-2xs animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full indicator-ping opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 indicator-ping"></span>
                </span>
                <span>Assistente Lar em Ordem</span>
              </div>

              {dbSynced && (
                <div className="flex items-center gap-1.5 info-badge-emerald font-extrabold text-[10px] w-fit px-3 py-1 rounded-full uppercase tracking-widest shadow-2xs">
                  <Cloud size={11} className="text-current animate-pulse" />
                  <span>Nuvem Sincronizada</span>
                </div>
              )}
            </div>
            
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-[var(--text-main)] tracking-tight">
              Lista de Compras & Contas
            </h1>
            <p className="text-[var(--text-sub)] text-sm mt-1 font-bold">
              Organize suas contas e faça a lista de compras sem valores, sincronizado em tempo real na nuvem Firestore.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setTheme(curr => curr === 'dark' ? 'light' : 'dark')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl hover:bg-[var(--bg-input-hover)] transition-all cursor-pointer shadow-sm select-none"
              title={theme === 'dark' ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
            >
              {theme === 'dark' ? <Sun size={13} className="text-amber-500 animate-spin-slow" /> : <Moon size={13} className="text-indigo-400" />}
              <span>{theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
            </button>

            <button
              onClick={resetAllToDefaults}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-[var(--text-sub)] hover:text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl hover:bg-[var(--bg-input-hover)] transition-all cursor-pointer shadow-sm"
              title="Restaurar dados fictícios padrão para teste"
            >
              <RefreshCw size={12} />
              <span>Redefinir Dados</span>
            </button>
            
            <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-card)] text-[var(--text-main)] rounded-xl flex items-center gap-2 text-xs font-extrabold shadow-sm">
              <CalendarDays size={14} className="text-indigo-400" />
              <span>{INITIAL_DATE.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </header>

        {/* SECTION 1: Dynamic summaries widgets banner */}
        <DashboardOverview 
          bills={bills} 
          shoppingItems={shoppingItems} 
          currentMonth={selectedMonth} 
        />

        {/* SECTION 2: Grid view: Left list, Right tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="interactive-tools-grid">
          <div className="lg:col-span-6" id="column-shopping">
            <ShoppingList 
              items={shoppingItems.filter(item => !item.concluded)}
              currentMonth={selectedMonth}
              onAddItem={handleAddShoppingItem}
              onToggleItem={handleToggleShoppingItem}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveShoppingItem}
              onClearList={handleClearShoppingList}
              onMarkAllAsChecked={handleMarkAllShopping}
              onConcludePurchase={handleConcludePurchase}
            />
          </div>
          
          <div className="lg:col-span-6" id="column-bills">
            <BillsTracker 
              bills={bills}
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              onAddBill={handleAddBill}
              onToggleBillPaid={handleToggleBillStatus}
              onRemoveBill={handleRemoveBill}
            />
          </div>
        </div>

        {/* SECTION 3: Large Historical monthly SVG graph with Category Pie Chart */}
        <div id="column-analytics-chart">
          <MonthlyChart 
            bills={bills}
            currentMonth={selectedMonth}
            shoppingItems={shoppingItems}
          />
        </div>

        {/* Footer info badge */}
        <footer className="text-center text-slate-500 text-xs py-10 border-t border-[#1d274c]" id="global-credits-footer">
          <p className="font-semibold text-slate-400">Desenvolvido com foco em usabilidade e controle familiar rápido.</p>
          <div className="flex items-center justify-center gap-1.5 mt-2 justify-items-center">
            <Cloud size={11} className="text-indigo-400" />
            <span>Todos os dados são persistidos de forma segura no banco de dados persistente em nuvem do Firebase Firestore.</span>
          </div>
        </footer>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
