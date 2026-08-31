import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { StockPage } from './features/stock-page/StockPage';
import { HomePage } from './features/home/HomePage';

function StockPageRoute() {
  const { ticker } = useParams<{ ticker: string }>();
  if (!ticker) return <Navigate to="/" replace />;
  return <StockPage ticker={ticker.toUpperCase()} />;
}

export function App() {
  // The home screen is the app's entry point, not a page inside it — it owns
  // the whole viewport and supplies its own (much quieter) auth control.
  const isHome = useLocation().pathname === '/';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {!isHome && <NavBar />}
      <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/stocks/:ticker" element={<StockPageRoute />} />
        </Routes>
      </div>
    </div>
  );
}
