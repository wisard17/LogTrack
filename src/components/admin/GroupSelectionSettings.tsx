import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getGroupSelection, saveGroupSelection } from '../../services/api';
import { toast } from 'sonner';

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function GroupSelectionSettings({ courseId }: { courseId: string }) {
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedDeadline, setSavedDeadline] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getGroupSelection(courseId).then(status => {
      if (active) { setDeadline(localDateTime(status.deadline)); setSavedDeadline(status.deadline); }
    }).catch(() => { if (active) setError('Gagal memuat deadline. Muat ulang halaman untuk mencoba kembali.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [courseId]);

  return <Card className="border-none shadow-sm">
    <CardHeader>
      <CardTitle>Deadline Pilih Kelompok</CardTitle>
      <CardDescription>Mahasiswa yang belum memiliki kelompok dapat memilih sampai batas waktu ini. Kosongkan untuk menutup pemilihan mandiri.</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="space-y-3" onSubmit={async event => {
        event.preventDefault(); setSaving(true);
        try {
          const status = await saveGroupSelection(courseId, deadline ? new Date(deadline).toISOString() : null);
          setSavedDeadline(status.deadline);
          toast.success('Deadline pemilihan kelompok disimpan');
        } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan deadline'); }
        finally { setSaving(false); }
      }}>
        <label htmlFor="group-selection-deadline" className="block text-sm font-medium">Tanggal dan jam deadline ({Intl.DateTimeFormat().resolvedOptions().timeZone})</label>
        <div className="flex flex-wrap gap-3">
          <Input id="group-selection-deadline" type="datetime-local" className="max-w-sm" value={deadline}
            onChange={event => setDeadline(event.target.value)} disabled={loading || saving || Boolean(error)} />
          <Button type="submit" disabled={loading || saving || Boolean(error)}>{saving ? 'Menyimpan...' : 'Simpan Deadline'}</Button>
        </div>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> :
          <p className="text-sm text-slate-500">{loading ? 'Memuat deadline...' : savedDeadline
            ? `Deadline tersimpan: ${new Date(savedDeadline).toLocaleString('id-ID')}` : 'Pemilihan mandiri ditutup; deadline belum diatur.'}</p>}
      </form>
    </CardContent>
  </Card>;
}
