import { PreviewThemeInjector } from "./preview-theme-injector";
import {
  ContentFrame,
  Header,
  Footer,
  type DppData,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";

type Props = {
  data: DppData;
  themeConfig: ThemeConfig;
  themeStyles?: ThemeStyles;
};

export function DesignPreview({ data, themeConfig, themeStyles }: Props) {
  return (
    <div className="w-full h-full bg-accent p-6">
      <div className="w-full h-full bg-white border border-border overflow-auto scrollbar-hide">
        <PreviewThemeInjector themeStyles={themeStyles} />
        <div className="dpp-root min-h-full flex flex-col @container">
          <Header
            themeConfig={themeConfig}
            brandName={data.brandName}
            position="sticky"
          />
          <ContentFrame data={data} themeConfig={themeConfig} />
          <Footer themeConfig={themeConfig} />
        </div>
      </div>
    </div>
  );
}
