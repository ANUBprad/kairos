"use client";

import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
) {
  const { data, error } = await authClient.signUp.email(
    { name, email, password },
    {
      onError: (ctx) => {
        toast.error(ctx.error.message || "Failed to create account");
      },
    }
  );
  if (error) throw new Error(error.message);
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await authClient.signIn.email(
    { email, password },
    {
      onError: (ctx) => {
        toast.error(ctx.error.message || "Invalid email or password");
      },
    }
  );
  if (error) throw new Error(error.message);
  return data;
}

export async function signOutUser() {
  const { error } = await authClient.signOut();
  if (error) throw new Error(error.message);
}

export async function sendForgotPasswordEmail(email: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (authClient as any).requestPasswordReset({ email });
  if (error) throw new Error(error.message);
}

export async function resetPassword(password: string, token: string) {
  const { error } = await authClient.resetPassword({ newPassword: password, token });
  if (error) throw new Error(error.message);
}

export function useSession() {
  const { data, isPending, error } = authClient.useSession();
  return { session: data, isLoading: isPending, error };
}

export { authClient as default };
