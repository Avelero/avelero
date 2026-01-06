export function Headline({
    headline,
    subHeadline,
}: { headline: string; subHeadline?: string }) {
    return (
        <div className="flex flex-col gap-4 w-full pb-[45px] pt-[58px] sm:pb-[62px] sm:pt-[92px] items-start">
            {subHeadline && (
                <p className="text-h6 md:text-h5 text-foreground/50">
                    {subHeadline}
                </p>
            )}
            <h1 className="text-h3 md:text-h1 text-foreground">
                {headline}
            </h1>
        </div>
    );
}
