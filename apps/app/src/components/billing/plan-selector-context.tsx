"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

interface PlanSelectorContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const PlanSelectorContext = createContext<PlanSelectorContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
});

export function PlanSelectorProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <PlanSelectorContext.Provider value={{ isOpen, open, close }}>
      {children}
    </PlanSelectorContext.Provider>
  );
}

export function usePlanSelector() {
  return useContext(PlanSelectorContext);
}
