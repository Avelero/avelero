export function TextBlock({ spanText, text }: { spanText: string, text: string }) {
    return (
        <div className="flex w-full py-[45px] sm:py-[62px] items-center justify-center">
            <p className="text-h6 md:text-h5 text-foreground/50 w-full md:w-2/3 md:text-center"><span className="text-foreground">{spanText} </span>{text}</p>
        </div>
    );
}