/**
 * UI Visibility State Slice
 * Manages ephemeral per-view UI panel visibility so that multiple Atlas views
 * (e.g. two maps side-by-side) have independent panel states.
 *
 * NOT persisted — the partialize whitelist in storeFactory.ts excludes these.
 */

/** State fields added to ViewAtlasState */
export interface UISlice {
  // Panel visibility
  isGridSettingsOpen: boolean;
  isDMDashboardOpen: boolean;
  isGridAlignmentOpen: boolean;
  isDiceLogOpen: boolean;
  isAssetManagerOpen: boolean;
  assetManagerInitialTab?: 'scenes' | 'maps' | 'encounters' | 'tokens' | undefined;
  isCommandPaletteOpen: boolean;
  isDiceTrayOpen: boolean;
  /** The map object a completed click (press and release without a drag) last landed on; cleared when its card closes. */
  clickedObjectId: string | null;

  // Actions
  setGridSettingsOpen: (open: boolean) => void;
  setDMDashboardOpen: (open: boolean) => void;
  setGridAlignmentOpen: (open: boolean) => void;
  setDiceLogOpen: (open: boolean) => void;
  openAssetManager: (tab?: UISlice['assetManagerInitialTab']) => void;
  closeAssetManager: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setDiceTrayOpen: (open: boolean) => void;
  setClickedObjectId: (id: string | null) => void;
}

/** Default state — all panels closed */
export function createInitialUIState(): Pick<
  UISlice,
  | 'isGridSettingsOpen'
  | 'isDMDashboardOpen'
  | 'isGridAlignmentOpen'
  | 'isDiceLogOpen'
  | 'isAssetManagerOpen'
  | 'assetManagerInitialTab'
  | 'isCommandPaletteOpen'
  | 'isDiceTrayOpen'
  | 'clickedObjectId'
> {
  return {
    isGridSettingsOpen: false,
    isDMDashboardOpen: false,
    isGridAlignmentOpen: false,
    isDiceLogOpen: false,
    isAssetManagerOpen: false,
    assetManagerInitialTab: undefined,
    isCommandPaletteOpen: false,
    isDiceTrayOpen: false,
    clickedObjectId: null,
  };
}

/** Action creators — `set` comes from the immer middleware in the store */
export function createUIActions(
  set: (fn: (draft: UISlice) => void) => void,
): Pick<
  UISlice,
  | 'setGridSettingsOpen'
  | 'setDMDashboardOpen'
  | 'setGridAlignmentOpen'
  | 'setDiceLogOpen'
  | 'openAssetManager'
  | 'closeAssetManager'
  | 'setCommandPaletteOpen'
  | 'setDiceTrayOpen'
  | 'setClickedObjectId'
> {
  return {
    setGridSettingsOpen: (open) => set((draft) => { draft.isGridSettingsOpen = open; }),
    setDMDashboardOpen: (open) => set((draft) => { draft.isDMDashboardOpen = open; }),
    setGridAlignmentOpen: (open) => set((draft) => { draft.isGridAlignmentOpen = open; }),
    setDiceLogOpen: (open) => set((draft) => { draft.isDiceLogOpen = open; }),
    openAssetManager: (tab) => set((draft) => {
      draft.isAssetManagerOpen = true;
      draft.assetManagerInitialTab = tab;
    }),
    closeAssetManager: () => set((draft) => {
      draft.isAssetManagerOpen = false;
      draft.assetManagerInitialTab = undefined;
    }),
    setCommandPaletteOpen: (open) => set((draft) => { draft.isCommandPaletteOpen = open; }),
    setDiceTrayOpen: (open) => set((draft) => { draft.isDiceTrayOpen = open; }),
    setClickedObjectId: (id) => set((draft) => { draft.clickedObjectId = id; }),
  };
}
