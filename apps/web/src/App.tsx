import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import Today from './routes/Today';
import Capture from './routes/Capture';
import Explore from './routes/Explore';
import Saved from './routes/Saved';
import You from './routes/You';
import Everywhere from './routes/Everywhere';
import DestinationCatalog from './routes/DestinationCatalog';
import RouteEditor from './routes/RouteEditor';
import ScheduledTasks from './routes/ScheduledTasks';
import DailyCompanion from './routes/DailyCompanion';
import EntryDetail from './routes/EntryDetail';
import StudyDetail from './routes/StudyDetail';
import MemorySettings from './routes/MemorySettings';
import Integrations from './routes/Integrations';
import Privacy from './routes/Privacy';
import Onboarding from './routes/Onboarding';
import AuthSignIn from './routes/AuthSignIn';
import AuthCallback from './routes/AuthCallback';
import NotFound from './routes/NotFound';

/**
 * Every screen is an addressable route. Nothing in this app is reachable only
 * through a sheet, a hash target, or a JavaScript-only binding — a deep link
 * to any of these paths loads the real screen.
 */
export default function App(): ReactNode {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/capture" element={<Capture />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/saved" element={<Saved />} />

        <Route path="/you" element={<You />} />
        <Route path="/you/memory" element={<MemorySettings />} />
        <Route path="/you/integrations" element={<Integrations />} />
        <Route path="/you/daily-companion" element={<DailyCompanion />} />
        <Route path="/you/everywhere" element={<Everywhere />} />
        <Route path="/you/everywhere/destinations" element={<DestinationCatalog />} />
        <Route path="/you/everywhere/destinations/:destinationId" element={<RouteEditor />} />
        <Route path="/you/everywhere/schedule" element={<ScheduledTasks />} />

        <Route path="/entry/:id" element={<EntryDetail />} />
        <Route path="/study/:reference" element={<StudyDetail />} />

        <Route path="/privacy" element={<Privacy />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/auth" element={<Navigate to="/auth/sign-in" replace />} />
        <Route path="/auth/sign-in" element={<AuthSignIn />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppShell>
  );
}
