import Image from "next/image";

const width = 306;
const height = 422;

export function PassportCarousel() {
    return (
        <div className="absolute left-[6.4cqw] inset-0 flex items-center">
            <div className="flex flex-col gap-[1.9cqw] p-[3.8cqw] bg-white border-[#E9E9EC] border-[0.2cqw]">
                <p className="text-[2.5cqw] font-geist-sans text-[#1E2040] leading-none">SIMILAR ITEMS</p>
                <div className="flex flex-row gap-[1.9cqw]">
                    <div className="flex flex-col gap-[1.9cqw]">
                        <Image className="cursor-pointer w-[30.6cqw] h-[42.2cqw] object-cover" src="/carousel-image-1.webp" alt="Carousel Image 1" width={width} height={height} quality={90} />
                        <div className="flex flex-col gap-[0.8cqw]">
                            <p className="text-[2.5cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 truncate w-full line-clamp-1  cursor-pointer">BOMBER BLACK JACKET</p>
                            <p className="text-[2.5cqw] font-geist-mono text-[#1E2040] leading-none">€ 550</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[1.9cqw]">
                        <Image className="cursor-pointer w-[30.6cqw] h-[42.2cqw] object-cover" src="/carousel-image-2.webp" alt="Carousel Image 2" width={width} height={height} quality={90} />
                        <div className="flex flex-col gap-[0.8cqw]">
                            <p className="text-[2.5cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 truncate w-full line-clamp-1  cursor-pointer">AMAZING ZIPPER JACKET</p>
                            <p className="text-[2.5cqw] font-geist-mono text-[#1E2040] leading-none">€ 1 050</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-[1.9cqw]">
                        <Image className="cursor-pointer w-[30.6cqw] h-[42.2cqw] object-cover" src="/carousel-image-3.webp" alt="Carousel Image 3" width={width} height={height} quality={90} />
                        <div className="flex flex-col gap-[0.8cqw]">
                            <p className="text-[2.5cqw] font-geist-sans text-[#0000FF] hover:brightness-[0.8] transition-all duration-100 truncate w-full line-clamp-1 cursor-pointer">DENIM WONDER JACKET</p>
                            <p className="text-[2.5cqw] font-geist-mono text-[#1E2040] leading-none">€ 880</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}