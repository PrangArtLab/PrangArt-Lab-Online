import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ToastContainer } from './components/ToastContainer';
import { WaModal } from './components/WaModal';
import { StudioProvider } from './context/StudioContext';
import { ThemeProvider } from './context/ThemeContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { ClientPortalPage } from './pages/ClientPortalPage';
import { HomePage } from './pages/HomePage';
import { OrderPage } from './pages/OrderPage';
import { PortfolioPage } from './pages/PortfolioPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <StudioProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
            <Navbar />
            <ToastContainer />
            <WaModal />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/portofolio" element={<PortfolioPage />} />
                <Route path="/pemesanan" element={<OrderPage />} />
                <Route path="/klien" element={<ClientPortalPage />} />
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </StudioProvider>
    </ThemeProvider>
  );
}
