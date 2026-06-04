import React, { useState, useMemo } from 'react';
import { ShoppingItem } from '../types';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Check, 
  RotateCcw, 
  ShoppingCart, 
  Sparkles, 
  Search, 
  CheckSquare, 
  Square,
  DollarSign,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, writeBatch, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface ShoppingListProps {
  items: ShoppingItem[];
  currentMonth: string;
  onAddItem: (name: string, category: string, quantity: number, price?: number) => void;
  onToggleItem: (id: string) => void;
  onUpdateQuantity: (id: string, change: number) => void;
  onRemoveItem: (id: string) => void;
  onClearList: () => void;
  onMarkAllAsChecked: (checked: boolean) => void;
  onConcludePurchase: () => void;
  onConcludeReceipts?: () => void;
}

const CATEGORIES = [
  { id: 'Alimentos', label: 'Alimentos', color: 'badge-cat-alimentos' },
  { id: 'Bebidas', label: 'Bebidas', color: 'badge-cat-bebidas' },
  { id: 'Limpeza', label: 'Limpeza', color: 'badge-cat-limpeza' },
  { id: 'Higiene', label: 'Higiene', color: 'badge-cat-higiene' },
  { id: 'Outros', label: 'Outros', color: 'badge-cat-outros' }
];

const SUGGESTIONS = [
  { name: 'Arroz', category: 'Alimentos' },
  { name: 'Feijão', category: 'Alimentos' },
  { name: 'Leite', category: 'Alimentos' },
  { name: 'Pão', category: 'Alimentos' },
  { name: 'Café', category: 'Alimentos' },
  { name: 'Óleo', category: 'Alimentos' },
  { name: 'Ração Sachê', category: 'Alimentos' },
  { name: 'Papel Higiênico', category: 'Higiene' },
  { name: 'Detergente', category: 'Limpeza' },
  { name: 'Amaciante', category: 'Limpeza' },
  { name: 'Sabonete', category: 'Higiene' },
  { name: 'Creme Dental', category: 'Higiene' },
];

const ShoppingList = React.memo(function ShoppingList({
  items,
  currentMonth,
  onAddItem,
  onToggleItem,
  onUpdateQuantity,
  onRemoveItem,
  onClearList,
  onMarkAllAsChecked,
  onConcludePurchase,
  onConcludeReceipts
}: ShoppingListProps) {
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState('Alimentos');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'checked' | 'receipt'>('all');
  const [isGrouped, setIsGrouped] = useState(false);

  // Expanded Item State (Accordion Click on Name)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Batch Mode States
  const [batchMode, setBatchMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

  const toggleExpand = (id: string) => {
    setExpandedItemId(prev => prev === id ? null : id);
  };

  // Inline Item Editing States
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editNameText, setEditNameText] = useState('');

  const startEditing = (id: string, currentName: string) => {
    setEditingItemId(id);
    setEditNameText(currentName);
  };

  const saveItemName = async (id: string) => {
    if (!editNameText.trim()) {
      cancelEditing();
      return;
    }
    try {
      const itemRef = doc(db, 'shopping_items', id);
      await updateDoc(itemRef, { name: editNameText.trim() });
      setEditingItemId(null);
    } catch (error) {
      console.error("Erro ao atualizar nome do item", error);
    }
  };

  const cancelEditing = () => {
    setEditingItemId(null);
  };

  const handleBatchToggleChecked = async (checkedState: boolean) => {
    if (selectedItemIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      const todayStr = new Date().toISOString().split('T')[0];
      selectedItemIds.forEach(id => {
        const itemRef = doc(db, 'shopping_items', id);
        batch.update(itemRef, {
          checked: checkedState,
          date: checkedState ? todayStr : ''
        });
      });
      await batch.commit();
      setSelectedItemIds([]);
      setBatchMode(false);
    } catch (error) {
      console.error("Erro ao atualizar lote", error);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedItemIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedItemIds.forEach(id => {
        const itemRef = doc(db, 'shopping_items', id);
        batch.delete(itemRef);
      });
      await batch.commit();
      setSelectedItemIds([]);
      setBatchMode(false);
      setShowBatchDeleteConfirm(false);
    } catch (error) {
      console.error("Erro ao deletar lote", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const parsedPrice = newItemPrice ? parseFloat(newItemPrice.replace(',', '.')) : 0;
    
    onAddItem(newItemName.trim(), selectedCategory, newItemQty, isNaN(parsedPrice) ? 0 : parsedPrice);
    setNewItemName('');
    setNewItemQty(1);
    setNewItemPrice('');
  };

  const handleQuickAdd = (name: string, category: string) => {
    // Check if item already exists to increment quantity
    const existing = items.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.checked);
    if (existing) {
      onUpdateQuantity(existing.id, 1);
    } else {
      onAddItem(name, category, 1);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // 1. Filter by search text
      const matchesSearch = item.name.toLowerCase().includes(searchFilter.toLowerCase());
      if (!matchesSearch) return false;

      // 2. Filter by status tab
      if (activeTab === 'pending') {
        if (item.checked || item.source === 'receipt') return false;
      }
      if (activeTab === 'checked') {
        if (!item.checked || item.source === 'receipt') return false;
      }
      if (activeTab === 'receipt') {
        if (item.source !== 'receipt') return false;
      }

      return true;
    });
  }, [items, searchFilter, activeTab]);

  return (
    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-card)] shadow-sm hover:shadow-[0_0_25px_rgba(99,102,241,0.12)] hover:border-indigo-500/30 overflow-hidden h-full flex flex-col transition-all duration-300 hover:scale-[1.002]" id="shopping-list-card">
      {/* Header section */}
      <div className="p-6 border-b border-[var(--border-card)] bg-[var(--bg-card)]" id="shopping-list-header">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shadow-xs">
              <ShoppingCart size={20} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[var(--text-main)]">Lista de Compras</h2>
              <p className="text-xs text-[var(--text-sub)] font-bold">Adicione os itens do mercado e colabore em tempo real</p>
            </div>
          </div>
          <span className="text-xs px-2.5 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-extrabold rounded-md uppercase">
            {filteredItems.filter(i => i.checked).length}/{filteredItems.length} itens
          </span>
        </div>

        {/* Form add item */}
        <form onSubmit={handleSubmit} className="space-y-3" id="shopping-add-form">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4 relative">
              <input
                type="text"
                placeholder="Ex: Arroz, Leite, Detergente..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                maxLength={50}
                className="w-full pl-4 pr-3 py-3 rounded-xl border border-[var(--border-input)] bg-[var(--bg-input)] shadow-xs focus:outline-hidden text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-3 text-sm bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-[var(--text-body)] font-medium"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id} className="bg-[var(--bg-card)] text-[var(--text-body)]">{cat.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder="R$ 0,00"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-[var(--border-input)] bg-[var(--bg-input)] shadow-xs focus:outline-hidden text-sm text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50 focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
            <div className="sm:col-span-2 flex items-center bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl px-1 py-1 h-12 shadow-xs">
              <button
                type="button"
                onClick={() => setNewItemQty(prev => Math.max(1, prev - 1))}
                className="p-2 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-input-hover)]/60 active:bg-[var(--bg-input-hover)] transition-colors cursor-pointer select-none"
                title="Diminuir quantidade"
              >
                <Minus size={11} strokeWidth={2.5} />
              </button>
              <input
                type="number"
                min="1"
                max="999"
                value={newItemQty}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setNewItemQty(isNaN(val) ? 1 : Math.max(1, val));
                }}
                className="w-full bg-transparent text-center text-xs font-mono font-bold text-[var(--text-body)] focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Quantidade do item"
              />
              <button
                type="button"
                onClick={() => setNewItemQty(prev => prev + 1)}
                className="p-2 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--bg-input-hover)]/60 active:bg-[var(--bg-input-hover)] transition-colors cursor-pointer select-none"
                title="Aumentar quantidade"
              >
                <Plus size={11} strokeWidth={2.5} />
              </button>
            </div>
            <button
              type="submit"
              className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </div>
        </form>
      </div>

      {/* Suggested quick items */}
      <div className="px-6 py-3 border-b border-[var(--border-card)] bg-[var(--bg-card)]" id="shopping-suggestions">
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={13} className="text-yellow-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-sub)]">Adicionar Rápido</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-[72px] overflow-y-auto pr-1">
          {SUGGESTIONS.map(sug => {
            const isAlreadyAdded = items.some(item => item.name.toLowerCase() === sug.name.toLowerCase() && !item.checked);
            return (
              <button
                key={sug.name}
                type="button"
                onClick={() => handleQuickAdd(sug.name, sug.category)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all cursor-pointer flex items-center gap-1 ${
                  isAlreadyAdded 
                  ? 'quick-add-added hover:bg-indigo-500/25' 
                  : 'bg-[var(--bg-input)] border-[var(--border-input)] hover:border-slate-500 hover:bg-[var(--bg-input-hover)] text-[var(--text-sub)]'
                }`}
              >
                <span>{sug.name}</span>
                {isAlreadyAdded && <span className="text-[9px] quick-add-num px-1 w-fit rounded-md font-mono">+{items.find(i => i.name.toLowerCase() === sug.name.toLowerCase() && !i.checked)?.quantity}</span>}
              </button>
            );
          })}
        </div>
      </div>



      {/* Filter and search actions */}
      <div className="px-6 py-4 border-b border-[var(--border-card)] bg-[var(--bg-card)] flex flex-col sm:flex-row sm:items-center justify-between gap-3" id="shopping-filters">
        <div className="relative max-w-xs w-full">
          <Search size={14} className="absolute left-3 top-3 text-[var(--text-sub)]" />
          <input
            type="text"
            placeholder="Filtrar ou pesquisar..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[var(--bg-input)] border border-[var(--border-input)] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-[var(--bg-input)] text-[var(--text-main)] placeholder:text-[var(--text-sub)]/50 transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lote Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setBatchMode(prev => !prev);
              setSelectedItemIds([]);
              setShowBatchDeleteConfirm(false);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              batchMode 
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                : 'bg-[var(--bg-input)] text-[var(--text-sub)] border-[var(--border-input)] hover:text-[var(--text-main)] hover:border-slate-500'
            }`}
            title="Ativar/Desativar seleção em lote"
          >
            <CheckSquare size={13} />
            <span>{batchMode ? 'Sair do Lote' : 'Seleção em Lote'}</span>
          </button>

          {/* Grouping Toggle Button */}
          <button
            type="button"
            onClick={() => setIsGrouped(prev => !prev)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              isGrouped 
                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600/20'
                : 'bg-[var(--bg-input)] text-[var(--text-sub)] border-[var(--border-input)] hover:text-[var(--text-main)] hover:border-slate-500'
            }`}
            title="Agrupar itens por categoria"
            id="shopping-group-btn"
          >
            <Layers size={13} />
            <span>{isGrouped ? 'Lista Plana' : 'Agrupar por Categoria'}</span>
          </button>

          <div className="flex items-center gap-1.5 bg-[var(--bg-input)] p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'all' 
                  ? 'bg-[var(--bg-input-hover)] text-[var(--text-main)] shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input-hover)]/40'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'pending' 
                  ? 'bg-amber-500 text-white shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input-hover)]/40'
              }`}
            >
              Faltando
            </button>
            <button
              onClick={() => setActiveTab('checked')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'checked' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input-hover)]/40'
              }`}
            >
              No Carrinho
            </button>
            <button
              onClick={() => setActiveTab('receipt')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'receipt' 
                  ? 'bg-blue-600 text-white shadow-xs' 
                  : 'text-[var(--text-sub)] hover:text-[var(--text-body)] hover:bg-[var(--bg-input-hover)]/40'
              }`}
            >
              Cupom Fiscal
            </button>
          </div>
        </div>
      </div>

      {/* Batch toolbar */}
      <AnimatePresence>
        {batchMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 py-3 border-b border-amber-500/10 bg-amber-500/5 flex flex-wrap items-center justify-between gap-3 overflow-hidden"
            id="shopping-batch-actions-bar"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-500 font-mono">
                {selectedItemIds.length} selecionado(s)
              </span>
              <button
                type="button"
                onClick={() => {
                  const allVisibleIds = filteredItems.map(i => i.id);
                  const isAllSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedItemIds.includes(id));
                  if (isAllSelected) {
                    setSelectedItemIds([]);
                  } else {
                    setSelectedItemIds(allVisibleIds);
                  }
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer underline underline-offset-2 bg-transparent border-0 p-0"
              >
                {filteredItems.length > 0 && filteredItems.every(item => selectedItemIds.includes(item.id)) ? "Desmarcar Todos" : "Selecionar Todos"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {!showBatchDeleteConfirm ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleBatchToggleChecked(true)}
                    disabled={selectedItemIds.length === 0}
                    className="px-3 py-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all cursor-pointer disabled:opacity-40"
                  >
                    No Carrinho
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchToggleChecked(false)}
                    disabled={selectedItemIds.length === 0}
                    className="px-3 py-1.5 text-[11px] font-bold text-[var(--text-body)] bg-[var(--bg-input)] border border-[var(--border-input)] hover:bg-[var(--bg-input-hover)] rounded-lg transition-all cursor-pointer disabled:opacity-40"
                  >
                    Pendente
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBatchDeleteConfirm(true)}
                    disabled={selectedItemIds.length === 0}
                    className="px-3 py-1.5 text-[11px] font-bold text-white bg-red-650 hover:bg-red-700 rounded-lg transition-all cursor-pointer disabled:opacity-40 flex items-center gap-1"
                  >
                    <Trash2 size={11} />
                    <span>Excluir</span>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2 bg-red-950/20 px-2.5 py-1 rounded-lg border border-red-500/20">
                  <span className="text-[11px] font-bold text-red-400">Excluir {selectedItemIds.length} item(ns)?</span>
                  <button
                    type="button"
                    onClick={handleBatchDelete}
                    className="text-[11px] font-extrabold text-red-500 hover:text-red-400 cursor-pointer underline bg-transparent border-0 p-0"
                  >
                    Sim
                  </button>
                  <span className="text-[11px] text-zinc-500">|</span>
                  <button
                    type="button"
                    onClick={() => setShowBatchDeleteConfirm(false)}
                    className="text-[11px] font-bold text-zinc-400 hover:text-zinc-300 cursor-pointer underline bg-transparent border-0 p-0"
                  >
                    Não
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Items Listing */}
      <div className="flex-1 overflow-y-auto p-6 min-h-[250px] max-h-[420px]" id="shopping-items-list">
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <ShoppingCart size={40} className="stroke-1 text-slate-300 mb-2" />
            <p className="text-sm font-medium">Nenhum item encontrado</p>
            <p className="text-xs text-slate-400">Adicione novos itens no campo acima</p>
          </div>
        ) : (
          <div className="space-y-4">
            {isGrouped ? (
              CATEGORIES.map(cat => {
                const catItems = filteredItems.filter(item => {
                  const itemCat = (item.category || '').trim().toLowerCase();
                  if (cat.id.toLowerCase() === 'outros') {
                    const knownCatIds = CATEGORIES.slice(0, 4).map(c => c.id.toLowerCase());
                    return itemCat === 'outros' || !knownCatIds.includes(itemCat);
                  }
                  return itemCat === cat.id.toLowerCase();
                });
                if (catItems.length === 0) return null;
                return (
                  <div key={cat.id} className="space-y-2 first:mt-0 mt-4">
                    <div className="flex items-center gap-2 px-1 py-1 bg-[var(--bg-card)] sticky top-0 z-10">
                      <span className="text-[10px] uppercase font-mono font-bold text-indigo-400 tracking-wider">
                        {cat.label}
                      </span>
                      <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-full font-bold">
                        {catItems.length}
                      </span>
                      <div className="flex-1 h-px bg-[var(--border-card)]" />
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence initial={false}>
                        {catItems.map(item => {
                          const categoryConfig = CATEGORIES.find(c => c.id.toLowerCase() === (item.category || '').trim().toLowerCase()) || CATEGORIES[4];
                          return (
                            <motion.div
                              key={item.id}
                              layoutId={`shopping-${item.id}`}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ duration: 0.15 }}
                              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                item.checked 
                                  ? 'bg-[var(--bg-input)]/20 border-[var(--border-card)]/50 opacity-60' 
                                  : 'bg-[var(--bg-input)] border-[var(--border-input)] shadow-2xs hover:border-slate-650'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Batch Selection Checkbox */}
                                {batchMode && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedItemIds(prev => {
                                        if (prev.includes(item.id)) {
                                          return prev.filter(id => id !== item.id);
                                        } else {
                                          return [...prev, item.id];
                                        }
                                      });
                                    }}
                                    className={`mr-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                      selectedItemIds.includes(item.id)
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                                        : 'border-amber-500/40 hover:border-amber-500 bg-[var(--bg-card)]'
                                    }`}
                                  >
                                    <div className={`w-2 h-2 rounded-xs bg-white transition-all transform ${selectedItemIds.includes(item.id) ? 'scale-100 rotate-0' : 'scale-0 rotate-45'}`} />
                                  </button>
                                )}

                                {/* Check button icon */}
                                <button
                                  type="button"
                                  onClick={() => onToggleItem(item.id)}
                                  className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                    item.checked 
                                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                                      : 'border-[var(--border-input)] hover:border-indigo-500 text-transparent hover:text-indigo-200 bg-[var(--bg-card)]'
                                  }`}
                                >
                                  <Check size={12} strokeWidth={3} className={item.checked ? 'block' : 'opacity-0 hover:opacity-100 text-indigo-400'} />
                                </button>

                                <div className="min-w-0 pr-2 flex-1">
                                  {editingItemId === item.id ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        saveItemName(item.id);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-full py-0.5"
                                    >
                                      <input
                                        type="text"
                                        value={editNameText}
                                        onChange={(e) => setEditNameText(e.target.value)}
                                        onBlur={() => saveItemName(item.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') cancelEditing();
                                        }}
                                        className="w-full bg-[var(--bg-input-hover)] text-[var(--text-main)] text-sm font-semibold px-2 py-1 border border-indigo-500 rounded-md focus:outline-none"
                                        autoFocus
                                      />
                                    </form>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpand(item.id)}
                                      onDoubleClick={() => startEditing(item.id, item.name)}
                                      className="text-left w-full focus:outline-hidden group/itemname cursor-pointer py-0.5"
                                      title="Dois cliques para editar nome, um clique para ver ou ocultar detalhes"
                                    >
                                      <span className={`text-sm font-semibold break-words inline-flex items-center gap-1.5 transition-colors ${item.checked ? 'line-through text-[var(--text-sub)]' : 'text-[var(--text-body)] hover:text-indigo-400'}`}>
                                        <span>{item.name}</span>
                                        <span className="text-[9px] text-indigo-400/65 font-bold">
                                          {expandedItemId === item.id ? '▲' : '▼'}
                                        </span>
                                      </span>
                                    </button>
                                  )}
                                  
                                  <AnimatePresence initial={false}>
                                    {expandedItemId === item.id && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden mt-1.5 flex flex-wrap items-center gap-1.5"
                                      >
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${categoryConfig.color}`}>
                                          {categoryConfig.label}
                                        </span>
                                        {item.date && (
                                          <span className="text-[9px] text-[var(--text-sub)]/80 font-mono font-semibold flex items-center gap-0.5 bg-[var(--bg-card)] px-1.5 py-0.5 rounded-xs border border-[var(--border-card)]">
                                            🗓️ {(() => {
                                              try {
                                                const [year, month, day] = item.date.split('-');
                                                return `${day}/${month}/${year}`;
                                              } catch {
                                                return item.date;
                                              }
                                            })()}
                                          </span>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>

                              {/* Quantity controls & Delete */}
                              <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                                {item.price ? (
                                  <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                                    {item.quantity && item.quantity > 1 ? `${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')} = R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}` : `R$ ${item.price.toFixed(2).replace('.', ',')}`}
                                  </span>
                                ) : null}
                                {/* Quantity counters */}
                                <div className="flex items-center border border-[var(--border-input)] rounded-lg p-0.5 bg-[var(--bg-card)]">
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(item.id, -1)}
                                    className="p-1 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-md hover:bg-[var(--bg-input)] active:bg-[var(--bg-input)] transition-colors disabled:opacity-40 cursor-pointer"
                                    disabled={item.quantity <= 1}
                                  >
                                    <Minus size={11} strokeWidth={2.5} />
                                  </button>
                                  <span className="px-2 text-xs font-mono font-bold text-[var(--text-body)] select-none min-w-5 text-center">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onUpdateQuantity(item.id, 1)}
                                    className="p-1 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-md hover:bg-[var(--bg-input)] active:bg-[var(--bg-input)] transition-colors cursor-pointer"
                                  >
                                    <Plus size={11} strokeWidth={2.5} />
                                  </button>
                                </div>

                                {/* Remove item button */}
                                <button
                                  type="button"
                                  onClick={() => onRemoveItem(item.id)}
                                  className="p-1.5 text-slate-450 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                                  title="Excluir item"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="space-y-2">
                <AnimatePresence initial={false}>
                  {filteredItems.map(item => {
                    const categoryConfig = CATEGORIES.find(c => c.id.toLowerCase() === (item.category || '').trim().toLowerCase()) || CATEGORIES[4];
                    return (
                      <motion.div
                        key={item.id}
                        layoutId={`shopping-${item.id}`}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                          item.checked 
                            ? 'bg-[var(--bg-input)]/20 border-[var(--border-card)]/50 opacity-60' 
                            : 'bg-[var(--bg-input)] border-[var(--border-input)] shadow-2xs hover:border-slate-650'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Batch Selection Checkbox */}
                          {batchMode && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemIds(prev => {
                                  if (prev.includes(item.id)) {
                                    return prev.filter(id => id !== item.id);
                                  } else {
                                    return [...prev, item.id];
                                  }
                                });
                              }}
                              className={`mr-0.5 flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                selectedItemIds.includes(item.id)
                                  ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                                  : 'border-amber-500/40 hover:border-amber-500 bg-[var(--bg-card)]'
                              }`}
                            >
                              <div className={`w-2 h-2 rounded-xs bg-white transition-all transform ${selectedItemIds.includes(item.id) ? 'scale-100 rotate-0' : 'scale-0 rotate-45'}`} />
                            </button>
                          )}

                          {/* Check button icon */}
                          <button
                            type="button"
                            onClick={() => onToggleItem(item.id)}
                            className={`flex-shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                              item.checked 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'border-[var(--border-input)] hover:border-indigo-500 text-transparent hover:text-indigo-200 bg-[var(--bg-card)]'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} className={item.checked ? 'block' : 'opacity-0 hover:opacity-100 text-indigo-400'} />
                          </button>

                          <div className="min-w-0 pr-2 flex-1">
                            {editingItemId === item.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  saveItemName(item.id);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full py-0.5"
                              >
                                <input
                                  type="text"
                                  value={editNameText}
                                  onChange={(e) => setEditNameText(e.target.value)}
                                  onBlur={() => saveItemName(item.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  className="w-full bg-[var(--bg-input-hover)] text-[var(--text-main)] text-sm font-semibold px-2 py-1 border border-indigo-500 rounded-md focus:outline-none"
                                  autoFocus
                                />
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleExpand(item.id)}
                                onDoubleClick={() => startEditing(item.id, item.name)}
                                className="text-left w-full focus:outline-hidden group/itemname cursor-pointer py-0.5"
                                title="Dois cliques para editar nome, um clique para ver ou ocultar detalhes"
                              >
                                <span className={`text-sm font-semibold break-words inline-flex items-center gap-1.5 transition-colors ${item.checked ? 'line-through text-[var(--text-sub)]' : 'text-[var(--text-body)] hover:text-indigo-400'}`}>
                                  <span>{item.name}</span>
                                  <span className="text-[9px] text-indigo-400/65 font-bold">
                                    {expandedItemId === item.id ? '▲' : '▼'}
                                  </span>
                                </span>
                              </button>
                            )}
                            
                            <AnimatePresence initial={false}>
                              {expandedItemId === item.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden mt-1.5 flex flex-wrap items-center gap-1.5"
                                >
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-sm font-medium ${categoryConfig.color}`}>
                                    {categoryConfig.label}
                                  </span>
                                  {item.date && (
                                    <span className="text-[9px] text-[var(--text-sub)]/80 font-mono font-semibold flex items-center gap-0.5 bg-[var(--bg-card)] px-1.5 py-0.5 rounded-xs border border-[var(--border-card)]">
                                      🗓️ {(() => {
                                        try {
                                          const [year, month, day] = item.date.split('-');
                                          return `${day}/${month}/${year}`;
                                        } catch {
                                          return item.date;
                                        }
                                      })()}
                                    </span>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        {/* Quantity controls & Delete */}
                        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                          {item.price ? (
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm whitespace-nowrap">
                              {item.quantity && item.quantity > 1 ? `${item.quantity}x R$ ${item.price.toFixed(2).replace('.', ',')} = R$ ${(item.price * item.quantity).toFixed(2).replace('.', ',')}` : `R$ ${item.price.toFixed(2).replace('.', ',')}`}
                            </span>
                          ) : null}
                          {/* Quantity counters */}
                          <div className="flex items-center border border-[var(--border-input)] rounded-lg p-0.5 bg-[var(--bg-card)]">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="p-1 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-md hover:bg-[var(--bg-input)] active:bg-[var(--bg-input)] transition-colors disabled:opacity-40 cursor-pointer"
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={11} strokeWidth={2.5} />
                            </button>
                            <span className="px-2 text-xs font-mono font-bold text-[var(--text-body)] select-none min-w-5 text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="p-1 text-[var(--text-sub)] hover:text-[var(--text-main)] rounded-md hover:bg-[var(--bg-input)] active:bg-[var(--bg-input)] transition-colors cursor-pointer"
                            >
                              <Plus size={11} strokeWidth={2.5} />
                            </button>
                          </div>

                          {/* Remove item button */}
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="p-1.5 text-slate-450 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors cursor-pointer"
                            title="Excluir item"
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
            
            {/* Action card with "Concluir Compra" at the end of checked list */}
            {activeTab === 'checked' && filteredItems.length > 0 && (
              <div className="mt-5 p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] font-bold text-emerald-400 text-center tracking-wide uppercase">
                  Pronto para finalizar? Você tem {filteredItems.length} item(ns) no carrinho.
                </p>
                <button
                  type="button"
                  onClick={onConcludePurchase}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-850 rounded-xl transition-all shadow-md cursor-pointer uppercase tracking-wider"
                >
                  <ShoppingCart size={13} className="animate-bounce" />
                  Concluir Compra
                </button>
              </div>
            )}

            {/* Action card with "Confirmar Cupom" at the end of receipt list */}
            {activeTab === 'receipt' && filteredItems.length > 0 && onConcludeReceipts && (
              <div className="mt-5 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex flex-col items-center justify-center gap-2">
                <p className="text-[11px] font-bold text-blue-400 text-center tracking-wide uppercase">
                  Pronto para confirmar o cupom? Você tem {filteredItems.length} item(ns) pendentes.
                </p>
                <button
                  type="button"
                  onClick={onConcludeReceipts}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-md cursor-pointer uppercase tracking-wider"
                >
                  <ShoppingCart size={13} className="animate-bounce" />
                  Confirmar Cupom
                </button>
              </div>
            )}
          </div>
        )}
      </div>

       {/* Footer Totals */}
      <div className="p-4 border-t border-[var(--border-card)] bg-[var(--bg-card)]" id="shopping-totals-footer">
        <div className="mb-3 p-3 bg-[var(--bg-input)] rounded-xl border border-[var(--border-card)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-sub)]">Checklist da Seleção</span>
            <span className="text-xs font-extrabold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-md">
              {filteredItems.filter(i => i.checked).length} de {filteredItems.length} itens
            </span>
          </div>
          {(() => {
             const itemsWithPrice = filteredItems.filter(i => (i.price || 0) > 0);
             if (itemsWithPrice.length > 0) {
               const totalVal = filteredItems.reduce((acc, i) => acc + ((i.price || 0) * (i.quantity || 1)), 0);
               return (
                 <div className="flex items-center justify-between mt-1 pt-2 border-t border-[var(--border-card)] border-dashed">
                    <span className="text-xs font-bold text-[var(--text-sub)]">Valor Total (estimado):</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-500">
                      R$ {totalVal.toFixed(2).replace('.', ',')}
                    </span>
                 </div>
               );
             }
             return null;
          })()}
        </div>

        <div className="flex flex-col gap-2">
          {activeTab === 'checked' && filteredItems.length > 0 && (
            <button
              onClick={onConcludePurchase}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-md cursor-pointer mb-1 uppercase tracking-wider"
              id="shopping-conclude-btn-footer"
            >
              <ShoppingCart size={14} className="animate-bounce" />
              Concluir Compra
            </button>
          )}

          {activeTab === 'receipt' && filteredItems.length > 0 && onConcludeReceipts && (
            <button
              onClick={onConcludeReceipts}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-md cursor-pointer mb-1 uppercase tracking-wider"
            >
              <ShoppingCart size={14} className="animate-bounce" />
              Confirmar Cupom
            </button>
          )}

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => onClearList()}
              disabled={items.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-body)] hover:text-red-400 hover:bg-red-550/10 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] transition-colors cursor-pointer disabled:opacity-40"
            >
              <RotateCcw size={12} />
              Limpar Lista
            </button>
            
            <button
              onClick={() => onMarkAllAsChecked(true)}
              disabled={items.length === 0 || items.every(i => i.checked)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
            >
              <CheckSquare size={12} />
              Marcar Todos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ShoppingList;
