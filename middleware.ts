import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rotas que requerem autenticação
  const protectedRoutes = ['/dashboard', '/admin']
  const adminOnlyRoutes = ['/admin']
  
  // Verificar se a rota atual é protegida
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route))
  
  // Se não for uma rota protegida, continuar normalmente
  if (!isProtectedRoute) {
    return NextResponse.next()
  }

  try {
    // Verificar se há token de autenticação nos cookies
    const sessionCookie = request.cookies.get('__session')?.value
    
    console.log('Middleware - Rota:', pathname, 'Session Cookie:', sessionCookie ? 'Presente' : 'Ausente')
    
    if (!sessionCookie) {
      console.log('Redirecionando para login - sem session cookie')
      // Se não há sessão, redirecionar para login
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Verificar se o token é válido
    const response = await fetch(new URL('/api/auth/verify', request.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        sessionCookie,
        checkAdmin: isAdminRoute 
      })
    })

    if (!response.ok) {
      console.log('Redirecionando para login - token inválido')
      return NextResponse.redirect(new URL('/', request.url))
    }

    const verificationResult = await response.json()
    
    if (!verificationResult.valid) {
      console.log('Redirecionando para login - verificação falhou')
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Para rotas admin, verificar se o usuário é admin
    if (isAdminRoute && !verificationResult.isAdmin) {
      console.log('Redirecionando para dashboard - não é admin')
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    console.log('Middleware - Permitindo acesso à rota:', pathname)
    // Usuário autenticado, continuar
    return NextResponse.next()

  } catch (error) {
    console.error('Erro no middleware de autenticação:', error)
    // Em caso de erro, redirecionar para login por segurança
    return NextResponse.redirect(new URL('/', request.url))
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*'
  ]
} 