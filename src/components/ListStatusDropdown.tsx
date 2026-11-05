import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  Eye,
  Bookmark,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Check,
  Heart,
  Plus,
  Trash2,
  ListPlus,
  FolderPlus,
} from 'lucide-react'
import {
  STATUS_LABEL,
  setStatus,
  toggleFavorite,
  toggleAnimeInCustomList,
  removeFromList,
  useCustomLists,
  createCustomList,
  type ListItem,
  type ListStatus,
} from '../lib/library'
import { cn } from '../lib/utils'
import { toast } from '../lib/toast'

interface ListStatusDropdownProps {
  item: ListItem
  className?: string
  onRequestNewList?: () => void
}

const STATUS_ICONS: Record<ListStatus, any> = {
  watching: Eye,
  planning: Bookmark,
  completed: CheckCircle2,
  paused: PauseCircle,
  dropped: XCircle,
}

const STATUS_COLORS: Record<ListStatus, string> = {
  watching: 'text-emerald-400',
  planning: 'text-sky-400',
  completed: 'text-blue-400',
  paused: 'text-amber-400',
  dropped: 'text-rose-400',
}

const STATUS_LIST: ListStatus[] = ['watching', 'planning', 'completed', 'paused', 'dropped']

export function ListStatusDropdown({ item, className, onRequestNewList }: ListStatusDropdownProps) {
  const [open, setOpen] = useState(false)
  const [creatingList, setCreatingList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const customLists = useCustomLists()

  // Close when clicking outside
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreatingList(false)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    if (creatingList && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingList])

  const CurrentIcon = STATUS_ICONS[item.status] || Eye
  const statusColor = STATUS_COLORS[item.status] || 'text-white'

  const handleSelectStatus = (s: ListStatus) => {
    setStatus(item.id, s)
    setOpen(false)
    toast(`Moved to ${STATUS_LABEL[s]}`)
  }

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleFavorite(item.id)
    toast(!item.favorite ? 'Added to Favorites' : 'Removed from Favorites')
  }

  const handleToggleCustomList = (e: React.MouseEvent, listId: string, listName: string) => {
    e.stopPropagation()
    const inList = item.customLists?.includes(listId)
    toggleAnimeInCustomList(item.id, listId)
    toast(!inList ? `Added to "${listName}"` : `Removed from "${listName}"`)
  }

  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const name = newListName.trim()
    if (!name) return
    const cl = createCustomList(name)
    toggleAnimeInCustomList(item.id, cl.id)
    setNewListName('')
    setCreatingList(false)
    toast(`Created and added to "${name}"`)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeFromList(item.id)
    setOpen(false)
    toast('Removed from Watchlist')
  }

  return (
    <div ref={menuRef} className={cn('relative w-full', className)}>
      {/* Trigger Button: Modern Rounded Full Pill */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          'mt-2.5 h-8.5 w-full rounded-full border border-white/10 bg-[#121319] px-3 text-xs font-semibold text-white transition-all duration-200 outline-none',
          'hover:border-white/30 hover:bg-[#181a24] active:scale-[0.98] flex items-center justify-between gap-1.5 shadow-sm',
          open && 'border-white/40 bg-[#181a24] ring-1 ring-white/20'
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          <CurrentIcon className={cn('size-3.5 shrink-0', statusColor)} />
          <span className="truncate">{STATUS_LABEL[item.status]}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          {item.favorite && (
            <span title="In Favorites" className="grid place-items-center">
              <Heart className="size-3.5 fill-red-500 text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
            </span>
          )}
          <ChevronDown
            className={cn('size-3.5 text-neutral-400 transition-transform duration-200', open && 'rotate-180 text-white')}
          />
        </div>
      </button>

      {/* Floating Animated Dropdown Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className="absolute left-0 right-0 sm:left-auto sm:right-0 sm:w-56 top-full mt-1.5 z-50 rounded-2xl border border-white/15 bg-[#0e1017]/95 backdrop-blur-2xl p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none text-xs"
          >
            {/* Status Section */}
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Watch Status
            </div>
            <div className="space-y-0.5">
              {STATUS_LIST.map((s) => {
                const Icon = STATUS_ICONS[s]
                const active = item.status === s
                const color = STATUS_COLORS[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectStatus(s)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl font-medium transition-colors text-left',
                      active
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={cn('size-3.5 shrink-0', color)} />
                      <span className="truncate">{STATUS_LABEL[s]}</span>
                    </div>
                    {active && <Check className="size-3.5 text-white shrink-0" />}
                  </button>
                )
              })}
            </div>

            {/* Divider */}
            <div className="my-1.5 border-t border-white/10" />

            {/* Favorites Toggle Option */}
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              Favorites
            </div>
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl font-medium transition-colors text-left',
                item.favorite
                  ? 'bg-red-500/15 text-red-300 font-semibold border border-red-500/20'
                  : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'
              )}
            >
              <div className="flex items-center gap-2">
                <Heart
                  className={cn(
                    'size-3.5 shrink-0 transition-transform active:scale-125',
                    item.favorite ? 'fill-red-500 text-red-500' : 'text-neutral-400'
                  )}
                />
                <span>{item.favorite ? 'In Favorites' : 'Add to Favorites'}</span>
              </div>
              {item.favorite && <Check className="size-3.5 text-red-400 shrink-0" />}
            </button>

            {/* Divider */}
            <div className="my-1.5 border-t border-white/10" />

            {/* Custom Lists Section */}
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              <span>Custom Lists</span>
              {customLists.length > 0 && !creatingList && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setCreatingList(true)
                  }}
                  title="Create new list"
                  className="hover:text-white transition-colors"
                >
                  <Plus className="size-3.5" />
                </button>
              )}
            </div>

            {/* Custom List Items */}
            <div className="space-y-0.5 max-h-36 overflow-y-auto no-scrollbar">
              {customLists.map((cl) => {
                const inThisList = item.customLists?.includes(cl.id)
                return (
                  <button
                    key={cl.id}
                    type="button"
                    onClick={(e) => handleToggleCustomList(e, cl.id, cl.name)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl font-medium transition-colors text-left',
                      inThisList
                        ? 'bg-white/10 text-white font-semibold'
                        : 'text-neutral-300 hover:bg-white/[0.06] hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ListPlus className="size-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate">{cl.name}</span>
                    </div>
                    {inThisList && <Check className="size-3.5 text-white shrink-0" />}
                  </button>
                )
              })}

              {/* Inline Create List Input */}
              {creatingList ? (
                <form onSubmit={handleCreateList} className="p-1">
                  <div className="flex items-center gap-1 bg-white/[0.06] rounded-xl border border-white/20 px-2 py-1">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="List name..."
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="bg-transparent text-xs text-white placeholder:text-neutral-500 outline-none w-full"
                    />
                    <button
                      type="submit"
                      disabled={!newListName.trim()}
                      className="text-white disabled:opacity-40 hover:text-emerald-400"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onRequestNewList) {
                      setOpen(false)
                      onRequestNewList()
                    } else {
                      setCreatingList(true)
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors text-left font-medium"
                >
                  <FolderPlus className="size-3.5 shrink-0" />
                  <span>New custom list...</span>
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="my-1.5 border-t border-white/10" />

            {/* Remove from Watchlist */}
            <button
              type="button"
              onClick={handleRemove}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left font-medium"
            >
              <Trash2 className="size-3.5 shrink-0" />
              <span>Remove from list</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
