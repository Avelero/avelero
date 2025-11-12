import { render as renderEmail } from "@react-email/render";

export const render = (component: React.ReactElement) => {
  return renderEmail(component);
};
