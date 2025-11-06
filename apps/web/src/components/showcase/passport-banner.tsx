import Image from "next/image";

export function PassportBanner() {
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white border-[#E9E9EC] border-[0.2cqw] w-[61.6cqw]">
                <div className="py-[7.5cqw] w-full">
                    <div className="relative flex flex-col items-center justify-center px-[3.8cqw] py-[8.8cqw] gap-[4.4cqw]">
                        <Image
                            src="/banner-background.webp"
                            alt=""
                            fill
                            className="object-cover"
                            quality={90}
                        />
                        <div className="relative z-10 flex flex-col items-center gap-[4.4cqw]">
                            <p className="text-[6.2cqw] font-geist-sans text-[#FFFFFF]">Avelero Apparel</p>
                            <div className="py-[1.9cqw] px-[3.8cqw] bg-[#0000FF] hover:brightness-[0.9] transition-all duration-100 cursor-pointer font-geist-mono text-[#FFFFFF] text-[2.2cqw]">DISCOVER MORE</div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row p-[1.9cqw] border-[#E9E9EC] border-t-[0.2cqw] justify-between items-center">
                    <p className="text-[2.2cqw] font-geist-sans text-[#626379]">Avelero Apparel</p>
                    <div className="flex flex-row gap-[0.8cqw]">
                        <p className="text-[2.2cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 cursor-pointer">IG</p>
                        <p className="text-[2.2cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 cursor-pointer">FB</p>
                        <p className="text-[2.2cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 cursor-pointer">X</p>
                        <p className="text-[2.2cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 cursor-pointer">PT</p>
                    </div>
                </div>
            </div>
        </div>
    );
}