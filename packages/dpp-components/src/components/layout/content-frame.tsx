import type { DppContent, DppData, ThemeConfig } from "@v1/dpp-components";
import { LayoutRenderer } from "./layout-renderer";

interface Props {
  data: DppData;
  content?: DppContent;
  themeConfig: ThemeConfig;
}

export function ContentFrame({ data, content, themeConfig }: Props) {
  return (
    <LayoutRenderer data={data} content={content} themeConfig={themeConfig} />
  );
}
