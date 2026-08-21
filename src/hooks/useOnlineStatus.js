import { useState, useEffect } from 'react'
import { syncPendingSales, getPendingCount } from '../services/offlineSync'
import toast from 'react-hot-toast'

export default function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }

  useEffect(() => {
    refreshPendingCount()

    const handleOnline = async () => {
      setOnline(true)
      const count = await getPendingCount()
      if (count > 0) {
        toast.loading(`Back online — syncing ${count} pending sale${count > 1 ? 's' : ''}...`, { id: 'sync' })
        const result = await syncPendingSales()
        toast.dismiss('sync')
        if (result.synced > 0) toast.success(`Synced ${result.synced} sale${result.synced > 1 ? 's' : ''}`)
        if (result.failed > 0) toast.error(`${result.failed} sale${result.failed > 1 ? 's' : ''} need attention`)
        await refreshPendingCount()
      }
    }

    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { online, pendingCount, refreshPendingCount }
}