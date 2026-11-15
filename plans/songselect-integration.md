# Song Select Integration - Adding Majdata Button

## Changes to `src/components/AstroSongSelect.jsx`

### 1. Import MajdataModal
```jsx
import MajdataModal from './MajdataModal.jsx';
```

### 2. Add State for Modal
```jsx
const [isMajdataOpen, setIsMajdataOpen] = useState(false);
```

### 3. Add Handler for Import Success (Optional - to auto-select imported map)
```jsx
const handleMajdataImportSuccess = useCallback((songEntry) => {
  if (songEntry && onSelectBeatmap) {
    onSelectBeatmap(songEntry);
  }
  setIsMajdataOpen(false);
}, [onSelectBeatmap]);
```

### 4. Add Majdata Button in Top Bar (near "Add Song (+)" button)

Find the section around line 1074-1086 (the "Add Song (+)" button) and add the Majdata button before or after it:

```jsx
{/* Majdata Import Button */}
<Button
  variant="secondary"
  size="sm"
  onClick={() => { playClick(); setIsMajdataOpen(true); }}
  icon="🎀"
  className="px-3 sm:px-4 py-1.5 text-xs"
  title="Import charts from Majdata.net"
>
  <span className="hidden sm:inline">Majdata</span>
  <span className="sm:hidden">🎀</span>
</Button>

{/* Existing Add Song Button */}
<label className="flex items-center gap-1 px-3 sm:px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#ff85a2] to-[#ff4d80] hover:from-[#ffaec9] hover:to-[#ff6b93] text-white text-xs font-bold cursor-pointer transition-all shadow-[0_2px_12px_rgba(255,77,128,0.25)] hover:scale-105">
  <span>{isImporting ? '⏳' : '🎀'}</span>
  <span className="hidden sm:inline">{isImporting ? 'Importing...' : 'Add Song (+)'}</span>
  <span className="sm:hidden">{isImporting ? '...' : '+'}</span>
  <input
    type="file"
    multiple
    accept=".osz,.zip,.osu,.txt,audio/*,image/*"
    onChange={handleFileUpload}
    className="hidden"
    disabled={isImporting}
  />
</label>
```

### 5. Add MajdataModal at the bottom of the component (before closing div)

```jsx
{/* Majdata Import Modal */}
<MajdataModal
  isOpen={isMajdataOpen}
  onClose={() => setIsMajdataOpen(false)}
  onImportSuccess={handleMajdataImportSuccess}
/>
```

## Button Styling Notes

The Majdata button uses `variant="secondary"` which should match the Kawaii design system. If a secondary variant doesn't exist in the Button component, you may need to add it or use a custom style:

```jsx
// Custom style matching Kawaii theme
className="px-3 sm:px-4 py-1.5 rounded-full bg-[#fff0f5] hover:bg-[#ffe5ec] text-[#ff4d80] hover:text-[#c33b5d] text-xs font-bold transition-all border border-[#f3dbe4] hover:border-[#ff85a2] cursor-pointer hover:scale-105 shadow-sm flex items-center gap-1"
```

## Complete Integration Checklist

- [ ] Import MajdataModal component
- [ ] Add `isMajdataOpen` state
- [ ] Add `handleMajdataImportSuccess` callback
- [ ] Add Majdata button in top bar (next to Add Song)
- [ ] Add MajdataModal at bottom of component
- [ ] Test: Button opens modal
- [ ] Test: Browse tab loads charts
- [ ] Test: Search/filter works
- [ ] Test: Download & Import works end-to-end
- [ ] Test: Imported map appears in Song Select
- [ ] Test: Website tab shows fallback when iframe blocked
- [ ] Test: Direct import tab parses URL and imports
- [ ] Test: Progress UI shows during download/import
- [ ] Test: Toast notifications for success/error
- [ ] Test: Responsive on mobile
- [ ] Test: Keyboard accessible (Esc to close)