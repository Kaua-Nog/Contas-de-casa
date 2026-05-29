import { useMemo } from 'react';
import { ShoppingItem } from '../types';

export interface ShoppingStats {
  totalCount: number;
  pendingCount: number;
  checkedCount: number;
}

export function useShoppingStats(shoppingItems: ShoppingItem[]): ShoppingStats {
  return useMemo(() => {
    const totalCount = shoppingItems.length;
    const pendingCount = shoppingItems.filter(item => !item.checked).length;
    const checkedCount = shoppingItems.filter(item => item.checked).length;

    return {
      totalCount,
      pendingCount,
      checkedCount
    };
  }, [shoppingItems]);
}
