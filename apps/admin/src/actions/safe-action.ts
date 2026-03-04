import "server-only";
import {
  DEFAULT_SERVER_ERROR_MESSAGE,
  createSafeActionClient,
} from "next-safe-action";

const handleServerError = (error: Error) => {
  if (
    error.message === "NEXT_REDIRECT" ||
    (error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return DEFAULT_SERVER_ERROR_MESSAGE;
};

export const actionClient = createSafeActionClient({
  handleServerError,
});
