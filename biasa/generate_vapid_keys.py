"""Génère les clés VAPID nécessaires aux notifications push navigateur.
À exécuter UNE SEULE FOIS sur le serveur, après avoir installé les
dépendances (pip install -r requirements.txt, qui installe pywebpush et
py_vapid).

Usage :
    python generate_vapid_keys.py

Écrit vapid_private_key.pem dans le dossier courant (NE PAS committer ce
fichier — il doit rester uniquement sur le serveur) et affiche la clé
publique à mettre dans le fichier .env (VAPID_PUBLIC_KEY=...).
"""
from py_vapid import Vapid02
from cryptography.hazmat.primitives import serialization
import base64


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def main():
    vapid = Vapid02()
    vapid.generate_keys()
    vapid.save_key("vapid_private_key.pem")

    public_bytes = vapid.public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    cle_publique = b64url(public_bytes)

    print("\nClés VAPID générées avec succès.")
    print("Fichier créé : vapid_private_key.pem (ne pas committer, ne pas partager)")
    print("\nAjoute cette ligne dans biasa/.env :")
    print(f"VAPID_PUBLIC_KEY={cle_publique}")
    print("VAPID_PRIVATE_KEY_PATH=./vapid_private_key.pem")
    print("VAPID_CLAIMS_EMAIL=mailto:ton-adresse@exemple.com")
    print("\nPuis redémarre le service backend (sudo systemctl restart biasa-backend).")


if __name__ == "__main__":
    main()
