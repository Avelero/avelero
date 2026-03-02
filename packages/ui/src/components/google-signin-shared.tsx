"use client";

export type GoogleCredentialResponse = {
  credential?: string;
};

export type GoogleIdentityApi = {
  initialize: (input: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce?: string;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
      shape: "rectangular";
      width: number;
      logo_alignment: "left" | "center";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleIdentityApi;
      };
    };
  }
}

const GOOGLE_SCRIPT_ID = "google-identity-services-script";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_SCRIPT_STATUS_ATTR = "data-load-status";

function waitForScript(script: HTMLScriptElement): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out loading Google script"));
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };

    const onLoad = () => {
      script.setAttribute(GOOGLE_SCRIPT_STATUS_ATTR, "loaded");
      cleanup();
      resolve();
    };

    const onError = () => {
      script.setAttribute(GOOGLE_SCRIPT_STATUS_ATTR, "error");
      cleanup();
      reject(new Error("Failed to load Google script"));
    };

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
  });
}

export async function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return;
  }

  const existingScript = document.getElementById(
    GOOGLE_SCRIPT_ID,
  ) as HTMLScriptElement | null;

  if (existingScript) {
    const status = existingScript.getAttribute(GOOGLE_SCRIPT_STATUS_ATTR);

    if (status === "loaded") {
      if (window.google?.accounts?.id) {
        return;
      }
      existingScript.remove();
    } else if (status === "loading") {
      await waitForScript(existingScript);
      return;
    } else {
      // Unknown or failed state: remove and retry with a fresh script element.
      existingScript.remove();
    }
  }

  const script = document.createElement("script");
  script.id = GOOGLE_SCRIPT_ID;
  script.src = GOOGLE_SCRIPT_SRC;
  script.async = true;
  script.defer = true;
  script.setAttribute(GOOGLE_SCRIPT_STATUS_ATTR, "loading");
  document.head.appendChild(script);

  await waitForScript(script);
}

export function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.2 0 6.1 1.1 8.3 3.1l6.2-6.2C34.6 2.8 29.7.5 24 .5 14.6.5 6.5 5.9 2.5 13.8l7.3 5.7C11.8 13.4 17.4 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.6c0-1.5-.1-2.9-.4-4.3H24v8.1h12.7c-.6 3-2.3 5.5-4.8 7.1l7.4 5.7c4.3-4 6.8-9.8 6.8-16.6z"
      />
      <path
        fill="#FBBC05"
        d="M9.8 28.5c-.5-1.5-.8-3-.8-4.6s.3-3.2.8-4.6l-7.3-5.7C.9 16.9 0 20.4 0 23.9s.9 7 2.5 10.2l7.3-5.6z"
      />
      <path
        fill="#34A853"
        d="M24 47.5c5.7 0 10.5-1.9 14-5.1l-7.4-5.7c-2 1.4-4.6 2.3-7.6 2.3-6.6 0-12.2-3.9-14.2-9.7l-7.3 5.6c4 7.9 12.1 12.6 22.5 12.6z"
      />
    </svg>
  );
}
