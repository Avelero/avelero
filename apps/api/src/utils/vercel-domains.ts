/**
 * Vercel Domain Management API utilities.
 *
 * Adds and removes custom domains from the Vercel DPP project
 * after DNS verification succeeds.
 *
 * @module utils/vercel-domains
 */

const VERCEL_API_URL = "https://api.vercel.com";

/**
 * Vercel API error response structure.
 */
interface VercelError {
  code: string;
  message: string;
}

/**
 * Vercel domain API response structure.
 */
interface VercelDomainResponse {
  name: string;
  verified: boolean;
  error?: VercelError;
}

/**
 * Result of a Vercel domain operation.
 */
export interface VercelDomainResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if operation failed */
  error?: string;
}

/**
 * Add a domain to the Vercel DPP project.
 *
 * Should be called after DNS verification succeeds.
 * This enables Vercel to provision an SSL certificate and route traffic.
 *
 * @param domain - The custom domain to add (e.g., "passport.nike.com")
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await addDomainToVercel("passport.nike.com");
 * if (!result.success) {
 *   console.warn("Failed to add domain to Vercel:", result.error);
 * }
 */
export async function addDomainToVercel(
  domain: string,
): Promise<VercelDomainResult> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID_DPP;

  if (!token || !projectId) {
    console.warn(
      "[Vercel] VERCEL_TOKEN or VERCEL_PROJECT_ID_DPP not configured, skipping domain addition",
    );
    // Don't fail verification if Vercel is not configured
    return { success: true };
  }

  try {
    const response = await fetch(
      `${VERCEL_API_URL}/v10/projects/${projectId}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      },
    );

    const data = (await response.json()) as VercelDomainResponse;

    if (!response.ok) {
      // Domain already exists is not an error
      if (data.error?.code === "domain_already_exists") {
        console.info(`[Vercel] Domain ${domain} already exists in project`);
        return { success: true };
      }
      return {
        success: false,
        error: data.error?.message ?? `HTTP ${response.status}`,
      };
    }

    console.info(`[Vercel] Successfully added domain ${domain} to project`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Vercel] Failed to add domain ${domain}:`, message);
    return { success: false, error: `Failed to connect to Vercel API: ${message}` };
  }
}

/**
 * Remove a domain from the Vercel DPP project.
 *
 * Should be called when a brand removes their custom domain.
 * This is best-effort - verification removal proceeds even if this fails.
 *
 * @param domain - The custom domain to remove
 * @returns Result indicating success or failure
 *
 * @example
 * const result = await removeDomainFromVercel("passport.nike.com");
 * // Continue with database removal regardless of result
 */
export async function removeDomainFromVercel(
  domain: string,
): Promise<VercelDomainResult> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID_DPP;

  if (!token || !projectId) {
    // Not configured - nothing to remove
    return { success: true };
  }

  try {
    const response = await fetch(
      `${VERCEL_API_URL}/v10/projects/${projectId}/domains/${encodeURIComponent(domain)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    // 404 means domain doesn't exist - that's fine for removal
    if (!response.ok && response.status !== 404) {
      return {
        success: false,
        error: `Failed to remove domain from Vercel: HTTP ${response.status}`,
      };
    }

    console.info(`[Vercel] Successfully removed domain ${domain} from project`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Vercel] Failed to remove domain ${domain}:`, message);
    return { success: false, error: `Failed to connect to Vercel API: ${message}` };
  }
}
