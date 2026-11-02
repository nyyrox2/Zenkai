import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AniListDownBanner } from './components/AniListDownBanner'
import { Footer } from './components/Footer'
import { MobileDock } from './components/MobileDock'
import { Navbar } from './components/Navbar'
import { ScrollProgress } from './components/ScrollProgress'
import { ScrollToTop } from './components/ScrollToTop'
import { TopLoader } from './components/TopLoader'
import { PageLoader } from './components/PageLoader'
import { ShieldGate } from './components/ShieldGate'
import { ApiIntro } from './components/ApiIntro'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { Toaster } from './components/Toaster'
import { MovieSearchModal } from './components/MovieSearchModal'
import { SearchModal } from './components/SearchModal'
import { ChangelogModal } from './components/ChangelogModal'
import { ChooseUsernameModal } from './components/ChooseUsernameModal'
import { useTrackHistory } from './lib/backToDetails'
import { initAniListSync } from './lib/anilist'
import { useApplyTvMode } from './lib/keys'
import { useSpatialNav } from './lib/spatial'
import { isDetailsPath, isReaderPath, isWatchPath, sectionOf } from './lib/sections'
import { useAuth } from './context/AuthContext'
import { checkDailySync } from './lib/sync'
import LandingPage from './pages/LandingPage'

// Only the opening page is eager; everything else is split out; hls.js only ships with the player page.
const HomePage = lazy(() => import('./pages/HomePage'))
const DetailsPage = lazy(() => import('./pages/DetailsPage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const ListPage = lazy(() => import('./pages/ListPage'))
const AppPage = lazy(() => import('./pages/AppPage'))
const NovelHomePage = lazy(() => import('./pages/NovelHomePage'))
const NovelDetailsPage = lazy(() => import('./pages/NovelDetailsPage'))
const NovelReaderPage = lazy(() => import('./pages/NovelReaderPage'))
const MangaHomePage = lazy(() => import('./pages/MangaHomePage'))
const MangaBrowsePage = lazy(() => import('./pages/MangaBrowsePage'))
const MangaDetailsPage = lazy(() => import('./pages/MangaDetailsPage'))
const MangaReaderPage = lazy(() => import('./pages/MangaReaderPage'))
const MoviesHomePage = lazy(() => import('./pages/MoviesHomePage'))
const MoviesBrowsePage = lazy(() => import('./pages/MoviesBrowsePage'))
const MovieDetailsPage = lazy(() => import('./pages/MovieDetailsPage'))
const MovieWatchPage = lazy(() => import('./pages/MovieWatchPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const CommunityPage = lazy(() => import('./pages/CommunityPage'))
const AniListCallbackPage = lazy(() => import('./pages/AniListCallbackPage'))
const FindPage = lazy(() => import('./pages/FindPage'))
const BustedPage = lazy(() => import('./pages/BustedPage'))
const EmbedPage = lazy(() => import('./pages/EmbedPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const CallPage = lazy(() => import('./pages/CallPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  // The opening page is a clean full-screen picker: no navbar, dock, footer or search.
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Redirect OAuth callbacks landing at root back to /profile
  useEffect(() => {
    if (pathname === '/' && (window.location.hash.includes('access_token=') || window.location.search.includes('code='))) {
      navigate('/profile' + window.location.search + window.location.hash, { replace: true })
    }
  }, [pathname, navigate])
  const gate = pathname === '/'
  const reader = isReaderPath(pathname) // Novel / manga readers are full-screen too
  const isEmbed = pathname === '/embed' || pathname.startsWith('/embed/')
  const isApi = pathname === '/api' || pathname.startsWith('/api') || pathname === '/docs'
  const isMessages = pathname.startsWith('/messages')
  const inChat = /^\/messages\/[^/]+$/.test(pathname)
  const isCall = pathname === '/call'
  const bare = gate || pathname === '/busted' || isEmbed || reader || isWatchPath(pathname) || isCall || isMessages
  const section = sectionOf(pathname)

  useTrackHistory()
  useApplyTvMode()
  useSpatialNav()
  useEffect(() => initAniListSync(), [])
  const { user } = useAuth()
  useEffect(() => {
    if (user?.id) void checkDailySync(user.id)
  }, [user?.id])

  // Each section has its own colour identity (see index.css).
  useEffect(() => {
    document.documentElement.dataset.section = section ?? 'hub'
  }, [section])

  return (
    <>
      <TopLoader />
      {!bare && !isApi && <ScrollProgress />}
      <ScrollToTop />
      {!bare && !isApi && <AniListDownBanner />}
      {!bare && !isDetailsPath(pathname) && !isApi && <Navbar />}
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/trending" element={<CatalogPage preset="trending" />} />
          <Route path="/popular" element={<CatalogPage preset="popular" />} />
          <Route path="/top" element={<CatalogPage preset="top" />} />
          <Route path="/browse" element={<CatalogPage preset="browse" />} />
          <Route path="/list" element={<ListPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/app" element={<AppPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/user/:username" element={<PublicProfilePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/messages/:partnerHandle" element={<MessagesPage />} />
          <Route path="/call" element={<CallPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/auth/anilist" element={<AniListCallbackPage />} />
          {/* Novels */}
          <Route path="/novel" element={<NovelHomePage />} />
          <Route path="/novel/find" element={<FindPage />} />
          <Route path="/manga/find" element={<FindPage />} />
          <Route path="/novel/:source/:slug" element={<NovelDetailsPage />} />
          <Route path="/novel/:source/:slug/read/:chapter" element={<NovelReaderPage />} />
          {/* Manga */}
          <Route path="/manga" element={<MangaHomePage />} />
          <Route path="/manga/browse" element={<MangaBrowsePage />} />
          <Route path="/manga/:id" element={<MangaDetailsPage />} />
          <Route path="/manga/:id/read/:chapterId" element={<MangaReaderPage />} />
          {/* Movies & TV */}
          <Route path="/movies" element={<MoviesHomePage />} />
          <Route path="/movies/browse" element={<MoviesBrowsePage />} />
          <Route path="/movies/watch/:type/:id" element={<MovieWatchPage />} />
          <Route path="/movies/:type/:id" element={<MovieDetailsPage />} />
          <Route path="/watch/:id" element={<WatchPage />} />
          <Route path="/anime/:id" element={<DetailsPage />} />
          <Route path="/mal/:id" element={<DetailsPage />} />
          <Route path="/embed" element={<EmbedPage />} />
          <Route path="/embed/:id" element={<EmbedPage />} />
          <Route path="/embed/:id/:ep" element={<EmbedPage />} />
          <Route path="/api" element={<DocsPage />} />
          <Route path="/api/docs" element={<DocsPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/busted" element={<BustedPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      {!bare && !isApi && !isMessages && <Footer />}
      {!bare && !isApi && !inChat && <MobileDock />}
      {!bare && !isApi && section === 'anime' && <SearchModal />}
      {!bare && !isApi && section === 'movies' && <MovieSearchModal />}
      <Toaster />
      <ShortcutsHelp />
      <ShieldGate />
      <ChangelogModal />
      <ChooseUsernameModal />
      {!isApi && !isEmbed && !reader && !isWatchPath(pathname) && pathname !== '/busted' && <ApiIntro />}
    </>
  )
}
