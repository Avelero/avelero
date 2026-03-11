import type { DppContent } from "../../types/content";
import type { DppData } from "../../types/data";
import type { Passport } from "../../types/passport";
import { LayoutRenderer } from "./layout-renderer";

interface Props {
  passport: Passport;
  data: DppData;
  content?: DppContent;
  forceModalType?: string | null;
}

export function ContentFrame({
  passport,
  data,
  content,
  forceModalType,
}: Props) {
  return (
    <LayoutRenderer
      passport={passport}
      data={data}
      content={content}
      forceModalType={forceModalType}
    />
  );
}
