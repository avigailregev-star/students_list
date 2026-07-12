import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'רותי – מעקב נוכחות',
    short_name: 'רותי',
    description: 'אפליקציית מעקב נוכחות למורים | קונסרבטוריון דימונה',
    start_url: '/',
    display: 'standalone',
    background_color: '#114F32',
    theme_color: '#114F32',
    lang: 'he',
    dir: 'rtl',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
