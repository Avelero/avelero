"use client";

import { cn } from "@v1/ui/cn";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useState } from "react";

type IntegrationMode = "primary" | "secondary";

interface StepModeProps {
    existingPrimaryName: string | null;
    onNext: (isPrimary: boolean) => void;
}

/**
 * Step 1: Choose Primary or Secondary mode.
 * Primary creates products and defines structure.
 * Secondary enriches existing products.
 */
export function StepMode({ existingPrimaryName, onNext }: StepModeProps) {
    const hasPrimary = !!existingPrimaryName;
    // Default to primary if no existing primary, otherwise secondary
    const [selected, setSelected] = useState<IntegrationMode>(
        hasPrimary ? "secondary" : "primary"
    );

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="space-y-2">
                <h5 className="type-h5 text-foreground">Choose integration mode</h5>
                <p className="type-p text-secondary">
                    Select how this integration will interact with your product catalog.
                </p>
            </div>

            {/* Mode selection cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Primary option */}
                <button
                    type="button"
                    onClick={() => !hasPrimary && setSelected("primary")}
                    disabled={hasPrimary}
                    className={cn(
                        "relative flex flex-col gap-3 p-5 border text-left transition-all duration-100",
                        hasPrimary
                            ? "border-border bg-muted cursor-not-allowed opacity-50"
                            : selected === "primary"
                                ? "border-foreground bg-accent-light cursor-pointer"
                                : "border-border hover:bg-accent-light cursor-pointer"
                    )}
                >
                    <Icons.Crown
                        className={cn(
                            "h-6 w-6",
                            hasPrimary ? "text-muted-foreground" : "text-foreground"
                        )}
                    />
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center">
                            <span
                                className={cn(
                                    "type-p !font-medium",
                                    hasPrimary ? "text-muted-foreground" : "text-foreground"
                                )}
                            >
                                Primary
                            </span>
                            {!hasPrimary && (
                                <span className="ml-1 inline-flex items-center rounded-full border border-border bg-background px-2 text-[10px] leading-[21px]">
                                    Recommended
                                </span>
                            )}
                        </div>
                        <p
                            className={cn(
                                "type-small",
                                hasPrimary ? "text-muted-foreground" : "text-secondary"
                            )}
                        >
                            A primary integration creates products and populates selected fields.
                        </p>
                    </div>
                    {hasPrimary && (
                        <div className="flex items-center gap-2 mt-2 p-3 bg-muted">
                            <Icons.Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <p className="type-small text-muted-foreground">
                                <span className="font-medium">{existingPrimaryName}</span> is already
                                the primary integration.
                            </p>
                        </div>
                    )}
                </button>

                {/* Secondary option */}
                <button
                    type="button"
                    onClick={() => setSelected("secondary")}
                    className={cn(
                        "relative flex flex-col gap-3 p-5 border text-left transition-all duration-100 cursor-pointer",
                        selected === "secondary"
                            ? "border-foreground bg-accent-light"
                            : "border-border hover:bg-accent-light"
                    )}
                >
                    <Icons.LayoutGrid className="h-6 w-6 text-foreground" />
                    <div className="flex flex-col gap-2">
                        <span className="type-p !font-medium text-foreground">Secondary</span>
                        <p className="type-small text-secondary">
                            A secondary integration enriches existing products. It does not create products.
                        </p>
                    </div>
                </button>
            </div>

            {/* Action button - only Next, no Back for step 1 */}
            <div className="flex justify-end">
                <Button variant="default" onClick={() => onNext(selected === "primary")}>
                    Next
                </Button>
            </div>
        </div>
    );
}