"use client";

import { Button } from "@v1/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@v1/ui/tabs";
import { CheckCircle, Info, FileDown } from "lucide-react";
import { toast } from "sonner";

// CSV template columns matching the backend expectations
const TEMPLATE_COLUMNS = [
  "product_name",
  "upid",
  "sku",
  "description",
  "category_name",
  "season",
  "primary_image_url",
  "color_name",
  "size_name",
  "product_image_url",
  "material_1_name",
  "material_1_percentage",
  "material_2_name",
  "material_2_percentage",
  "material_3_name",
  "material_3_percentage",
  "care_codes",
  "eco_claims",
  "environment_score",
];

export function CSVRequirementsSection() {
  const handleDownloadTemplate = () => {
    try {
      // Generate CSV content
      const csvContent = `${TEMPLATE_COLUMNS.join(",")}\n`;

      // Create blob from CSV content
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);

      // Create temporary download link and trigger download
      const a = document.createElement("a");
      a.href = url;
      a.download = "product-import-template.csv";
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Template download error:", error);
      toast.error("Failed to download template");
    }
  };

  return (
    <div className="mt-6 border border-border rounded-lg overflow-hidden">
      <Tabs defaultValue="required" className="w-full">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b bg-background">
          <TabsTrigger value="required" className="text-foreground">
            Upload Details
          </TabsTrigger>
          <TabsTrigger value="template" className="gap-2 text-foreground">
            Template
          </TabsTrigger>
        </TabsList>

        {/* Required Columns Tab */}
        <TabsContent value="required" className="p-6 space-y-6 m-0">
          {/* Required Columns */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="h-4 w-4 text-brand" />
              <h4 className="text-sm font-semibold text-foreground">
                Required Columns
              </h4>
            </div>
            <div className="space-y-3 pl-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand flex-shrink-0" />
                <div className="flex-1">
                  <code className="text-xs bg-brand/10 text-brand px-2 py-1 rounded font-mono">
                    product_name
                  </code>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Name of the product
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-xs bg-brand/10 text-brand px-2 py-1 rounded font-mono">
                      upid
                    </code>
                    <span className="text-xs text-gray-500">OR</span>
                    <code className="text-xs bg-brand/10 text-brand px-2 py-1 rounded font-mono">
                      sku
                    </code>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Unique product identifier
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Optional Columns */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-4 w-4 text-gray-500" />
              <h4 className="text-sm font-semibold text-foreground">
                Optional Columns
              </h4>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                description
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                category_name
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                season
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                primary_image_url
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                color_name
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                size_name
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                material_1_name
              </code>
              <code className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                material_1_percentage
              </code>
              <span className="text-xs text-gray-500 self-center">
                and more...
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Download Template Tab */}
        <TabsContent value="template" className="p-6 m-0">
          <div className="flex flex-col items-center justify-center py-8 space-y-6">
            <div className="text-center space-y-2">
              <FileDown className="h-12 w-12 text-brand mx-auto mb-4" />
              <h4 className="text-base font-semibold text-foreground">
                Download CSV Template
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                Get a pre-formatted CSV template with all the correct column
                headers to make importing your products easier.
              </p>
            </div>

            <Button
              variant="brand"
              size="default"
              onClick={handleDownloadTemplate}
              type="button"
              className="gap-2"
            >
              <FileDown className="h-4 w-4" />
              Download Template
            </Button>

            <div className="flex items-center gap-6 text-xs text-gray-500 pt-4">
              <div className="flex items-center gap-1">
                <Info className="h-3 w-3" />
                <span>CSV Format</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span>{TEMPLATE_COLUMNS.length} Columns</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
