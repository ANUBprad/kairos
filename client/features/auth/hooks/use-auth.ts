"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signIn, signUp, signOut, useSession } from "../lib/auth-client";
import { authRoutes } from "../lib/auth-routes";
import { authErrorFromQuery, friendlyAuthError, type AuthProvider } from "../lib/auth-error";
import { safeRedirectPath } from "../lib/safe-redirect";
import { useRouter } from "next/navigation";
import { useState } from "react";

function getClientOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function getCallbackPath(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl") ?? params.get("redirect");
    if (cb) return safeRedirectPath(cb);
  }
  return authRoutes.dashboard;
}

/** Builds a callback URL strictly on the current app origin. */
function toAbsoluteUrl(pathOrUrl: string): string {
  return new URL(safeRedirectPath(pathOrUrl), getClientOrigin()).toString();
}

/**
 * Better Auth appends `error` and `error_description` to this URL. Sending the
 * user back to the login form keeps the form state and lets us display a fixed,
 * provider-specific message instead of the default error page.
 */
function toErrorCallbackUrl(provider: AuthProvider, callbackPath: string): string {
  const url = new URL(authRoutes.login, getClientOrigin());
  url.searchParams.set("auth_provider", provider);
  url.searchParams.set("callbackUrl", safeRedirectPath(callbackPath));
  return url.toString();
}

function initialCallbackError(): string | null {
  if (typeof window === "undefined") return null;
  return authErrorFromQuery(new URLSearchParams(window.location.search));
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const session = useSession();
  const [authError, setAuthError] = useState<string | null>(initialCallbackError);

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
      rememberMe,
      callbackUrl,
    }: {
      email: string;
      password: string;
      rememberMe?: boolean;
      callbackUrl?: string;
    }) => {
      setAuthError(null);
      const res = await signIn.email({
        email,
        password,
        rememberMe,
      });
      if (res.error) {
        throw new Error(res.error.message || "Failed to log in");
      }
      return { data: res.data, targetUrl: safeRedirectPath(callbackUrl || getCallbackPath()) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      router.push(result.targetUrl);
      router.refresh();
    },
    onError: (error: Error) => {
      setAuthError(error.message);
    },
  });

  const signupMutation = useMutation({
    mutationFn: async ({
      name,
      email,
      password,
      callbackUrl,
    }: {
      name: string;
      email: string;
      password: string;
      callbackUrl?: string;
    }) => {
      setAuthError(null);
      const res = await signUp.email({
        name,
        email,
        password,
      });
      if (res.error) {
        throw new Error(res.error.message || "Failed to create account");
      }
      return { data: res.data, targetUrl: safeRedirectPath(callbackUrl || getCallbackPath()) };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      router.push(result.targetUrl);
      router.refresh();
    },
    onError: (error: Error) => {
      setAuthError(error.message);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await signOut({
        fetchOptions: {
          onSuccess: () => {
            queryClient.clear();
            router.push(authRoutes.login);
            router.refresh();
          },
        },
      });
      if (res?.error) {
        throw new Error(res.error.message || "Failed to sign out");
      }
      return res?.data;
    },
    onSuccess: () => {
      queryClient.clear();
      router.push(authRoutes.login);
      router.refresh();
    },
  });

  const signInWithSocial = async (
    provider: AuthProvider,
    customCallbackUrl?: string,
  ) => {
    setAuthError(null);
    try {
      const targetPath = safeRedirectPath(customCallbackUrl || getCallbackPath());
      const { data, error } = await signIn.social({
        provider,
        callbackURL: toAbsoluteUrl(targetPath),
        errorCallbackURL: toErrorCallbackUrl(provider, targetPath),
      });

      if (error) {
        setAuthError(friendlyAuthError(error, provider));
        return;
      }

      if (data?.url && data.redirect) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setAuthError(friendlyAuthError(err, provider));
    }
  };

  const signInWithGoogle = (customCallbackUrl?: string) =>
    signInWithSocial("google", customCallbackUrl);

  const signInWithGithub = (customCallbackUrl?: string) =>
    signInWithSocial("github", customCallbackUrl);

  return {
    session: session.data,
    isPending: session.isPending,
    error: session.error,
    authError,
    setAuthError,
    loginMutation,
    signupMutation,
    logoutMutation,
    signInWithGoogle,
    signInWithGithub,
  };
}
