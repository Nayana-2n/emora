import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { Button, Card, Input, Label } from '../components/ui'
import { Logo } from '../components/Logo'

export default function Profile() {
  const { user, logout, updateProfile } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [nameBusy, setNameBusy] = useState(false)
  const [nameMessage, setNameMessage] = useState('')

  const saveName = async () => {
    setNameMessage('')
    setError('')
    if (!displayName.trim()) {
      setError('Display name cannot be empty.')
      return
    }
    setNameBusy(true)
    try {
      await updateProfile(displayName.trim())
      setNameMessage('Display name updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update display name')
    } finally {
      setNameBusy(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await api('/api/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      })
      setMessage('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold">Profile</h1>
        <p className="text-sm text-muted">Your account and security.</p>
      </header>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <Logo size={56} />
          <div>
            <p className="font-mono text-lg">{user?.email}</p>
            <p className="text-xs text-muted">
              Member since{' '}
              {user?.created_at ? new Date(user.created_at * 1000).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'recently'}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Display name</h2>
        <p className="mb-3 text-xs text-muted">How EMORA greets you on your dashboard.</p>
        {nameMessage && <p className="mb-3 rounded-xl border border-good/30 bg-good/10 px-4 py-2.5 text-sm text-good">{nameMessage}</p>}
        <div className="flex gap-2">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          <Button onClick={saveName} loading={nameBusy} className="shrink-0">
            Save
          </Button>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Change password</h2>
        {message && <p className="mb-4 rounded-xl border border-good/30 bg-good/10 px-4 py-2.5 text-sm text-good">{message}</p>}
        {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}
        <form onSubmit={changePassword} className="flex flex-col gap-4">
          <div>
            <Label>Current password</Label>
            <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <Label>Confirm new password</Label>
            <Input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={busy}>Update password</Button>
          </div>
        </form>
      </Card>

      <Card className="mt-4 border-bad/20">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-bad">Danger zone</h2>
        <p className="mb-3 text-xs text-muted">Sign out of EMORA on this device. Your data stays with your account.</p>
        <Button variant="danger" onClick={logout}>Sign out</Button>
      </Card>
    </div>
  )
}
