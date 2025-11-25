'use client';

import { useDesignConfig } from '@/hooks/use-design-config';
import { usePreviewMessenger } from '@/hooks/use-preview-messenger';
import { useEffect, useRef, useState } from 'react';

// iPhone 14 Pro dimensions
const DEVICE_WIDTH = 393;
const DEVICE_HEIGHT = 852;

function getPreviewUrl() {
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3002/preview';
    }
    return 'https://dpp.avelero.com/preview';
}

export function PreviewFrame() {
    const { config } = useDesignConfig();
    const previewUrl = getPreviewUrl();
    const { iframeRef, handleIframeLoad } = usePreviewMessenger({
        config,
        targetOrigin: previewUrl,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        const updateZoom = () => {
            if (!containerRef.current) return;

            const containerHeight = containerRef.current.clientHeight;
            const calculatedZoom = containerHeight / DEVICE_HEIGHT;
            setZoom(calculatedZoom);
        };

        updateZoom();

        const resizeObserver = new ResizeObserver(updateZoom);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="h-full mx-auto"
            style={{
                aspectRatio: `${DEVICE_WIDTH} / ${DEVICE_HEIGHT}`,
                maxHeight: '852px',
            }}
        >
            <iframe
                ref={iframeRef}
                src={previewUrl}
                onLoad={handleIframeLoad}
                className="border border-border rounded-2xl"
                style={{
                    width: `${DEVICE_WIDTH}px`,
                    height: `${DEVICE_HEIGHT}px`,
                    zoom: zoom,
                }}
                title="Passport Preview"
                sandbox="allow-scripts allow-same-origin"
            />
        </div>
    );
}
