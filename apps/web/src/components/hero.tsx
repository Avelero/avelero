import type { ReactNode } from "react";

export function Hero({ children }: { children: ReactNode }) {
  return (
    <div className="w-full pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px] flex flex-col gap-8 md:gap-16">
      {children}
    </div>
  );
}

export function HeroHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {children}
    </div>
  );
}

export function HeroLabel({ children }: { children: ReactNode }) {
  return (
    <h5 className="text-body md:text-h5 text-muted-foreground">{children}</h5>
  );
}

export function HeroHeadline({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[10vw] sm:text-[clamp(3.8rem,9.5vw,4.8rem)] md:text-[clamp(4.8rem,10vw,6.7rem)] lg:text-[clamp(6.7rem,10.5vw,8.625rem)] xl:text-[8.625rem] leading-none text-foreground">
      {children}
    </h1>
  );
}

export function HeroAccent({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

export function HeroContent({
  description,
  children,
}: {
  description: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row justify-start gap-8 md:gap-0 md:justify-between items-start md:items-end">
      {children && (
        <div className="flex flex-row gap-4 order-last md:order-first">
          {children}
        </div>
      )}
      <p className="w-full md:w-1/2 text-small text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
