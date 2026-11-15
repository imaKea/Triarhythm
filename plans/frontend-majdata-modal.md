# Frontend: MajdataModal Component (`src/components/MajdataModal.jsx`)

```jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Input,
  Dropdown,
  Toast,
  Skeleton,
  Spinner,
  ProgressBar,
  Tabs,
  TabPanel,
  IconButton,
  Tooltip,
} from '../ui/index.js';
import {
  fetchChartList,
  fetchChartSummary,
  downloadChartAssets,
  createImportFileList,
  parseChartIdFromUrl,
} from '../core/api/majdata.js';
import { importFiles } from '../core/parser/index.js';
import { toast } from '../ui/index.js';

export default function MajdataModal({
  isOpen,
  onClose,
  onImportSuccess,
}) {
  // ===== STATE =====
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'website' | 'direct'
  
  // Browse tab state
  const [charts, setCharts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [chartsError, setChartsError] = useState(null);
  const abortControllerRef = useRef(null);
  
  // Website tab state
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const iframeRef = useRef(null);
  
  // Direct import tab state
  const [directInput, setDirectInput] = useState('');
  const [directPreview, setDirectPreview] = useState(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Import progress state (shared)
  const [importProgress, setImportProgress] = useState(null); // { stage, progress, message, chartId }
  const [isImporting, setIsImporting] = useState(false);
  const importAbortRef = useRef(null);
  
  // Track imported chart IDs to show "Already imported" badge
  const [importedChartIds, setImportedChartIds] = useState(new Set());

  // ===== EFFECTS =====
  
  // Load chart list when browse tab is active
  useEffect(() => {
    if (activeTab !== 'browse') return;
    
    loadCharts();
  }, [activeTab, pagination.page, sortBy]);

  // Debounced search
  const searchTimeoutRef = useRef(null);
  const handleSearch = useCallback((query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }));
      loadCharts();
    }, 300);
  }, []);

  // Load charts from API
  const loadCharts = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    
    setIsLoadingCharts(true);
    setChartsError(null);
    
    try {
      const result = await fetchChartList({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        sort: sortBy,
      }, abortControllerRef.current.signal);
      
      setCharts(result.charts);
      setPagination(prev => ({ ...prev, ...result.pagination }));
    } catch (err) {
      if (err.name !== 'AbortError') {
        setChartsError(err.message);
        toast.error('Failed to load charts: ' + err.message);
      }
    } finally {
      setIsLoadingCharts(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, sortBy]);

  // Check iframe load status
  useEffect(() => {
    if (activeTab !== 'website') return;
    
    const timer = setTimeout(() => {
      if (!iframeLoaded) setIframeError(true);
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [activeTab, iframeLoaded]);

  // Load imported chart IDs from IndexedDB on mount
  useEffect(() => {
    loadImportedChartIds();
  }, []);

  const loadImportedChartIds = async () => {
    try {
      const { dbManager } = await import('../core/storage/db.js');
      const allMaps = await dbManager.getAllBeatmaps({ includeDeleted: false });
      const ids = new Set(
        allMaps
          .map(m => m.metadata?.id || m.id)
          .filter(id => id && id.startsWith('maimai_'))
      );
      setImportedChartIds(ids);
    } catch (e) {
      console.warn('Could not load imported chart IDs:', e);
    }
  };

  // ===== HANDLERS =====

  // Handle chart card "Download & Import" click
  const handleDownloadAndImport = async (chart) => {
    if (isImporting) return;
    
    const chartId = chart.id;
    if (importedChartIds.has(chartId)) {
      const confirm = window.confirm(
        `"${chart.title}" appears to be already imported. Import again (overwrite)?`
      );
      if (!confirm) return;
    }
    
    setIsImporting(true);
    importAbortRef.current = new AbortController();
    
    try {
      // Download all assets with progress
      const assets = await downloadChartAssets(chartId, {
        onProgress: (stage, progress, message) => {
          setImportProgress({ stage, progress, message, chartId });
        },
      }, importAbortRef.current.signal);
      
      // Create file list for import
      setImportProgress({ stage: 'import', progress: 90, message: 'Importing into game...', chartId });
      const fileList = createImportFileList(assets);
      
      // Import using existing pipeline
      const result = await importFiles(fileList, {
        preset: 'twoFingers',
        autoSlide: false,
        overwrite: true,
      });
      
      // Mark as imported
      setImportedChartIds(prev => new Set([...prev, chartId]));
      
      toast.success(`Successfully imported "${chart.title}"! 🎀`);
      
      if (onImportSuccess) {
        onImportSuccess(result.songEntry);
      }
      
      setImportProgress(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Import failed: ' + err.message);
        setImportProgress(null);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // Handle cancel import
  const handleCancelImport = () => {
    if (importAbortRef.current) importAbortRef.current.abort();
    setIsImporting(false);
    setImportProgress(null);
  };

  // Handle direct import tab - preview chart
  const handlePreviewDirect = async () => {
    const chartId = parseChartIdFromUrl(directInput);
    if (!chartId) {
      toast.error('Invalid Majdata URL or ID');
      return;
    }
    
    setIsLoadingPreview(true);
    try {
      const summary = await fetchChartSummary(chartId);
      setDirectPreview(summary);
    } catch (err) {
      toast.error('Failed to fetch chart: ' + err.message);
      setDirectPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // Handle direct import
  const handleDirectImport = async () => {
    if (!directPreview) return;
    await handleDownloadAndImport(directPreview);
  };

  // Handle iframe load
  const handleIframeLoad = () => {
    setIframeLoaded(true);
    setIframeError(false);
  };

  // Handle iframe error
  const handleIframeError = () => {
    setIframeError(true);
  };

  // ===== RENDER HELPERS =====

  const renderBrowseTab = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Search & Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-[#fff8fa] border-b border-[#f3dbe4]">
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#ff4d80] text-xs">🔍</span>
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search charts... (title, artist, designer)"
            className="w-full pl-9 pr-4 py-2 rounded-full bg-white border border-[#f3dbe4] focus:border-[#ff4d80] outline-none text-sm text-[#5b2a47] placeholder-[#a8556f]"
          />
        </div>
        <Dropdown
          value={sortBy}
          onChange={setSortBy}
          options={[
            { value: 'newest', label: 'Newest 🆕' },
            { value: 'oldest', label: 'Oldest 📜' },
            { value: 'popular', label: 'Most Popular ⭐' },
            { value: 'rating', label: 'Highest Rating 💯' },
            { value: 'title', label: 'Title (A-Z) 🔤' },
          ]}
          className="w-full sm:w-40"
        />
      </div>

      {/* Charts Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {isLoadingCharts && charts.length === 0 ? (
          // Skeleton loading
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] animate-pulse">
              <div className="flex items-center gap-3">
                <Skeleton className="w-16 h-16 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <Skeleton className="h-3 w-1/3 rounded" />
                </div>
              </div>
            </div>
          ))
        ) : chartsError ? (
          <div className="p-8 text-center text-[#c33b5d]">
            <p className="font-bold mb-2">Failed to load charts</p>
            <p className="text-sm text-[#a8556f] mb-4">{chartsError}</p>
            <Button variant="primary" size="sm" onClick={loadCharts} icon="🔄">
              Retry
            </Button>
          </div>
        ) : charts.length === 0 ? (
          <div className="p-8 text-center text-[#a8556f]">
            <p className="font-bold mb-2">No charts found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            {charts.map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                isImported={importedChartIds.has(chart.id)}
                isImporting={isImporting && importProgress?.chartId === chart.id}
                importProgress={isImporting && importProgress?.chartId === chart.id ? importProgress : null}
                onImport={handleDownloadAndImport}
              />
            ))}
            
            {/* Load More / Pagination */}
            {pagination.page < pagination.totalPages && (
              <div className="text-center pt-4">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={isLoadingCharts}
                  className="w-full sm:w-auto"
                >
                  {isLoadingCharts ? 'Loading...' : `Load More (Page ${pagination.page + 1} / ${pagination.totalPages})`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderWebsiteTab = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 bg-[#fff8fa] border-b border-[#f3dbe4]">
        <p className="text-sm text-[#5b2a47] mb-3">
          Browse Majdata.net directly. If the site doesn't load below, use the button to open in a new tab.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.open('https://majdata.net', '_blank', 'noopener,noreferrer')}
          icon="🔗"
          className="w-full sm:w-auto"
        >
          Open majdata.net in New Tab
        </Button>
      </div>
      
      <div className="flex-1 relative min-h-0">
        {iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#fff8fa] z-10 p-4">
            <div className="text-center">
              <p className="font-bold text-[#c33b5d] mb-2">Unable to embed Majdata.net</p>
              <p className="text-sm text-[#a8556f] mb-4">
                The site blocks embedding (X-Frame-Options). Please use the button above to open in a new tab,
                or use the "Direct Import" tab to paste a chart link/ID.
              </p>
              <Button
                variant="primary"
                onClick={() => window.open('https://majdata.net', '_blank', 'noopener,noreferrer')}
                icon="🔗"
              >
                Open in New Tab
              </Button>
            </div>
          </div>
        )}
        
        <iframe
          ref={iframeRef}
          src="https://majdata.net"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer-when-downgrade"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Majdata.net"
        />
        
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#fff8fa] z-5">
            <div className="text-center">
              <Spinner size="lg" color="#ff4d80" />
              <p className="mt-3 text-sm text-[#a8556f]">Loading Majdata.net...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderDirectTab = () => (
    <div className="flex flex-col h-full min-h-0 p-4 space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-[#5b2a47]">
          Paste Majdata Chart URL or ID
        </label>
        <div className="relative">
          <Input
            type="text"
            value={directInput}
            onChange={(e) => setDirectInput(e.target.value)}
            placeholder="https://majdata.net/chart/12345 or just 12345"
            className="w-full pr-10"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={handlePreviewDirect}
            disabled={isLoadingPreview || !directInput.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            {isLoadingPreview ? '⏳' : 'Preview'}
          </Button>
        </div>
        <p className="text-xs text-[#a8556f]">
          Supported formats: majdata.net/chart/ID, majdata.net/#/chart/ID, or just the chart ID
        </p>
      </div>

      {directPreview && (
        <div className="p-4 rounded-2xl bg-[#fff8fa] border border-[#f3dbe4] space-y-3">
          <div className="flex items-center gap-3">
            {directPreview.coverUrl ? (
              <img src={directPreview.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[#f3dbe4] flex items-center justify-center text-xl">🎵</div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-[#5b2a47] truncate">{directPreview.title}</h4>
              <p className="text-sm text-[#ff4d80] truncate">{directPreview.artist}</p>
              <p className="text-xs text-[#a8556f]">Designer: {directPreview.designer}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-[#ff4d80]/10 text-[#ff4d80] text-xs font-bold">
                  {directPreview.category} {directPreview.level}
                </span>
                {directPreview.bpm && (
                  <span className="px-2 py-0.5 rounded-full bg-[#f3dbe4] text-[#5b2a47] text-xs font-mono font-bold">
                    {directPreview.bpm} BPM
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <Button
            variant="primary"
            size="md"
            onClick={handleDirectImport}
            disabled={isImporting}
            icon="📥"
            className="w-full"
          >
            {isImporting ? 'Importing...' : 'Download & Import This Chart'}
          </Button>
        </div>
      )}

      {isImporting && importProgress && (
        <ImportProgressDisplay progress={importProgress} onCancel={handleCancelImport} />
      )}
    </div>
  );

  // ===== MAIN RENDER =====
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Majdata Import 🎀"
      description="Browse, search, and import charts from Majdata.net directly into Triarhythm"
      size="xl"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh] min-h-0">
        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab} className="shrink-0">
          <Tabs.List className="bg-[#fff8fa] border-b border-[#f3dbe4] p-1 rounded-xl">
            <Tabs.Trigger value="browse" className="px-4 py-2">
              🔍 Browse Charts
            </Tabs.Trigger>
            <Tabs.Trigger value="website" className="px-4 py-2">
              🌐 Majdata.net
            </Tabs.Trigger>
            <Tabs.Trigger value="direct" className="px-4 py-2">
              📋 Direct Import
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {/* Tab Panels */}
        <Tabs.Content value="browse" className="flex-1 min-h-0">
          {renderBrowseTab()}
        </Tabs.Content>
        
        <Tabs.Content value="website" className="flex-1 min-h-0">
          {renderWebsiteTab()}
        </Tabs.Content>
        
        <Tabs.Content value="direct" className="flex-1 min-h-0 overflow-y-auto">
          {renderDirectTab()}
        </Tabs.Content>

        {/* Global Import Progress Overlay */}
        {isImporting && importProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl animate-fadeIn">
              <ImportProgressDisplay progress={importProgress} onCancel={handleCancelImport} />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ===== SUB-COMPONENTS =====

function ChartCard({ chart, isImported, isImporting, importProgress, onImport }) {
  const isDownloading = isImporting && importProgress?.stage !== 'import';
  
  return (
    <div className="p-3 rounded-2xl bg-white border border-[#f3dbe4] hover:border-[#ff85a2] transition-colors relative group">
      {isImported && (
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-[#f3dbe4] text-[#5b2a47] text-[10px] font-bold">
          ✓ Imported
        </span>
      )}
      
      <div className="flex items-start gap-3">
        {/* Cover */}
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#fff1f5] shrink-0 border border-[#f3dbe4] relative">
          {chart.coverUrl ? (
            <img 
              src={chart.coverUrl} 
              alt="" 
              className="w-full h-full object-cover" 
              loading="lazy"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🎵</span>
          )}
          
          {isDownloading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold">
              {importProgress?.message || 'Downloading...'}
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <h4 className="font-black text-[#5b2a47] truncate">{chart.title}</h4>
          <p className="text-sm text-[#ff4d80] truncate">{chart.artist}</p>
          <p className="text-xs text-[#a8556f] truncate">Designer: {chart.designer}</p>
          
          <div className="flex flex-wrap gap-1.5 mt-1">
            <span className="px-2 py-0.5 rounded-full bg-[#ff4d80]/10 text-[#ff4d80] text-xs font-bold">
              {chart.category} {chart.level}
            </span>
            {chart.bpm && (
              <span className="px-2 py-0.5 rounded-full bg-[#f3dbe4] text-[#5b2a47] text-xs font-mono font-bold">
                {chart.bpm} BPM
              </span>
            )}
            {chart.isRanking && (
              <span className="px-2 py-0.5 rounded-full bg-[#fff5eb] text-[#e78b21] text-xs font-bold">
                ⭐ Ranking
              </span>
            )}
          </div>
        </div>
        
        {/* Import Button */}
        <Button
          variant={isImported ? 'ghost' : 'primary'}
          size="sm"
          onClick={() => onImport(chart)}
          disabled={isImporting || isDownloading}
          icon={isImporting ? '⏳' : '📥'}
          className="shrink-0 h-fit"
        >
          {isImported ? 'Imported' : isDownloading ? 'Downloading...' : 'Import'}
        </Button>
      </div>
      
      {/* Progress bar for this card */}
      {isImporting && importProgress && (
        <ProgressBar
          value={importProgress.progress}
          max={100}
          className="mt-3 h-1.5"
          showLabel={false}
          color={importProgress.stage === 'import' ? '#ff4d80' : '#6c5ce7'}
        />
      )}
    </div>
  );
}

function ImportProgressDisplay({ progress, onCancel }) {
  const stageLabels = {
    summary: 'Fetching chart info...',
    chart: 'Downloading chart data...',
    track: 'Downloading audio track...',
    image: 'Downloading cover image...',
    video: 'Checking for video...',
    import: 'Importing into game...',
    complete: 'Complete!',
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[#5b2a47]">
          {stageLabels[progress.stage] || progress.message}
        </span>
        <span className="text-sm font-mono text-[#ff4d80]">{progress.progress}%</span>
      </div>
      <ProgressBar
        value={progress.progress}
        max={100}
        className="h-2"
        showLabel={false}
        color={progress.stage === 'import' ? '#ff4d80' : '#6c5ce7'}
      />
      <p className="text-xs text-[#a8556f]">{progress.message}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="w-full"
      >
        Cancel
      </Button>
    </div>
  );
}