'use client';

import { useContext } from 'react';
import { DesignContext } from '@/components/design/design-provider';

export function useDesignConfig() {
    const context = useContext(DesignContext);

    if (!context) {
        throw new Error('useDesignConfig must be used within DesignProvider');
    }

    return context;
}
