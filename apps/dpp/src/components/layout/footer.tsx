import type { ThemeConfig } from '@/types/theme-config';
import { Icons } from "@v1/ui/icons";

interface Props {
  theme: ThemeConfig;
}

export function Footer({ theme }: Props) {
  const { social, colors } = theme;
  
  // Build social media array
  const socialMedia = [
    { show: social.showInstagram, text: 'IG', Icon: Icons.Instagram, url: social.instagramUrl },
    { show: social.showFacebook, text: 'FB', Icon: Icons.Facebook, url: social.facebookUrl },
    { show: social.showTwitter, text: 'X', Icon: Icons.Twitter, url: social.twitterUrl },
    { show: social.showPinterest, text: 'PT', Icon: Icons.Pinterest, url: social.pinterestUrl },
    { show: social.showTiktok, text: 'TK', Icon: Icons.TikTok, url: social.tiktokUrl },
  ].filter(item => item.show);
  
  return (
    <div className="w-full">
      <div
        className="flex justify-between items-center p-sm border-t"
        style={{ borderColor: colors.border }}
      >
        {/* Brand name on the left */}
        <div
          className="type-body-sm"
          style={{ color: colors.secondaryText }}
        >
          {social.legalName}
        </div>
        
        {/* Social media on the right */}
        <div className="flex items-center gap-md">
          {socialMedia.map((item) => (
            <a
              key={item.text}
              href={item.url}
              className="type-body-sm cursor-pointer"
              style={{ color: colors.highlight }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {social.useIcons ? (
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
