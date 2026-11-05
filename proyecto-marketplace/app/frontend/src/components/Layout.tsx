import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'
import { AvisoVerificacion } from './AvisoVerificacion'

export function Layout() {
  return (
    <>
      <Header />
      <AvisoVerificacion />
      <main className="page">
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
