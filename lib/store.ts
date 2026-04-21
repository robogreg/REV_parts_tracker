import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, RevEvent, RevUser } from './types';

// ─── App State Store ──────────────────────────────────────────────────────────

interface AppState {
  user: RevUser | null;
  activeEvent: RevEvent | null;
  isOnline: boolean;
  pendingCount: number;
  setUser: (user: RevUser | null) => void;
  setActiveEvent: (event: RevEvent | null) => void;
  setIsOnline: (online: boolean) => void;
  setPendingCount: (count: number) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      activeEvent: null,
      isOnline: true,
      pendingCount: 0,
      setUser: (user) => set({ user }),
      setActiveEvent: (event) => set({ activeEvent: event }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setPendingCount: (pendingCount) => set({ pendingCount }),
    }),
    {
      name: 'rev-parts-app',
      partialize: (state) => ({
        activeEvent: state.activeEvent,
      }),
    }
  )
);

// ─── Cart Store ───────────────────────────────────────────────────────────────

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (partId: string) => void;
  updateQuantity: (partId: string, quantity: number) => void;
  toggleLoaner: (partId: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalUnits: number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) =>
        set((state) => {
          const existing = state.items.find((i) => i.part.id === newItem.part.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.part.id === newItem.part.id
                  ? { ...i, quantity: i.quantity + newItem.quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, newItem] };
        }),

      removeItem: (partId) =>
        set((state) => ({ items: state.items.filter((i) => i.part.id !== partId) })),

      updateQuantity: (partId, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.part.id !== partId)
              : state.items.map((i) => (i.part.id === partId ? { ...i, quantity } : i)),
        })),

      toggleLoaner: (partId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.part.id === partId ? { ...i, isLoaner: !i.isLoaner } : i
          ),
        })),

      clearCart: () => set({ items: [] }),

      get totalItems() {
        return get().items.length;
      },

      get totalUnits() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0);
      },
    }),
    {
      name: 'rev-parts-cart',
    }
  )
);
