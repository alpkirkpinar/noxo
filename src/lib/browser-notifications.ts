"use client"

export type NoxoNotificationType = "success" | "info" | "error"

export type NoxoNotificationPayload = {
  message: string
  type?: NoxoNotificationType
}

export function pushBrowserNotification(payload: NoxoNotificationPayload) {
  if (typeof window === "undefined") return

  const message = String(payload.message ?? "").trim()
  if (!message) return

  window.dispatchEvent(
    new CustomEvent("noxo:notification", {
      detail: {
        message,
        type: payload.type ?? "success",
      },
    })
  )
}
