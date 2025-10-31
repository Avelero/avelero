"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetBreadcrumbHeader,
  SheetFooter,
  SheetClose,
} from "@v1/ui/sheet";

export function PassportsUploadSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="default"
          iconPosition="left"
          icon={<Icons.Upload />}
          className="min-w-[100px]"
        >
          Upload
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        <SheetBreadcrumbHeader pages={["Upload"]} currentPageIndex={0} />
        <div className="flex-1 px-6 py-6" />
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" size="default">
              Cancel
            </Button>
          </SheetClose>
          <Button variant="brand" size="default">
            Next
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}


