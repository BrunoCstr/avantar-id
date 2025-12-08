/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Configuração vazia do Turbopack para permitir uso do webpack
  turbopack: {},
  // Configuração do webpack para resolver módulos Node.js no lado do cliente
  webpack: (config, { isServer }) => {
    // Resolver apenas os módulos Node.js mais problemáticos
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        'node:fs': false,
        'node:net': false,
        'node:tls': false,
        'node:crypto': false,
        'node:stream': false,
      }
    }
    
    return config
  },
}

export default nextConfig
