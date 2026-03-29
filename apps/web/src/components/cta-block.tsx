import { ContactDrawer } from "./contact-drawer";

export function CTABlock() {
  return (
    <div className="w-full pt-[45px] sm:pt-[62px] pb-[90px] sm:pb-[124px]">
      <div className="flex flex-col items-start gap-6 sm:py-[62px]">
        <h2 className="text-h4 md:text-h2 text-foreground">
          Get compliant.
          <br />
          Get <span className="text-primary">Avelero.</span>
        </h2>
        <ContactDrawer />
      </div>
    </div>
  );
}
