"use client";

import { useState } from "react";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Switch } from "@v1/ui/switch";

export function SetFooter() {
  const [instagramUrl, setInstagramUrl] = useState<string>("");
  const [facebookUrl, setFacebookUrl] = useState<string>("");
  const [linkedinUrl, setLinkedinUrl] = useState<string>("");
  const [pinterestUrl, setPinterestUrl] = useState<string>("");
  const [tiktokUrl, setTiktokUrl] = useState<string>("");
  const [xUrl, setXUrl] = useState<string>("");

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <p className="type-p !font-medium text-primary">Footer</p>

      {/* Instagram */}
      <div className="space-y-1.5">
        <Label>Instagram</Label>
        <Input
          value={instagramUrl}
          onChange={(e) => setInstagramUrl(e.target.value)}
          placeholder="Instagram url"
          className="h-9"
        />
      </div>

      {/* Facebook */}
      <div className="space-y-1.5">
        <Label>Facebook</Label>
        <Input
          value={facebookUrl}
          onChange={(e) => setFacebookUrl(e.target.value)}
          placeholder="Facebook url"
          className="h-9"
        />
      </div>

      {/* LinkedIn */}
      <div className="space-y-1.5">
        <Label>LinkedIn</Label>
        <Input
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="LinkedIn url"
          className="h-9"
        />
      </div>

      {/* Pinterest */}
      <div className="space-y-1.5">
        <Label>Pinterest</Label>
        <Input
          value={pinterestUrl}
          onChange={(e) => setPinterestUrl(e.target.value)}
          placeholder="Pinterest url"
          className="h-9"
        />
      </div>

      {/* TikTok */}
      <div className="space-y-1.5">
        <Label>TikTok</Label>
        <Input
          value={tiktokUrl}
          onChange={(e) => setTiktokUrl(e.target.value)}
          placeholder="TikTok url"
          className="h-9"
        />
      </div>

      {/* X */}
      <div className="space-y-1.5">
        <Label>X</Label>
        <Input
          value={xUrl}
          onChange={(e) => setXUrl(e.target.value)}
          placeholder="X url"
          className="h-9"
        />
      </div>
    </div>
  );
}
