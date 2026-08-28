import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { StockPage } from './features/stock-page/StockPage';

function StockPageRoute() {
  const { ticker } = useParams<{ ticker: string }>();
  if (!ticker) return <Navigate to="/" replace />;
  return <StockPage ticker={ticker.toUpperCase()} />;
}

function Landing() {
  return (
    <main style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--color-neutral-500)', fontSize: 14 }}>
      Search for a ticker to begin.
    </main>
  );
}

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <NavBar />
      <div style={{ position: 'relative', display: 'flex', flex: 1, minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/stocks/:ticker" element={<StockPageRoute />} />
        </Routes>
      </div>
    </div>
  );
}
