import Image from "next/image";
import { ContactDrawer } from "./contact-drawer";

export function BentoBlock() {
  return (
    <div
      id="automation"
      className="flex flex-col w-full py-[45px] sm:py-[62px] gap-4 lg:gap-6 scroll-mt-20"
    >
      <div className="flex md:flex-row flex-col justify-between md:items-center">
        <h4 className="text-h6 md:text-h5 text-foreground">
          Get compliant in days, <br className="md:hidden" />
          <span className="text-foreground/50 md:text-foreground">
            not months
          </span>
        </h4>
        <div className="hidden sm:block">
          <ContactDrawer />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-6 w-full lg:grid-rows-2 lg:auto-rows-fr">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 w-full">
          <div className="flex flex-col flex-1 bg-card border border-border">
            <div className="flex flex-col gap-2 px-6 pt-6">
              <h5 className="text-h6 text-foreground">Raw data uploads</h5>
              <p className="text-small text-foreground/50">
                Drag & drop Excel files, PDFs, or other article data — Avelero
                understands, transforms, and stores it so your DPPs are ready in
                days, not months.
              </p>
            </div>
            <div className="relative lg:flex-1 flex items-center justify-center p-6 h-[220px] lg:h-auto">
              {/* Top image: 56px right of center, clamped to padding boundaries */}
              <Image
                src="/document-upload-image-1.webp"
                alt="Document upload illustration"
                className="absolute top-6 left-[clamp(24px,calc(50%-46px),calc(100%-228px))] object-contain z-10"
                loading="lazy"
                quality={90}
                width={204}
                height={134}
              />

              {/* Bottom image: 56px left of center, clamped to padding boundaries */}
              <Image
                src="/document-upload-image-2.webp"
                alt="File overview illustration"
                className="absolute bottom-6 left-[clamp(24px,calc(50%-158px),calc(100%-228px))] object-contain z-9"
                loading="lazy"
                quality={90}
                width={204}
                height={134}
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 bg-card border border-border">
            <div className="flex flex-col gap-2 px-6 pt-6">
              <h5 className="text-h6 text-foreground">System integrations</h5>
              <p className="text-small text-foreground/50">
                Connect via API to your PLM, ERP, or e-commerce platform. Keep
                passports updated as your product data changes.
              </p>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              <Image
                src="/connector-image.webp"
                alt="API integration diagram showing Avelero connecting with PIM and e-commerce systems"
                className="object-contain"
                loading="lazy"
                quality={85}
                width={341}
                height={152}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row bg-card border border-border w-full lg:gap-6">
          <div className="flex flex-col gap-2 px-6 pt-6 lg:w-1/2">
            <h5 className="text-h6 text-foreground">Data enrichment</h5>
            <p className="text-small text-foreground/50">
              Automatically fill gaps with AI — we detect and complete missing
              information by leveraging patterns in your product data.
            </p>
          </div>

          <div className="relative overflow-hidden pt-6 pl-6 lg:pr-0 lg:pb-0 lg:w-1/2 flex items-end lg:items-stretch">
            <Image
              src="/data-enrichment-image.webp"
              alt="AI-powered data enrichment table showing automatic completion of missing product information"
              className="ml-auto lg:ml-0 lg:absolute lg:bottom-0 lg:left-6 lg:top-6 w-auto max-w-none max-h-[180px] sm:max-h-[200px] lg:max-h-none object-cover object-left-bottom"
              loading="lazy"
              quality={85}
              width={553}
              height={277}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
