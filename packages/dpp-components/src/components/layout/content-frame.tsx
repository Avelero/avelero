import type { DppContent } from "../../types/dpp-content";
import type { DppData } from "../../types/dpp-data";
import type { Passport } from "../../types/passport";
import { LayoutRenderer } from "./layout-renderer";

interface Props {
  passport: Passport;
  data: DppData;
  content?: DppContent;
}

export function ContentFrame({ passport, data, content }: Props) {
  return <LayoutRenderer passport={passport} data={data} content={content} />;
}
