import { StockHeader } from './StockHeader';

interface StockPageProps {
  ticker: string;
}

export function StockPage({ ticker }: StockPageProps) {
  return (
    <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '26px 34px 132px' }}>
      <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 34 }}>
        <StockHeader ticker={ticker} />
      </div>
    </main>
  );
}
