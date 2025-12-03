"use client";

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ThemeConfig } from "@v1/dpp-components";
import { useThemeQuery } from "@/hooks/use-theme";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { toast } from "@v1/ui/sonner";
import { SetHeader } from "./set-header";
import { SetMenu } from "./set-menu";
import { SetBanner } from "./set-banner";
import { SetCarousel } from "./set-carousel";
import { SetFooter } from "./set-footer";

/**
 * Form component that manages theme content (config) state.
 * Handles state management and persistence for all content blocks.
 */
export function ThemeContentForm() {
  const { data: theme } = useThemeQuery();
  const { data: user } = useUserQuery();
  const brandId = user?.brand_id ?? undefined;
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Initialize state from fetched theme config
  const [config, setConfig] = useState<ThemeConfig>(() => theme.themeConfig);

  // Reset state when theme data changes (e.g., brand switch)
  useEffect(() => {
    setConfig(theme.themeConfig);
  }, [theme.themeConfig]);

  // Mutation for saving theme config
  const updateMutation = useMutation(
    trpc.workflow.theme.updateConfig.mutationOptions({
      onSuccess: () => {
        // Invalidate theme query to refetch fresh data
        queryClient.invalidateQueries({ queryKey: ["workflow", "getTheme"] });
        queryClient.invalidateQueries({ queryKey: ["workflow", "theme", "get"] });
        toast.success("Changes saved");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to save changes");
      },
    }),
  );

  const handleSave = useCallback(() => {
    if (!brandId) {
      toast.error("No brand selected");
      return;
    }
    // Cast to Record<string, unknown> for the API which accepts any object
    updateMutation.mutate({ config: config as unknown as Record<string, unknown> });
  }, [brandId, config, updateMutation]);

  // Helper to update nested config sections
  const updateBranding = useCallback(
    (updates: Partial<ThemeConfig["branding"]>) => {
      setConfig((prev) => ({
        ...prev,
        branding: { ...prev.branding, ...updates },
      }));
    },
    [],
  );

  const updateMenus = useCallback(
    (
      menuType: "primary" | "secondary",
      items: Array<{ label: string; url: string }>,
    ) => {
      setConfig((prev) => ({
        ...prev,
        menus: { ...prev.menus, [menuType]: items },
      }));
    },
    [],
  );

  const updateSections = useCallback(
    (updates: Partial<ThemeConfig["sections"]>) => {
      setConfig((prev) => ({
        ...prev,
        sections: { ...prev.sections, ...updates },
      }));
    },
    [],
  );

  const updateCta = useCallback((updates: Partial<ThemeConfig["cta"]>) => {
    setConfig((prev) => ({
      ...prev,
      cta: { ...prev.cta, ...updates },
    }));
  }, []);

  const updateSocial = useCallback(
    (updates: Partial<ThemeConfig["social"]>) => {
      setConfig((prev) => ({
        ...prev,
        social: { ...prev.social, ...updates },
      }));
    },
    [],
  );

  return (
    <div className="w-[500px]">
      {/* Save button at top */}
      <div className="flex justify-end mb-6">
        <Button
          variant="brand"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex flex-col gap-12">
        <SetHeader
          logoUrl={config.branding.headerLogoUrl}
          onLogoChange={(url) => updateBranding({ headerLogoUrl: url || "" })}
          brandId={brandId}
        />

        <SetMenu
          menuType="primary"
          items={config.menus.primary}
          enabled={config.sections.showPrimaryMenu}
          onItemsChange={(items) => updateMenus("primary", items)}
          onEnabledChange={(enabled) =>
            updateSections({ showPrimaryMenu: enabled })
          }
        />

        <SetMenu
          menuType="secondary"
          items={config.menus.secondary}
          enabled={config.sections.showSecondaryMenu}
          onItemsChange={(items) => updateMenus("secondary", items)}
          onEnabledChange={(enabled) =>
            updateSections({ showSecondaryMenu: enabled })
          }
        />

        <SetCarousel
          enabled={config.sections.showSimilarProducts}
          onEnabledChange={(enabled) =>
            updateSections({ showSimilarProducts: enabled })
          }
        />

        <SetBanner
          enabled={config.sections.showCTABanner}
          onEnabledChange={(enabled) =>
            updateSections({ showCTABanner: enabled })
          }
          headline={config.cta.bannerHeadline}
          subheadline={config.cta.bannerSubline}
          buttonLabel={config.cta.bannerCTAText}
          buttonUrl={config.cta.bannerCTAUrl}
          backgroundImageUrl={config.cta.bannerBackgroundImage}
          onHeadlineChange={(value) => updateCta({ bannerHeadline: value })}
          onSubheadlineChange={(value) => updateCta({ bannerSubline: value })}
          onButtonLabelChange={(value) => updateCta({ bannerCTAText: value })}
          onButtonUrlChange={(value) => updateCta({ bannerCTAUrl: value })}
          onBackgroundImageChange={(url) =>
            updateCta({ bannerBackgroundImage: url || "" })
          }
          brandId={brandId}
        />

        <SetFooter
          instagramUrl={config.social.instagramUrl}
          facebookUrl={config.social.facebookUrl}
          linkedinUrl={config.social.linkedinUrl}
          pinterestUrl={config.social.pinterestUrl}
          tiktokUrl={config.social.tiktokUrl}
          xUrl={config.social.twitterUrl}
          onInstagramChange={(value) => updateSocial({ instagramUrl: value })}
          onFacebookChange={(value) => updateSocial({ facebookUrl: value })}
          onLinkedinChange={(value) => updateSocial({ linkedinUrl: value })}
          onPinterestChange={(value) => updateSocial({ pinterestUrl: value })}
          onTiktokChange={(value) => updateSocial({ tiktokUrl: value })}
          onXChange={(value) => updateSocial({ twitterUrl: value })}
        />
      </div>
    </div>
  );
}

