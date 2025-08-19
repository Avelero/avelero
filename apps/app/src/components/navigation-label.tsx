import Link from "next/link";

interface NavigationLabelProps {
  pathname: string;
  locale?: string;
}

export function NavigationLabel({ pathname, locale = "en" }: NavigationLabelProps) {
  // Remove locale from pathname
  const path = pathname.replace(`/${locale}`, "") || "/";
  
  // Split path into segments and format them
  const segments = path.split("/").filter(Boolean);
  const formattedSegments = segments.map((segment) => {
    const words = segment.split("-").filter(Boolean);
    const firstWord = words.at(0);
    if (!firstWord) return "";
    const firstFormatted = firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
    const restFormatted = words.slice(1).map((w) => w.toLowerCase());
    return [firstFormatted, ...restFormatted].join(" ");
  });

  // Build breadcrumb items based on segment count
  const items: Array<{ label: string; href: string; show: boolean }> = [];
  
  if (segments.length === 0) {
    // Root path
    items.push({ label: "Dashboard", href: `/${locale}`, show: true });
  } else if (segments.length <= 3) {
    // Show all segments
    segments.forEach((_, index) => {
      const href = `/${locale}/${segments.slice(0, index + 1).join("/")}`;
      const label = formattedSegments[index];
      if (label) {
        items.push({ label, href, show: true });
      }
    });
  } else {
    // Show first + ellipsis + last two
    const firstLabel = formattedSegments[0];
    if (firstLabel) {
      items.push({ 
        label: firstLabel, 
        href: `/${locale}/${segments[0]}`,
        show: true 
      });
    }
    items.push({ 
      label: "...", 
      href: "", 
      show: false 
    });
    // Last two segments
    for (let i = segments.length - 2; i < segments.length; i++) {
      const href = `/${locale}/${segments.slice(0, i + 1).join("/")}`;
      const label = formattedSegments[i];
      if (label) {
        items.push({ label, href, show: true });
      }
    }
  }

  return (
    <nav className="flex items-center text-sm">
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          {index > 0 && <span className="mx-2 text-h5 text-tertiary">/</span>}
          {!item.show ? (
            <span className="text-h5 text-tertiary">{item.label}</span>
          ) : index === items.length - 1 ? (
            <span className="text-h5 text-primary">{item.label}</span>
          ) : (
            <Link 
              href={item.href} 
              className="text-h5 text-tertiary hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}