export function TextBlock({ spanText, text }: { spanText: string, text: string }) {
    return (
        <div className="flex w-full py-[62px] items-center justify-center">
            <p className="text-h5 text-foreground/50 w-2/3 text-center"><span className="text-foreground">{spanText} </span>{text}</p>
        </div>
    );
}