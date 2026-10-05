import { useState } from 'react';
import { BottomNav } from './components/BottomNav';
import type { TabType } from './components/BottomNav';
import { ChatView } from './components/ChatView';
import { FavoritesView } from './components/FavoritesView';
import { GraphView } from './components/GraphView';
import { SettingsView } from './components/SettingsView';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  const pendingMessages = useLiveQuery(
    () => db.messages.where('status').equals('pending').count(),
    []
  );

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-stone-100 flex flex-col relative shadow-xl overflow-hidden font-sans border-x border-amber-200/40">
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'favorites' && <FavoritesView />}
        {activeTab === 'graph' && <GraphView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={pendingMessages || 0}
      />
    </div>
  );
}

export default App;
