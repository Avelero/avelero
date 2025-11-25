'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ThemeConfig } from '@v1/dpp/types/theme-config';

interface PreviewMessage {
    type: 'THEME_CONFIG_UPDATE';
    payload: ThemeConfig;
}

interface UsePreviewMessengerOptions {
    config: ThemeConfig;
    targetOrigin: string;
}

export function usePreviewMessenger({ config, targetOrigin }: UsePreviewMessengerOptions) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const isReadyRef = useRef(false);

    // Send config to iframe
    const sendConfig = useCallback(() => {
        if (!iframeRef.current?.contentWindow) {
            console.warn('[Preview Messenger] iframe not ready');
            return;
        }

        const message: PreviewMessage = {
            type: 'THEME_CONFIG_UPDATE',
            payload: config,
        };

        iframeRef.current.contentWindow.postMessage(message, targetOrigin);
        console.log('[Preview Messenger] Sent config to iframe');
    }, [config, targetOrigin]);

    // Listen for iframe ready event
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== new URL(targetOrigin).origin) return;

            if (event.data?.type === 'PREVIEW_READY') {
                console.log('[Preview Messenger] iframe is ready');
                isReadyRef.current = true;
                sendConfig(); // Send initial config
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sendConfig, targetOrigin]);

    // Send config whenever it changes
    useEffect(() => {
        if (isReadyRef.current) {
            sendConfig();
        }
    }, [config, sendConfig]);

    // Send config on iframe load (backup)
    const handleIframeLoad = useCallback(() => {
        // Wait a bit for iframe to set up listeners
        setTimeout(() => {
            sendConfig();
        }, 100);
    }, [sendConfig]);

    return {
        iframeRef,
        handleIframeLoad,
    };
}
