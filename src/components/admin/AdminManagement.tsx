import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { UserProfile } from '../../types';
import { updateUserRoleInPostgres } from '../../services/api';

export function AdminManagement({ users, onChanged }: { users: UserProfile[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  useEffect(() => {
    setAddedIds(previous => previous.filter(id => users.some(user => user.uid === id && user.role !== 'admin')));
  }, [users]);
  const isAdmin = (user: UserProfile) => user.role === 'admin' || addedIds.includes(user.uid);
  const admins = users.filter(isAdmin).sort((a, b) => a.name.localeCompare(b.name, 'id-ID'));
  const candidates = users.filter(user => !isAdmin(user));
  const query = search.trim().toLocaleLowerCase('id-ID');
  const matches = candidates.filter(user => `${user.name} ${user.email}`.toLocaleLowerCase('id-ID').includes(query));

  return <Card>
    <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <CardTitle>Daftar Admin ({admins.length})</CardTitle>
        <CardDescription>Pengguna dengan hak akses admin aplikasi.</CardDescription>
      </div>
      <Button className="w-fit" onClick={() => { setSearch(''); setSelectedId(''); setOpen(true); }}><Plus />Tambah Admin</Button>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2">
        {admins.map(admin => <li key={admin.uid} className="rounded-lg border border-slate-200 p-4">
          <p className="font-medium">{admin.name}</p>
          <p className="break-all text-sm text-muted-foreground">{admin.email}</p>
        </li>)}
      </ul>
      {!admins.length && <p className="py-6 text-center text-muted-foreground">Belum ada admin terdaftar.</p>}
    </CardContent>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Tambah Admin</DialogTitle>
          <DialogDescription>Pilih pengguna yang sudah terdaftar untuk diberikan hak akses admin.</DialogDescription>
        </DialogHeader>
        <label htmlFor="admin-user-search" className="text-sm font-medium">Cari nama atau email</label>
        <Input id="admin-user-search" type="search" value={search} disabled={saving}
          onChange={event => { setSearch(event.target.value); setSelectedId(''); }} placeholder="Ketik nama atau email..." />
        <div className="min-h-0 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Pilih pengguna untuk menjadi admin">
          {matches.map(user => <label key={user.uid} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input type="radio" name="new-admin" value={user.uid} checked={selectedId === user.uid}
              disabled={saving} onChange={() => setSelectedId(user.uid)} className="mt-1" />
            <span className="min-w-0"><span className="block font-medium">{user.name}</span>
              <span className="block break-all text-sm text-muted-foreground">{user.email}</span></span>
          </label>)}
          {!matches.length && <p role="status" className="py-4 text-sm text-muted-foreground">
            {candidates.length ? 'Pengguna tidak ditemukan.' : 'Tidak ada pengguna yang dapat ditambahkan. Pengguna baru perlu login terlebih dahulu.'}
          </p>}
        </div>
        <Button className="shrink-0" disabled={saving || !matches.some(user => user.uid === selectedId)} onClick={async () => {
          if (saving || !matches.some(user => user.uid === selectedId)) return;
          setSaving(true);
          try {
            await updateUserRoleInPostgres(selectedId, 'admin');
            setAddedIds(previous => [...previous, selectedId]);
            setOpen(false); onChanged(); toast.success('Admin berhasil ditambahkan');
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menambahkan admin'); }
          finally { setSaving(false); }
        }}>{saving ? 'Menyimpan...' : 'Simpan Admin'}</Button>
      </DialogContent>
    </Dialog>
  </Card>;
}
