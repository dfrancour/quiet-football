"use client";

import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

function subscribe(listener: () => void): () => void {
  return onlineManager.subscribe(listener);
}

function getOnline(): boolean {
  return onlineManager.isOnline();
}

function getServerOnline(): boolean {
  return true;
}

/** Whether the query layer believes the browser has a connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getOnline, getServerOnline);
}
