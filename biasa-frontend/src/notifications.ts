// Abonnement aux notifications push navigateur. Fonctionnalité optionnelle :
// si le backend n'a pas encore de clé VAPID configurée (voir
// generate_vapid_keys.py côté serveur) ou si le navigateur ne supporte pas
// les notifications, ces fonctions échouent proprement sans planter l'appli.
import client from './api/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export type EtatNotifications = 'actives' | 'inactives' | 'refusees' | 'indisponibles'

export async function etatNotifications(): Promise<EtatNotifications> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponibles'
  if (Notification.permission === 'denied') return 'refusees'
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = registration ? await registration.pushManager.getSubscription() : null
    return subscription ? 'actives' : 'inactives'
  } catch {
    return 'inactives'
  }
}

export async function activerNotifications(): Promise<EtatNotifications> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'indisponibles'

  const { data } = await client.get<{ cle_publique: string }>('/notifications/cle-publique')
  if (!data.cle_publique) return 'indisponibles'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'refusees'

  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.cle_publique) as BufferSource,
  })
  const json = subscription.toJSON()
  await client.post('/notifications/abonnement', {
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  })
  return 'actives'
}

export async function desactiverNotifications(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = registration ? await registration.pushManager.getSubscription() : null
  if (subscription) {
    await client.delete('/notifications/abonnement', { params: { endpoint: subscription.endpoint } })
    await subscription.unsubscribe()
  }
}
