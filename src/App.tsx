import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Footer } from './components/Footer'
import { MobileDock } from './components/MobileDock'
import { Navbar } from './components/Navbar'
import { ScrollProgress } from './components/ScrollProgress'
import { ScrollToTop } from './components/ScrollToTop'
import { TopLoader } from './components/TopLoader'
import { ShieldGate } from './components/ShieldGate'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { Toaster } from './components/Toaster'
import { MovieSearchModal } from './components/MovieSearchModal'
import { SearchModal } from './components/SearchModal'
import { ChangelogModal } from './components/ChangelogModal'
import { useTrackHistory } from './lib/backToDetails'
import { initAniListSync } from './lib/anilist'
import { useApplyTvMode } from './lib/keys'
import { useSpatialNav } from './lib/spatial'
import { isDetailsPath, isReaderPath, isWatchPath, sectionOf } from './lib/sections'
import LandingPage from './pages/LandingPage'

// Only the opening page is eager; everything else is split out; hls.js only ships with the player page.
const HomePage = lazy(() => import('./pages/HomePage'))
const DetailsPage = lazy(() => import('./pages/DetailsPage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
const WatchPage = lazy(() => import('./pages/WatchPage'))
const ListPage = lazy(() => import('./pages/ListPage'))
const AppPage = lazy(() => import('./pages/AppPage'))
const SelfHostPage = lazy(() => import('./pages/SelfHostPage'))
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
const AniListCallbackPage = lazy(() => import('./pages/AniListCallbackPage'))
const FindPage = lazy(() => import('./pages/FindPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

export default function App() {
  // The opening page is a clean full-screen picker: no navbar, dock, footer or search.
  const { pathname } = useLocation()
  const gate = pathname === '/'
  const reader = isReaderPath(pathname) // Novel / manga readers are full-screen too
  const guide = pathname === '/self-host' // the self-hosting guide has its own slim header
  const bare = gate || reader || guide || isWatchPath(pathname)
  const section = sectionOf(pathname)

  useTrackHistory()
  useApplyTvMode()
  useSpatialNav()
  useEffect(() => initAniListSync(), [])

  // Each section has its own colour identity (see index.css).
  useEffect(() => {
    document.documentElement.dataset.section = section ?? 'hub'
  }, [section])

  return (
    <>
      <TopLoader />
      {!bare && <ScrollProgress />}
      <ScrollToTop />
      {!bare && !isDetailsPath(pathname) && <Navbar />}
      <Suspense fallback={<div className="min-h-[70svh]" />}>
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
          <Route path="/self-host" element={<SelfHostPage />} />
          <Route path="/profile" element={<ProfilePage />} />
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
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
      {!bare && <Footer />}
      {!bare && <MobileDock />}
      {!bare && section === 'anime' && <SearchModal />}
      {!bare && section === 'movies' && <MovieSearchModal />}
      <Toaster />
      <ShortcutsHelp />
      <ShieldGate />
      <ChangelogModal />
    </>
  )
}
