import type { ThemeConfig } from '@/types/theme-config';
import { Icons } from "@v1/ui/icons";

interface Props {
  themeConfig: ThemeConfig;
}

export function Footer({ themeConfig }: Props) {
  const { social } = themeConfig;
  
  // Helper function to validate URLs
  const isValidUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string' || url.trim() === '') return false;
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // Build social media array with URL validation
  const socialMedia = [
    { show: social?.showInstagram, text: 'IG', Icon: Icons.Instagram, url: social?.instagramUrl },
    { show: social?.showFacebook, text: 'FB', Icon: Icons.Facebook, url: social?.facebookUrl },
    { show: social?.showTwitter, text: 'X', Icon: Icons.Twitter, url: social?.twitterUrl },
    { show: social?.showPinterest, text: 'PT', Icon: Icons.Pinterest, url: social?.pinterestUrl },
    { show: social?.showTiktok, text: 'TK', Icon: Icons.TikTok, url: social?.tiktokUrl },
  ].filter(item => item.show && isValidUrl(item.url));
  
  return (
    <div className="w-full">
      <div
        className="footer flex justify-between items-center p-sm border-t"
      >
        {/* Brand name on the left */}
        <div className="footer__legal-name">
          {social?.legalName}
        </div>
        
        {/* Social media on the right */}
        <div className="flex items-center gap-md">
          {socialMedia.map((item) => (
            <a
              key={item.text}
              href={item.url}
              className="footer__social-icons cursor-pointer"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Visit ${item.text} (opens in new tab)`}
            >
              {social?.useIcons ? (
                <item.Icon className="w-[16px] h-[16px]" />
              ) : (
                <span>{item.text}</span>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
