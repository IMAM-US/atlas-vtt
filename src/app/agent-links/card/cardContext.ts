import { createContext, useContext } from 'react';
import type { App } from 'obsidian';
import type { NativeSources } from '../NativeSources';
import type { LoadedAccount } from '../reads';

export interface CardContextValue {
  app: App;
  sources: NativeSources;
  loaded: LoadedAccount;
  /** Opens another subject of the same account in this card (relations, members, conveners). */
  openSubject: (subjectId: string) => void;
}

export const CardContext = createContext<CardContextValue | null>(null);

export function useCard(): CardContextValue {
  const value = useContext(CardContext);
  if (!value) throw new Error('useCard must be used inside an AgentLinkCard');
  return value;
}
