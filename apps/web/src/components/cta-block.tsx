import Image from "next/image";
import { ContactDrawer } from "./contact-drawer";

export function CTABlock() {
    return (
        <div className="w-full pt-[45px] sm:pt-[62px] pb-[90px] sm:pb-[124px]">
            <div className="relative flex flex-col items-center justify-center gap-4 md:gap-12 py-12 px-0 md:p-[96px]">
                <Image
                    src="/cta-image.webp"
                    alt="Digital product passport background image"
                    fill
                    sizes="(max-width: 1280px) 90vw, 1135px"
                    className="object-cover -z-10"
                    quality={90}
                />
                <h4 className="text-h5 md:text-h4 text-background text-center z-10">A digital product experience</h4>
                <ContactDrawer />
            </div>
        </div>
    );
}