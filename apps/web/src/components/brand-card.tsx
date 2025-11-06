interface BrandCardProps {
    logo: React.ReactNode;
}

export function BrandCard({ logo }: BrandCardProps) {
    return (
        <div className="py-7 border border-border bg-card">
            <div className="h-10 flex items-center justify-center">
                {logo}
            </div>
        </div>
    );
}