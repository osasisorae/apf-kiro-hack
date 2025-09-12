import './globals.css'
import './dashboard/dashboard.css'
import { Providers } from './providers'

export const metadata = {
  title: 'Aurum Prop Firm - Discipline, Enforced',
  description: 'The world\'s first agentic prop firm is coming. We\'ve built a system that curbs fear and greed, forcing the habits of elite traders.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://s3.tradingview.com/tv.js"></script>
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
