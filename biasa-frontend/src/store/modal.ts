import { create } from 'zustand'

// Modal d'alerte/confirmation "maison", pour remplacer window.alert() et
// window.confirm() : ces derniers affichent une popup gérée par le
// navigateur avec la mention "localhost dit" / "cette page dit", que l'on
// ne veut plus voir. afficherAlerte() et demanderConfirmation() ouvrent à
// la place notre propre modal (mêmes styles que le reste de l'appli) et
// renvoient une Promise, à utiliser avec await.

type TypeModal = 'alert' | 'confirm'

interface ModalState {
  ouvert: boolean
  type: TypeModal
  titre: string
  message: string
  resolve: ((v: boolean) => void) | null
}

export const useModalStore = create<ModalState>(() => ({
  ouvert: false,
  type: 'alert',
  titre: '',
  message: '',
  resolve: null,
}))

function ouvrir(type: TypeModal, message: string, titre: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    useModalStore.setState({
      ouvert: true,
      type,
      titre,
      message,
      resolve: (v: boolean) => {
        resolve(v)
        useModalStore.setState({ ouvert: false, resolve: null })
      },
    })
  })
}

export function afficherAlerte(message: string, titre = 'Information'): Promise<void> {
  return ouvrir('alert', message, titre).then(() => undefined)
}

export function demanderConfirmation(message: string, titre = 'Confirmation'): Promise<boolean> {
  return ouvrir('confirm', message, titre)
}
