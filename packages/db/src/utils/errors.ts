export type DatabaseErrorMeta = {
  code?: string;
  detail?: string;
  constraint?: string;
  message?: string;
};

export function getDatabaseErrorMeta(error: unknown): DatabaseErrorMeta {
  if (error && typeof error === "object") {
    const meta: DatabaseErrorMeta = {};
    if ("code" in error && typeof (error as any).code === "string") {
      meta.code = (error as any).code;
    }
    if ("detail" in error && typeof (error as any).detail === "string") {
      meta.detail = (error as any).detail;
    }
    if ("constraint" in error && typeof (error as any).constraint === "string") {
      meta.constraint = (error as any).constraint;
    }
    if (error instanceof Error) {
      meta.message = error.message;
    }
    return meta;
  }
  return {};
}

export function buildDatabaseErrorMessage(
  meta: DatabaseErrorMeta,
  fallback: string,
) {
  return meta.detail ?? meta.message ?? fallback;
}


