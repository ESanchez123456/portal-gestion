/** @type {import('next').NextConfig} */
// Exportación estática: genera /out con HTML/JS/CSS puros (sin servidor Node),
// listo para subir a SharePoint o a un sitio estático interno.
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // Si TI lo publica en una subruta, definir NEXT_PUBLIC_BASE_PATH (ej. /sites/gestion/portal)
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
};
export default nextConfig;
