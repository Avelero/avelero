'use client';

import { useDesignConfig } from '@/hooks/use-design-config';
import { Label } from '@v1/ui/label';
import { cn } from '@v1/ui/cn';
import { useCallback, useEffect, useRef, useState } from 'react';

export function HeaderSection() {
    const { config, updateSection } = useDesignConfig();
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(
        config.branding.headerLogoUrl || null
    );
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Update preview when file changes
    useEffect(() => {
        if (imageFile) {
            const objectUrl = URL.createObjectURL(imageFile);
            setImagePreview(objectUrl);

            // TODO: Upload file and get URL, then update config
            // For now, just update with object URL (won't persist)
            updateSection('branding', {
                ...config.branding,
                headerLogoUrl: objectUrl,
            });

            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        }
    }, [imageFile, config.branding, updateSection]);

    const validateFile = (file: File): boolean => {
        const validTypes = ['image/png', 'image/svg+xml'];

        if (!validTypes.includes(file.type)) {
            setError('Please upload a PNG or SVG file');
            return false;
        }

        setError(null);
        return true;
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file && validateFile(file)) {
            setImageFile(file);
        }
    }, []);

    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file && validateFile(file)) {
                setImageFile(file);
            }
            // Clear input value so same file can be selected again
            e.target.value = '';
        },
        [],
    );

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    return (
        <div className="border border-border bg-background">
            <div className="p-4 flex flex-col gap-3">
            <p className="type-p !font-medium text-primary">Header</p>

            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "relative w-[200px] h-[40px] border border-dashed transition-colors duration-200 cursor-pointer",
                    isDragging
                        ? "border-brand bg-accent"
                        : "border-border hover:border-tertiary hover:bg-accent",
                    )}
                role="button"
                tabIndex={0}
                aria-label="Upload logo image"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick();
                    }
                }}
            >
                {imagePreview ? (
                    <img
                        src={imagePreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain p-3"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" x2="12" y1="3" y2="15" />
                        </svg>
                        <p className="text-xs text-center px-4">
                            Drop PNG or SVG here
                            <br />
                            or click to upload
                        </p>
                    </div>
                )}
                <input
                    ref={inputRef}
                    type="file"
                    accept=".png,.svg,image/png,image/svg+xml"
                    className="hidden"
                    onChange={handleFileSelect}
                />
            </div>

            {error && (
                <p className="text-sm text-destructive">{error}</p>
            )}

            {imageFile && (
                <p className="text-xs text-muted-foreground">
                    {imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)
                </p>
            )}
        </div>
    </div>
    );
}
