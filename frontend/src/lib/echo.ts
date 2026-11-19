"use client";

import Echo from "laravel-echo";
import Pusher from "pusher-js";

declare global {
  interface Window {
    Pusher: typeof Pusher;
    Echo?: Echo<"reverb">;
  }
}

function apiOrigin() {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";
  return api.replace(/\/api\/?$/, "");
}

export function getEcho(token: string) {
  if (typeof window === "undefined") return null;

  const key = process.env.NEXT_PUBLIC_REVERB_APP_KEY;
  if (!key) return null;

  window.Pusher = Pusher;

  if (window.Echo) return window.Echo;

  window.Echo = new Echo({
    broadcaster: "reverb",
    key,
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST ?? "localhost",
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT ?? 8080),
    forceTLS: (process.env.NEXT_PUBLIC_REVERB_SCHEME ?? "http") === "https",
    enabledTransports: ["ws", "wss"],
    authEndpoint: `${apiOrigin()}/broadcasting/auth`,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  });

  return window.Echo;
}
