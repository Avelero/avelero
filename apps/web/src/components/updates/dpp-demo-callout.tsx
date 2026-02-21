import Image from "next/image";

const demoUrl = "https://passport.avelero.com/";
const qrCodeImageSrc = "/avelero-dpp-qr-code.webp";

export function DPPDemoCallout() {
  return (
    <aside className="my-10 border border-border bg-card p-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:p-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-6">
        <a
          href={demoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block md:flex-shrink-0"
          aria-label="Open Avelero digital product passport demo"
        >
          <div className="relative aspect-square w-full overflow-hidden border border-border bg-background md:h-40 md:w-40">
            <Image
              src={qrCodeImageSrc}
              alt="QR code linking to Avelero's digital product passport demo"
              fill
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 160px"
              className="object-cover"
            />
          </div>
        </a>

        <div className="flex flex-col items-start gap-2">
          <h5 className="text-h6 text-foreground">
            See what a Digital Product Passport looks like
          </h5>
          <p className="text-small text-foreground/50">
            Scan the QR code or click the link below to explore a live product
            passport demo built with Avelero.
          </p>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-small text-primary underline transition-colors duration-150 hover:text-primary/70"
          >
            Explore the live demo
          </a>
        </div>
      </div>
    </aside>
  );
}
