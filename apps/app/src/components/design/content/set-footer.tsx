"use client";

import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";

interface SetFooterProps {
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  pinterestUrl: string;
  tiktokUrl: string;
  xUrl: string;
  onInstagramChange: (value: string) => void;
  onFacebookChange: (value: string) => void;
  onLinkedinChange: (value: string) => void;
  onPinterestChange: (value: string) => void;
  onTiktokChange: (value: string) => void;
  onXChange: (value: string) => void;
}

export function SetFooter({
  instagramUrl,
  facebookUrl,
  linkedinUrl,
  pinterestUrl,
  tiktokUrl,
  xUrl,
  onInstagramChange,
  onFacebookChange,
  onLinkedinChange,
  onPinterestChange,
  onTiktokChange,
  onXChange,
}: SetFooterProps) {
  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Footer</p>

      {/* Instagram */}
      <div className="space-y-1.5">
        <Label>Instagram</Label>
        <Input
          value={instagramUrl}
          onChange={(e) => onInstagramChange(e.target.value)}
          placeholder="Instagram url"
          className="h-9"
        />
      </div>

      {/* Facebook */}
      <div className="space-y-1.5">
        <Label>Facebook</Label>
        <Input
          value={facebookUrl}
          onChange={(e) => onFacebookChange(e.target.value)}
          placeholder="Facebook url"
          className="h-9"
        />
      </div>

      {/* LinkedIn */}
      <div className="space-y-1.5">
        <Label>LinkedIn</Label>
        <Input
          value={linkedinUrl}
          onChange={(e) => onLinkedinChange(e.target.value)}
          placeholder="LinkedIn url"
          className="h-9"
        />
      </div>

      {/* Pinterest */}
      <div className="space-y-1.5">
        <Label>Pinterest</Label>
        <Input
          value={pinterestUrl}
          onChange={(e) => onPinterestChange(e.target.value)}
          placeholder="Pinterest url"
          className="h-9"
        />
      </div>

      {/* TikTok */}
      <div className="space-y-1.5">
        <Label>TikTok</Label>
        <Input
          value={tiktokUrl}
          onChange={(e) => onTiktokChange(e.target.value)}
          placeholder="TikTok url"
          className="h-9"
        />
      </div>

      {/* X */}
      <div className="space-y-1.5">
        <Label>X</Label>
        <Input
          value={xUrl}
          onChange={(e) => onXChange(e.target.value)}
          placeholder="X url"
          className="h-9"
        />
      </div>
    </div>
  );
}
