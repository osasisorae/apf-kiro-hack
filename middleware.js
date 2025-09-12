import { withAuth } from 'next-auth/middleware'

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl
        
        // Allow access to login page and home page
        if (pathname === '/login' || pathname === '/') {
          return true
        }
        
        // Require authentication for protected routes
        if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
          if (!token) return false
          
          // Admin routes require admin role
          if (pathname.startsWith('/admin') && token.role !== 'admin') {
            return false
          }
          
          return true
        }
        
        return true
      }
    }
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*']
}