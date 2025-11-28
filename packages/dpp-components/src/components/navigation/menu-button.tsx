import { Icons } from '@v1/ui/icons';

interface Props {
  label: string;
  url: string;
  // themeConfig: ThemeConfig; // Reserved for future theme customization
}

export function MenuButton({ label, url }: Props) {
  
  // Check if URL is external
  const isExternal = url.startsWith('http://') || url.startsWith('https://');
  
  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="px-sm py-md flex justify-between items-center border-b cursor-pointer menu-button"
    >
      {label}
      <Icons.ChevronRight className="w-5 h-5" />
    </a>
  );
}
