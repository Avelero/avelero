'use client';

import { createContext, useState, type ReactNode } from 'react';
import type { ThemeConfig } from '@v1/dpp/types/theme-config';

interface DesignContextValue {
    config: ThemeConfig;
    updateConfig: (updater: (prev: ThemeConfig) => ThemeConfig) => void;
    updateSection: <K extends keyof ThemeConfig>(
        section: K,
        value: ThemeConfig[K]
    ) => void;
}

export const DesignContext = createContext<DesignContextValue | null>(null);

interface DesignProviderProps {
    children: ReactNode;
    initialConfig: ThemeConfig;
}

export function DesignProvider({ children, initialConfig }: DesignProviderProps) {
    const [config, setConfig] = useState(initialConfig);

    const updateConfig = (updater: (prev: ThemeConfig) => ThemeConfig) => {
        setConfig(updater);
    };

    const updateSection = <K extends keyof ThemeConfig>(
        section: K,
        value: ThemeConfig[K]
    ) => {
        setConfig((prev) => ({ ...prev, [section]: value }));
    };

    return (
        <DesignContext.Provider value={{ config, updateConfig, updateSection }}>
            {children}
        </DesignContext.Provider>
    );
}
