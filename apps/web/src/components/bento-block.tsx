import { Icons } from "@v1/ui/icons";
import { Button } from "./button";

export function BentoBlock() {
    return (
        <div className="flex flex-col w-full py-[62px] gap-4 lg:gap-6">
            <div className="flex flex-row items-center justify-between">
                <h4 className="text-h5 text-foreground">Get compliant in days, not months</h4>
                <Button variant="brand">Talk to founders</Button>
            </div>
            
            <div className="grid grid-cols-1 gap-4 lg:gap-6 w-full lg:grid-rows-2 lg:auto-rows-fr">
                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
                    <div className="flex flex-col flex-1 bg-card border border-border">
                        <div className="flex flex-col gap-2 px-6 pt-6">
                            <h5 className="text-h6 text-foreground">Raw data uploads</h5>
                            <p className="text-small text-foreground/50">
                                Drag & drop Excel files, PDFs, or other article data — Avelero understands, transforms, and stores it so your DPPs are ready in days, not months.
                            </p>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="flex w-full h-40 border-2 border-dashed border-border items-center justify-center text-center text-body text-foreground/50">
                                <Icons.Upload className="w-6 h-6" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col flex-1 bg-card border border-border">
                        <div className="flex flex-col gap-2 px-6 pt-6">
                            <h5 className="text-h6 text-foreground">System integrations</h5>
                            <p className="text-small text-foreground/50">
                                Easily connect your existing systems with custom-built API integrations, keeping your product data up-to-date at all times.
                            </p>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="flex w-full h-40 border-2 border-dashed border-border items-center justify-center text-center text-body text-foreground/50">
                                <Icons.Upload className="w-6 h-6" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row bg-card border border-border w-full lg:gap-6">
                    <div className="flex flex-col gap-2 px-6 pt-6 lg:w-1/2">
                        <h5 className="text-h6 text-foreground">Data enrichment</h5>
                        <p className="text-small text-foreground/50">
                            Fill data gaps with Avelero AI – by leveraging data patterns, we detect and complete missing information in seconds.
                        </p>
                    </div>

                    <div className="flex items-center justify-center p-6 lg:w-1/2">
                        <div className="flex w-full h-40 border-2 border-dashed border-border items-center justify-center text-center text-body text-foreground/50">
                            <Icons.Upload className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}