import { BrandCard } from "./brand-card";
import { PlytixLogo, ShopifyLogo, ItsPerfectLogo, ApparelMagicLogo, AkeneoLogo, DelogueLogo } from "./brand-logos";

export function Brands() {
    return (
        <div className="w-full pt-[124px] pb-[62px]">
            <div className="flex flex-col items-center w-full pb-8 gap-6">
                <h6 className="text-body text-foreground">Integrates with</h6>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
                    <BrandCard logo={<PlytixLogo height={24} color="hsl(var(--foreground))" />} />
                    <BrandCard logo={<ShopifyLogo height={28} color="hsl(var(--foreground))" />} />
                    <BrandCard logo={<ItsPerfectLogo height={28} color="hsl(var(--foreground))" />} />
                    <BrandCard logo={<ApparelMagicLogo height={22} color="hsl(var(--foreground))" />} />
                    <BrandCard logo={<AkeneoLogo height={20} color="hsl(var(--foreground))" />} />
                    <BrandCard logo={<DelogueLogo height={24} color="hsl(var(--foreground))" />} />
                </div>
            </div>
        </div>
    );
}