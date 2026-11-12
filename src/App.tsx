import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AniListDownBanner } from './components/AniListDownBanner'
import { Footer } from './components/Footer'
import { MobileDock } from './components/MobileDock'
import { DesktopSidebar } from './components/DesktopSidebar'
import { MobileHeader } from './components/MobileHeader'
import { NavDrawer } from './components/NavDrawer'
import { ScrollProgress } from './components/ScrollProgress'
import { ScrollToTop } from './components/ScrollToTop'
import { TopLoader } from './components/TopLoader'
import { PageLoader } from './components/PageLoader'
import { ShieldGate } from './components/ShieldGate'
import { AdPopup } from './components/AdPopup'
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
import { cn } from './lib/utils'

// Split out lazy pages
const LandingPage = lazy(() => import('./pages/LandingPage'))
const HomePage = lazy(() => import('./pages/HomePage'))
const DetailsPage = lazy(() => import('./pages/DetailsPage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const ListPage = lazy(() => import('./pages/ListPage'))
const AppPage = lazy(() => import('./pages/AppPage'))
const ExtensionPage = lazy(() => import('./pages/ExtensionPage'))
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
const WatchPartyPage = lazy(() => import('./pages/WatchPartyPage'))
const AniListCallbackPage = lazy(() => import('./pages/AniListCallbackPage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const FindPage = lazy(() => import('./pages/FindPage'))
const BustedPage = lazy(() => import('./pages/BustedPage'))
const EmbedPage = lazy(() => import('./pages/EmbedPage'))
const DocsPage = lazy(() => import('./pages/DocsPage'))
const CallPage = lazy(() => import('./pages/CallPage'))
const ExtensionGuidePage = lazy(() => import('./pages/ExtensionGuidePage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  // Sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('zk_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('zk_sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }, [])

  // Mobile navigation drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Redirect OAuth callbacks landing at root back to /profile
  useEffect(() => {
    if (pathname === '/' && (window.location.hash.includes('access_token=') || window.location.search.includes('code='))) {
      navigate('/profile' + window.location.search + window.location.hash, { replace: true })
    }
  }, [pathname, navigate])

  const reader = isReaderPath(pathname) // Novel / manga readers are full-screen
  const isEmbed = pathname === '/embed' || pathname.startsWith('/embed/')
  const isApi = pathname === '/api' || pathname.startsWith('/api') || pathname === '/docs'
  const isMessages = pathname.startsWith('/messages')
  const inChat = /^\/messages\/[^/]+$/.test(pathname)
  const isCall = pathname === '/call'
  const isAuth = pathname.startsWith('/auth/') || pathname === '/login'
  const gate = pathname === '/' // opening picker: full-screen, no sidebar / header / dock
  const bare = gate || pathname === '/busted' || isEmbed || reader || isWatchPath(pathname) || isCall || isMessages || isAuth
  const section = sectionOf(pathname)

  const showNav = !bare && !isDetailsPath(pathname) && !isApi

  useTrackHistory()
  useApplyTvMode()
  useSpatialNav()
  useEffect(() => initAniListSync(), [])
  const { user } = useAuth()
  useEffect(() => {
    if (user?.id) void checkDailySync(user.id)
  }, [user?.id])

  useEffect(() => {
    document.documentElement.dataset.section = section ?? 'hub'
  }, [section])

  return (
    <div className="flex min-h-screen w-full max-w-full flex-col overflow-x-clip bg-background text-foreground">
      <TopLoader />
      {!bare && !isApi && <ScrollProgress />}
      <ScrollToTop />
      {!bare && !isApi && <AniListDownBanner />}

      {/* Desktop Left Collapsible Sidebar */}
      {showNav && (
        <DesktopSidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      )}

      {/* Mobile Top Header */}
      {showNav && (
        <MobileHeader onOpenDrawer={() => setDrawerOpen(true)} />
      )}

      {/* Mobile Navigation Drawer (off-canvas sidebar for mobile devices) */}
      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Main Content Area with Left Padding for Desktop Sidebar & Top Padding for Mobile Header */}
      <div
        className={cn(
          'transition-[padding-left] duration-200 ease-out flex-1 flex flex-col w-full min-w-0 max-w-full overflow-x-clip [&>*]:w-full [&>*]:min-w-0',
          showNav
            ? cn(
                sidebarCollapsed ? 'md:pl-[68px]' : 'md:pl-56',
                'pt-14 md:pt-0'
              )
            : 'pl-0 pt-0'
        )}
      >
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
              <Route path="/extension" element={<ExtensionPage />} />
              <Route path="/extension/how-to" element={<ExtensionGuidePage />} />
              <Route path="/companion" element={<ExtensionPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/u/:username" element={<PublicProfilePage />} />
              <Route path="/user/:username" element={<PublicProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:partnerHandle" element={<MessagesPage />} />
              <Route path="/call" element={<CallPage />} />
              <Route path="/community" element={<CommunityPage />} />
              <Route path="/watchparty" element={<WatchPartyPage />} />
              <Route path="/watchtogether" element={<WatchPartyPage />} />
              <Route path="/auth/anilist" element={<AniListCallbackPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/auth/login" element={<AuthCallbackPage />} />
              <Route path="/login" element={<AuthCallbackPage />} />
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
              <Route path="/support" element={<SupportPage />} />
              <Route path="/busted" element={<BustedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>

        {!bare && !isApi && !isMessages && <Footer />}
      </div>

      {!bare && !isApi && !inChat && <MobileDock onOpenDrawer={() => setDrawerOpen(true)} />}
      {!bare && !isApi && section === 'movies' ? <MovieSearchModal /> : <SearchModal />}
      <Toaster />
      <ShortcutsHelp />
      <ShieldGate />
      <AdPopup enabled={!bare && !isApi} />
      <ChangelogModal />
      <ChooseUsernameModal />
      {!isApi && !isEmbed && !reader && !isWatchPath(pathname) && pathname !== '/busted' && <ApiIntro />}
    </div>
  )
}
