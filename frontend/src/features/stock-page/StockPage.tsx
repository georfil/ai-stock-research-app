import { StockHeader } from './StockHeader';
import { PriceChart } from './PriceChart';
import { AiSummary } from './AiSummary';
import { CompanyOverview } from './CompanyOverview';
import { FinancialStatements } from './FinancialStatements';
import { NewsSection } from './NewsSection';
import { Assistant } from './assistant/Assistant';
import { useOverview } from './hooks/useOverview';

interface StockPageProps {
  ticker: string;
}

export function StockPage({ ticker }: StockPageProps) {
  // Fetched once here and passed down — several sections need it (name, tags,
  // industry) and it hits SEC EDGAR under the hood, so it's worth not tripling.
  const overview = useOverview(ticker);

  return (
    <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <div className="stock-page-grid" style={{ maxWidth: 1720, margin: '0 auto', padding: '36px clamp(24px, 4vw, 64px) 96px' }}>
        <div className="col-primary">
          <StockHeader ticker={ticker} overview={overview} />
          <PriceChart ticker={ticker} />
          <AiSummary ticker={ticker} overview={overview} />
          <FinancialStatements ticker={ticker} />
          <Assistant ticker={ticker} />
        </div>
        <div className="col-secondary">
          <CompanyOverview ticker={ticker} overview={overview} />
          <NewsSection />
        </div>
      </div>
    </main>
  );
}
