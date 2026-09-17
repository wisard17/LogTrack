import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import type { ProjectGroup, UserProfile } from '../../types';
import { updateStudentGroupInPostgres } from '../../services/api';

export function AddGroupMember({ group, groups, users, onChanged }: {
  group: ProjectGroup; groups: ProjectGroup[]; users: UserProfile[]; onChanged: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const query = search.trim().toLocaleLowerCase('id-ID');
  const candidates = users.filter(user => !group.members.includes(user.uid) &&
    `${user.name} ${user.email}`.toLocaleLowerCase('id-ID').includes(query));
  const currentGroup = (uid: string) => groups.find(item => item.courseId === group.courseId && item.members.includes(uid));
  const sourceGroup = currentGroup(selected);
  return <Dialog open={open} onOpenChange={value => {
    if (saving) return;
    setOpen(value); if (value) { setSearch(''); setSelected(''); }
  }}>
    <DialogTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" disabled={!group.id} />}
      aria-label={`Tambah mahasiswa ke ${group.name}`} title="Tambah mahasiswa">
      <Plus className="h-4 w-4" />
    </DialogTrigger>
    <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden">
      <DialogHeader className="shrink-0 pr-6">
        <DialogTitle>Tambah Mahasiswa — {group.name}</DialogTitle>
        <DialogDescription>Mahasiswa otomatis terdaftar pada MK kelompok ini. Jika sudah memiliki kelompok pada MK yang sama, mahasiswa akan dipindahkan.</DialogDescription>
      </DialogHeader>
      <label htmlFor={id} className="text-sm font-medium">Cari nama atau email</label>
      <Input id={id} type="search" value={search} disabled={saving} placeholder="Ketik nama atau email..."
        onChange={event => { setSearch(event.target.value); setSelected(''); }} />
      <div className="min-h-0 space-y-2 overflow-y-auto overscroll-contain" role="radiogroup" aria-label="Pilih mahasiswa">
        {candidates.map(user => <label key={user.uid} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
          <input type="radio" name={id} value={user.uid} checked={selected === user.uid} disabled={saving}
            onChange={() => setSelected(user.uid)} className="mt-1" />
          <span className="min-w-0">
            <span className="block font-medium">{user.name}</span>
            <span className="block break-all text-sm text-muted-foreground">{user.email}</span>
            <span className="block text-xs text-muted-foreground">{currentGroup(user.uid)?.name || 'Belum memiliki kelompok pada MK ini'}</span>
          </span>
        </label>)}
        {!candidates.length && <p role="status" className="py-4 text-sm text-muted-foreground">
          {query ? 'Mahasiswa tidak ditemukan atau sudah menjadi anggota kelompok ini.' : 'Semua pengguna terdaftar sudah menjadi anggota, atau belum ada mahasiswa tersedia.'}
        </p>}
      </div>
      {sourceGroup && <p className="text-sm text-amber-700">{users.find(user => user.uid === selected)?.name} akan dipindahkan dari {sourceGroup.name} ke {group.name}.</p>}
      <Button className="shrink-0" disabled={saving || !group.id || !candidates.some(user => user.uid === selected)} onClick={async () => {
        if (saving || !group.id || !candidates.some(user => user.uid === selected)) return;
        setSaving(true);
        try {
          await updateStudentGroupInPostgres(selected, group.id, group.courseId);
          setOpen(false); setSelected(''); onChanged(); toast.success('Mahasiswa berhasil ditambahkan ke kelompok');
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menambahkan mahasiswa'); }
        finally { setSaving(false); }
      }}>{saving ? 'Menyimpan...' : sourceGroup ? 'Pindahkan ke Kelompok Ini' : 'Tambahkan ke Kelompok'}</Button>
    </DialogContent>
  </Dialog>;
}
