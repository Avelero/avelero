import { Button } from "./button";
import Image from "next/image";

export function CTABlock() {
    return (
        <div className="w-full pt-[62px] pb-[124px]">
            <div className="relative flex flex-col items-center justify-center gap-12 p-[96px]">
                <Image src="/cta-image.webp" alt="" fill className="object-cover -z-10" quality={90} />
                <h4 className="text-h5 text-background z-10">A digital product experience</h4>
                <Button variant="brand">Talk to founders</Button>
            </div>
        </div>
    );
}