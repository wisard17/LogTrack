import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { getGroupSelection, selectStudentGroup, type GroupSelectionStatus } from '../../services/api';
import type { ProjectGroup } from '../../types';
import { toast } from 'sonner';

export function GroupPicker({ courseId, studentId, groups, onChanged }: {
  courseId: string; studentId: string; groups: ProjectGroup[]; onChanged: () => void;
}) {
  const [status, setStatus] = useState<GroupSelectionStatus | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      const started = Date.now();
      try {
        const result = await getGroupSelection(courseId);
        if (active) {
          setStatus(result); setError('');
          // Server time determines the remaining window, even if the device clock differs.
          setExpiresAt(result.deadline ? started + new Date(result.deadline).getTime() - new Date(result.server_now).getTime() : 0);
        }
      } catch { if (active) { setStatus(null); setError('Gagal memuat deadline. Mencoba kembali...'); } }
      finally { busy = false; }
    };
    refresh();
    const polling = setInterval(refresh, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; clearInterval(polling); clearInterval(clock); };
  }, [courseId]);
  const availableGroups = groups.filter(group => group.courseId === courseId);
  const canChoose = Boolean(status?.is_open && now < expiresAt && !joined);
  if (joined || availableGroups.some(group => group.members.includes(studentId))) return null;
  return <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
    <p className="font-semibold">Anda belum memiliki kelompok pada mata kuliah ini.</p>
    <p className="text-sm text-slate-500" role="status">{error || (!status ? 'Memuat deadline pemilihan kelompok...' :
      !status.deadline ? 'Pemilihan kelompok belum dibuka oleh admin.' :
      `${canChoose ? 'Pilih kelompok sebelum' : 'Pemilihan kelompok ditutup. Deadline:'} ${new Date(status.deadline).toLocaleString('id-ID')}`)}</p>
    {status && !availableGroups.length && <p className="text-sm text-slate-500">Belum ada kelompok tersedia. Hubungi admin.</p>}
    <Button disabled={!canChoose || !availableGroups.length} onClick={() => setOpen(true)}>Pilih Kelompok</Button>
    <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pilih Kelompok</DialogTitle>
          <DialogDescription>Memilih kelompok otomatis mendaftarkan Anda ke mata kuliah kelompok ini. Setelah tersimpan, perubahan kelompok dilakukan oleh admin.</DialogDescription>
        </DialogHeader>
        <label htmlFor="student-group-choice" className="text-sm font-medium">Kelompok</label>
        <select id="student-group-choice" value={selected} onChange={event => setSelected(event.target.value)}
          disabled={saving || !canChoose} className="w-full rounded-lg border bg-white p-3">
          <option value="">Pilih kelompok...</option>
          {availableGroups.map(group => <option key={group.id} value={group.id}>{group.name} ({group.members.length} anggota)</option>)}
        </select>
        {!canChoose && <p role="alert" className="text-sm text-red-600">Pemilihan kelompok tidak tersedia. Deadline mungkin sudah lewat.</p>}
        <Button disabled={saving || !canChoose || !availableGroups.some(group => group.id === selected)} onClick={async () => {
          setSaving(true);
          try {
            await selectStudentGroup(courseId, studentId, selected);
            setJoined(true); setOpen(false); onChanged(); toast.success('Berhasil bergabung ke kelompok');
          } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal memilih kelompok'); }
          finally { setSaving(false); }
        }}>{saving ? 'Menyimpan...' : 'Gabung Kelompok'}</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
