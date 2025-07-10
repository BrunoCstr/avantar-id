import React from 'react'

interface LoadingScreenProps {
  title?: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export function LoadingScreen({ 
  title = "Carregando...", 
  subtitle,
  size = 'md',
  fullScreen = true 
}: LoadingScreenProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 border-b-2',
    md: 'h-12 w-12 border-b-3',
    lg: 'h-16 w-16 border-b-4'
  }

  const containerClasses = fullScreen 
    ? "min-h-screen bg-gradient-to-br from-purple-50 to-white flex items-center justify-center"
    : "flex items-center justify-center py-12"

  return (
    <div className={containerClasses}>
      <div className="text-center">
        <div className={`animate-spin rounded-full ${sizeClasses[size]} border-[#6600CC] mx-auto mb-6`}></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">{title}</h2>
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
    </div>
  )
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3'
  }

  return (
    <div className={`animate-spin rounded-full ${sizeClasses[size]} border-[#6600CC] border-t-transparent`}></div>
  )
} 