const DEFAULT_SERVER_URL = "http://localhost:8081";

export const OAUTH_CALLBACK_PATHS = {
    googleDrive: "/api/integrations/google-drive/callback",
    github: "/api/integrations/github/callback",
    notion: "/api/integrations/notion/callback",
} as const;

/**
 * Resolves an OAuth callback URI.
 *
 * An explicit provider-registered callback always wins. When it is omitted,
 * deployed environments derive the callback from SERVER_URL (then
 * BETTER_AUTH_URL), while local development falls back to localhost:8081.
 */
export function getOAuthCallbackUrl(
    configuredCallback: string | undefined,
    callbackPath: string,
): string {
    const explicitCallback = configuredCallback?.trim();
    if (explicitCallback) {
        return explicitCallback;
    }

    const configuredBaseUrl = [process.env.SERVER_URL, process.env.BETTER_AUTH_URL]
        .map((value) => value?.trim())
        .find((value) => value);
    const baseUrl = (configuredBaseUrl || DEFAULT_SERVER_URL).replace(/\/+$/, "");

    return `${baseUrl}${callbackPath}`;
}
