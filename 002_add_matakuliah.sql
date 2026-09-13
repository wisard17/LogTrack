BEGIN;

CREATE TABLE matakuliah (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve existing groups and reports under a course that admins can rename.
INSERT INTO matakuliah (nama) VALUES ('Mata Kuliah Lama');
ALTER TABLE grup ADD COLUMN matakuliah_id UUID REFERENCES matakuliah(id) ON DELETE RESTRICT;
UPDATE grup SET matakuliah_id = (SELECT id FROM matakuliah WHERE nama = 'Mata Kuliah Lama');
ALTER TABLE grup ALTER COLUMN matakuliah_id SET NOT NULL;
ALTER TABLE grup DROP CONSTRAINT grup_nama_key;
ALTER TABLE grup ADD UNIQUE (matakuliah_id, nama);
ALTER TABLE grup ADD UNIQUE (id, matakuliah_id);

CREATE TABLE peserta_matakuliah (
  mahasiswa_id TEXT NOT NULL REFERENCES mahasiswa(id) ON DELETE CASCADE,
  matakuliah_id UUID NOT NULL REFERENCES matakuliah(id) ON DELETE RESTRICT,
  grup_id UUID,
  PRIMARY KEY (mahasiswa_id, matakuliah_id),
  FOREIGN KEY (grup_id, matakuliah_id) REFERENCES grup(id, matakuliah_id) ON DELETE NO ACTION
);
INSERT INTO peserta_matakuliah (mahasiswa_id, matakuliah_id, grup_id)
SELECT m.id, g.matakuliah_id, g.id FROM mahasiswa m JOIN grup g ON g.id = m.grup_id;

ALTER TABLE logbook ADD COLUMN matakuliah_id UUID REFERENCES matakuliah(id) ON DELETE RESTRICT;
UPDATE logbook l SET matakuliah_id = g.matakuliah_id FROM grup g WHERE g.id = l.grup_id;
ALTER TABLE logbook ALTER COLUMN matakuliah_id SET NOT NULL;
ALTER TABLE logbook ADD FOREIGN KEY (grup_id, matakuliah_id) REFERENCES grup(id, matakuliah_id);
INSERT INTO peserta_matakuliah (mahasiswa_id, matakuliah_id)
SELECT DISTINCT mahasiswa_id, matakuliah_id FROM logbook ON CONFLICT DO NOTHING;
DROP INDEX uq_logbook_mahasiswa_week;
CREATE UNIQUE INDEX uq_logbook_mahasiswa_matakuliah_week ON logbook(mahasiswa_id, matakuliah_id, week_number);
CREATE INDEX idx_logbook_matakuliah ON logbook(matakuliah_id);
CREATE INDEX idx_peserta_grup ON peserta_matakuliah(grup_id);

COMMIT;
