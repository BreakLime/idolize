// Routes follow TIDAL's URL scheme, so a tidal.com link maps straight onto a page.
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from '@/layout/AppLayout';
import { setNavigator } from '@/lib/navigation';
import { PageError } from '@/pages/PageError';

const Home = lazy(() => import('@/pages/Home'));
const ViewAll = lazy(() => import('@/pages/ViewAll'));
const Explore = lazy(() => import('@/pages/Explore'));
const Feed = lazy(() => import('@/pages/Feed'));
const Album = lazy(() => import('@/pages/Album'));
const Artist = lazy(() => import('@/pages/Artist'));
const ArtistViewAll = lazy(() => import('@/components/artist/ArtistViewAll'));
const ArtistCredits = lazy(() => import('@/components/artist/ArtistCredits'));
const Playlist = lazy(() => import('@/pages/Playlist'));
const Mix = lazy(() => import('@/pages/Mix'));
const Track = lazy(() => import('@/pages/Track'));
const Folder = lazy(() => import('@/pages/Folder'));
const Collection = lazy(() => import('@/pages/Collection'));
const Search = lazy(() => import('@/pages/Search'));
const Settings = lazy(() => import('@/pages/Settings'));
const Uploads = lazy(() => import('@/pages/Uploads'));

const page = (el: ReactNode) => <Suspense fallback={null}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <PageError />,
    children: [
      { index: true, element: page(<Home />) },
      { path: 'home/pages/:moduleId/view-all', element: page(<ViewAll />) },
      { path: 'view/pages/*', element: page(<Explore />) },
      { path: 'feed', element: page(<Feed />) },
      { path: 'album/:id', element: page(<Album />) },
      { path: 'album/:id/credits', element: page(<Album />) },
      { path: 'album/:albumId/track/:id', element: page(<Track />) },
      { path: 'track/:id', element: page(<Track />) },
      { path: 'artist/:id', element: page(<Artist />) },
      { path: 'artist/:moduleId/view-all', element: page(<ArtistViewAll />) },
      { path: 'credits/:id', element: page(<ArtistCredits />) },
      { path: 'playlist/:id', element: page(<Playlist />) },
      { path: 'mix/:id', element: page(<Mix />) },
      { path: 'folder/:id', element: page(<Folder />) },
      { path: 'my-collection', element: page(<Collection />) },
      { path: 'my-collection/:tab', element: page(<Collection />) },
      { path: 'search', element: page(<Search />) },
      { path: 'search/:tab', element: page(<Search />) },
      { path: 'settings', element: <Navigate to="/settings/general" replace /> },
      { path: 'settings/:tab', element: page(<Settings />) },
      { path: 'your-uploads', element: page(<Uploads />) },
      { path: '*', element: <PageError notFound /> },
    ],
  },
]);

setNavigator((to) => (typeof to === 'number' ? void router.navigate(to) : void router.navigate(to)));
