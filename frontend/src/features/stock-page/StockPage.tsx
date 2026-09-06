import { useSearchParams } from 'react-router-dom';
import { StockHeader } from './StockHeader';
import { PriceChart } from './PriceChart';
import { AiSummary } from './AiSummary';
import { CompanyOverview } from './CompanyOverview';
import { FinancialStatements } from './FinancialStatements';
import { NewsSection } from './NewsSection';
import { Assistant } from './assistant/Assistant';
import { useOverview } from './hooks/useOverview';
import { useIsMobile } from '../../hooks/useMediaQuery';

interface StockPageProps {
  ticker: string;
}

const TABS = [
  { id: 'business', label: 'Business' },
  { id: 'financials', label: 'Financials' },
  { id: 'about', label: 'About' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function StockPage({ ticker }: StockPageProps) {
  // Fetched once here and passed down — several sections need it (name, tags,
  // industry) and it hits SEC EDGAR under the hood, so it's worth not tripling.
  const overview = useOverview(ticker);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileStockPage ticker={ticker} overview={overview} />;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <div className="stock-page-grid">
        <div className="col-primary">
          <StockHeader ticker={ticker} overview={overview} />
          <PriceChart ticker={ticker} />
          <AiSummary ticker={ticker} overview={overview} />
          <FinancialStatements ticker={ticker} />
          <Assistant ticker={ticker} overview={overview} />
        </div>
        <div className="col-secondary">
          <CompanyOverview overview={overview} />
          <NewsSection ticker={ticker} />
        </div>
      </div>
    </main>
  );
}

/** Narrow layout: the header and chart stay put as the page's constant — they
 *  identify the stock, so they don't belong behind a tab — and everything
 *  below them is grouped into one-at-a-time sections. This is also what
 *  rescues the desktop rail's content: stacked, the overview and news land at
 *  the bottom of a very long scroll where nobody reaches them; as a tab
 *  they're one tap away. */
function MobileStockPage({ ticker, overview }: { ticker: string; overview: ReturnType<typeof useOverview> }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : 'business';

  function selectTab(next: TabId) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    // replace, not push: flipping between tabs shouldn't stack up history
    // entries the back button then has to walk through to leave the page.
    setSearchParams(params, { replace: true });
  }

  return (
    <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', overflowX: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--section-gap)',
          padding: 'var(--section-gap) var(--page-padding) 0',
        }}
      >
        <StockHeader ticker={ticker} overview={overview} />
        <PriceChart ticker={ticker} />
      </div>

      {/* Sticky so switching sections never means scrolling back up to find
          the control you switched with. */}
      <div
        role="tablist"
        aria-label="Stock sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          gap: 2,
          margin: 'var(--section-gap) 0 0',
          padding: '10px var(--page-padding)',
          background: 'var(--color-bg)',
          boxShadow: '0 1px 0 var(--color-divider)',
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              style={{
                flex: 1,
                minHeight: 'var(--tap-min)',
                padding: '0 8px',
                font: '500 14px var(--font-body)',
                cursor: 'pointer',
                background: active ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
                border: '1px solid',
                borderColor: active ? 'color-mix(in srgb, var(--color-accent) 55%, transparent)' : 'var(--color-divider)',
                borderRadius: 'var(--radius-md)',
                color: active ? 'var(--color-accent-400)' : 'var(--color-neutral-400)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* --composer-clearance keeps the last thing in every tab able to
          scroll clear of the docked composer. */}
      <div
        role="tabpanel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--section-gap)',
          padding: 'var(--section-gap) var(--page-padding) var(--composer-clearance)',
        }}
      >
        {tab === 'business' && <AiSummary ticker={ticker} overview={overview} />}
        {tab === 'financials' && <FinancialStatements ticker={ticker} />}
        {tab === 'about' && (
          <>
            <CompanyOverview overview={overview} />
            <NewsSection ticker={ticker} />
          </>
        )}
      </div>

      <Assistant ticker={ticker} overview={overview} />
    </main>
  );
}
