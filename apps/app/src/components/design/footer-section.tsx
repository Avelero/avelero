'use client';

import { useDesignConfig } from '@/hooks/use-design-config';
import { Input } from '@v1/ui/input';
import { Label } from '@v1/ui/label';
import { Switch } from '@v1/ui/switch';

export function FooterSection() {
    const { config, updateSection } = useDesignConfig();

    const updateSocial = <K extends keyof typeof config.social>(
        key: K,
        value: (typeof config.social)[K]
    ) => {
        updateSection('social', {
            ...config.social,
            [key]: value,
        });
    };

    return (
        <div className="relative">
            <div className="flex flex-col p-6 border rounded-lg">
                <div className="flex flex-col gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Footer</h3>
                        <p className="text-sm text-muted-foreground">
                            Configure social media links in the footer
                        </p>
                    </div>

                    {/* Legal Name */}
                    <div className="space-y-2">
                        <Label htmlFor="legal-name">Legal Name</Label>
                        <Input
                            id="legal-name"
                            value={config.social.legalName}
                            onChange={(e) => updateSocial('legalName', e.target.value)}
                            placeholder="Your Company Name"
                        />
                    </div>

                    {/* Social Links */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium">Social Media</h4>

                        {/* Instagram */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="instagram">Instagram</Label>
                                <Switch
                                    checked={config.social.showInstagram}
                                    onCheckedChange={(checked) => updateSocial('showInstagram', checked)}
                                />
                            </div>
                            {config.social.showInstagram && (
                                <Input
                                    id="instagram"
                                    type="url"
                                    value={config.social.instagramUrl}
                                    onChange={(e) => updateSocial('instagramUrl', e.target.value)}
                                    placeholder="https://instagram.com/yourprofile"
                                />
                            )}
                        </div>

                        {/* LinkedIn */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="linkedin">LinkedIn</Label>
                                <Switch
                                    checked={config.social.showLinkedin}
                                    onCheckedChange={(checked) => updateSocial('showLinkedin', checked)}
                                />
                            </div>
                            {config.social.showLinkedin && (
                                <Input
                                    id="linkedin"
                                    type="url"
                                    value={config.social.linkedinUrl}
                                    onChange={(e) => updateSocial('linkedinUrl', e.target.value)}
                                    placeholder="https://linkedin.com/company/yourcompany"
                                />
                            )}
                        </div>

                        {/* Twitter/X */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="twitter">X (Twitter)</Label>
                                <Switch
                                    checked={config.social.showTwitter}
                                    onCheckedChange={(checked) => updateSocial('showTwitter', checked)}
                                />
                            </div>
                            {config.social.showTwitter && (
                                <Input
                                    id="twitter"
                                    type="url"
                                    value={config.social.twitterUrl}
                                    onChange={(e) => updateSocial('twitterUrl', e.target.value)}
                                    placeholder="https://x.com/yourprofile"
                                />
                            )}
                        </div>

                        {/* Facebook */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="facebook">Facebook</Label>
                                <Switch
                                    checked={config.social.showFacebook}
                                    onCheckedChange={(checked) => updateSocial('showFacebook', checked)}
                                />
                            </div>
                            {config.social.showFacebook && (
                                <Input
                                    id="facebook"
                                    type="url"
                                    value={config.social.facebookUrl}
                                    onChange={(e) => updateSocial('facebookUrl', e.target.value)}
                                    placeholder="https://facebook.com/yourpage"
                                />
                            )}
                        </div>

                        {/* Pinterest */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="pinterest">Pinterest</Label>
                                <Switch
                                    checked={config.social.showPinterest}
                                    onCheckedChange={(checked) => updateSocial('showPinterest', checked)}
                                />
                            </div>
                            {config.social.showPinterest && (
                                <Input
                                    id="pinterest"
                                    type="url"
                                    value={config.social.pinterestUrl}
                                    onChange={(e) => updateSocial('pinterestUrl', e.target.value)}
                                    placeholder="https://pinterest.com/yourprofile"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
