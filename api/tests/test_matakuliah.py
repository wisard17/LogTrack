"""Integration test; requires LOGBOOK_TEST_DATABASE_URL pointing to a test database.

Creates and removes only a uniquely named test schema; never uses the app .env.
Run: python -m unittest api.tests.test_matakuliah -v
"""
import os
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import uuid4
import tempfile

from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from api.main import app


@unittest.skipUnless(os.getenv("LOGBOOK_TEST_DATABASE_URL"), "Set LOGBOOK_TEST_DATABASE_URL")
class MatakuliahIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.schema = "test_matakuliah_" + uuid4().hex
        self.admin_engine = create_engine(os.environ["LOGBOOK_TEST_DATABASE_URL"])
        with self.admin_engine.begin() as conn:
            conn.execute(text(f'CREATE SCHEMA "{self.schema}"'))
        self.engine = create_engine(
            os.environ["LOGBOOK_TEST_DATABASE_URL"],
            connect_args={"options": f"-csearch_path={self.schema},public"},
        )
        root = Path(__file__).resolve().parents[2]
        with self.engine.connect() as conn:
            conn.exec_driver_sql((root / "001_init_logbook_schema.sql").read_text())
            conn.exec_driver_sql("INSERT INTO grup (nama) VALUES ('Kelompok 1')")
            conn.exec_driver_sql("""INSERT INTO mahasiswa (id, nama, email, grup_id)
                SELECT 'student-a', 'Mahasiswa A', 'a@unsrat.ac.id', id FROM grup""")
            conn.exec_driver_sql("""INSERT INTO logbook (week_number, description, evidence_url, mahasiswa_id, grup_id)
                SELECT 1, 'Laporan lama', '/uploads/lama.pdf', 'student-a', id FROM grup""")
            conn.commit()
            conn.exec_driver_sql((root / "002_add_matakuliah.sql").read_text())
            conn.commit()
        self.db_patch = patch("api.db_utils.get_engine", return_value=self.engine)
        self.db_patch.start()
        self.client = TestClient(app)
        self.client.headers.update(self.client.get("/csrf-token").json())

    def tearDown(self):
        self.client.close()
        self.db_patch.stop()
        self.engine.dispose()
        with self.admin_engine.begin() as conn:
            conn.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
        self.admin_engine.dispose()

    def test_migration_and_two_independent_courses(self):
        self.assertEqual(self.client.post("/matakuliah", json={"nama": "   "}).status_code, 422)
        courses = self.client.get("/matakuliah?mahasiswa_id=student-a").json()
        self.assertEqual(len(courses), 1)
        mk1 = courses[0]["id"]
        group1 = self.client.get("/grup", params={"matakuliah_id": mk1}).json()[0]
        self.assertEqual(group1["mahasiswa"][0]["id"], "student-a")
        self.assertEqual(self.client.get("/logbook", params={"matakuliah_id": mk1}).json()[0]["description"], "Laporan lama")

        mk2 = self.client.post("/matakuliah", json={"nama": "MK2"}).json()["id"]
        group2_response = self.client.post("/grup", json={"nama": "Kelompok 1", "matakuliah_id": mk2})
        self.assertEqual(group2_response.status_code, 201)
        group2 = group2_response.json()["id"]
        self.assertEqual(self.client.put(f"/matakuliah/{mk2}/peserta/student-a", json={"grup_id": group2}).status_code, 200)
        self.assertEqual(len(self.client.get("/matakuliah?mahasiswa_id=student-a").json()), 2)
        self.assertEqual(self.client.get("/matakuliah?mahasiswa_id=unknown").json(), [])

        payload = {"week_number": 1, "description": "Laporan MK2", "evidence_url": "/uploads/mk2.pdf",
                   "mahasiswa_id": "student-a", "grup_id": group2, "matakuliah_id": mk2}
        self.assertEqual(self.client.post("/logbook", json=payload).status_code, 201)
        self.assertEqual(self.client.post("/logbook", json=payload).status_code, 400)
        self.assertEqual(self.client.post("/logbook", json={**payload, "grup_id": group1["id"]}).status_code, 400)
        self.assertEqual(self.client.put(f"/matakuliah/{mk2}/peserta/student-a", json={"grup_id": group1["id"]}).status_code, 400)
        for course_id, description in [(mk1, "Laporan lama"), (mk2, "Laporan MK2")]:
            response = self.client.get("/logbook", params={"matakuliah_id": course_id, "mahasiswa_id": "student-a"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([log["description"] for log in response.json()], [description])
        self.assertEqual(self.client.get("/logbook", params={"matakuliah_id": mk2, "mahasiswa_id": "unknown"}).json(), [])

        # Changing MK2 membership must preserve MK1 membership and historical reports.
        empty_group = self.client.post("/grup", json={"nama": "Kelompok 2", "matakuliah_id": mk2}).json()["id"]
        self.assertEqual(self.client.put(f"/matakuliah/{mk2}/peserta/student-a", json={"grup_id": empty_group}).status_code, 200)
        self.assertEqual(self.client.get("/grup", params={"matakuliah_id": mk1}).json()[0]["mahasiswa"][0]["id"], "student-a")
        self.assertEqual(self.client.delete(f"/grup/{empty_group}").status_code, 200)
        self.assertEqual(len(self.client.get("/matakuliah?mahasiswa_id=student-a").json()), 2)
        self.assertEqual(self.client.delete(f"/grup/{group2}").status_code, 400)
        self.assertEqual(len(self.client.get("/logbook", params={"matakuliah_id": mk2, "mahasiswa_id": "student-a"}).json()), 1)

    def test_login_uses_postgres_and_preserves_roles_memberships_and_logs(self):
        self.client.patch('/mahasiswa?id=student-a', json={'role': 'admin'})
        before = self.client.get('/mahasiswa/student-a').json()
        response = self.client.post('/mahasiswa/login', json={
            'id': 'student-a', 'nama': 'Nama Google Baru', 'email': 'a@unsrat.ac.id',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['role'], 'admin')
        self.assertEqual(response.json()['grup_id'], before['grup_id'])
        self.assertEqual(response.json()['created_at'], before['created_at'])
        self.assertEqual(response.json()['nama'], 'Nama Google Baru')
        courses = self.client.get('/matakuliah?mahasiswa_id=student-a').json()
        self.assertEqual(len(courses), 1)
        self.assertEqual(len(self.client.get('/logbook', params={'matakuliah_id': courses[0]['id']}).json()), 1)
        with patch.dict(os.environ, {'ADMIN_EMAIL': 'owner@unsrat.ac.id'}):
            created = self.client.post('/mahasiswa/login', json={
                'id': 'owner', 'nama': 'Owner', 'email': 'owner@unsrat.ac.id',
            })
            self.assertEqual(created.json()['role'], 'admin')
        student = self.client.post('/mahasiswa/login', json={
            'id': 'new-student', 'nama': 'Baru', 'email': 'baru@unsrat.ac.id', 'role': 'admin',
        })
        self.assertEqual(student.json()['role'], 'student')
        self.assertEqual(self.client.post('/mahasiswa/login', json={
            'id': 'outside', 'nama': 'Outside', 'email': 'outside@example.com',
        }).status_code, 403)
        
    def test_self_selection_cannot_replace_group_or_cross_courses(self):
        with tempfile.TemporaryDirectory() as directory, patch('api.group_selection_config.CONFIG_DIR', Path(directory)):
            from api.group_selection_config import save_deadline
            course = self.client.get('/matakuliah?mahasiswa_id=student-a').json()[0]['id']
            group = self.client.get('/grup', params={'matakuliah_id': course}).json()[0]['id']
            save_deadline(course, datetime.now(timezone.utc) + timedelta(days=1))
            url = f'/matakuliah/{course}/peserta/student-a/pilih-kelompok'
            self.assertEqual(self.client.post(url, json={'grup_id': group}).status_code, 409)
            self.client.put(f'/matakuliah/{course}/peserta/student-a', json={'grup_id': None})
            other = self.client.post('/matakuliah', json={'nama': 'MK lain'}).json()['id']
            other_group = self.client.post('/grup', json={'nama': 'Grup lain', 'matakuliah_id': other}).json()['id']
            self.assertEqual(self.client.post(url, json={'grup_id': other_group}).status_code, 409)
            unknown = f'/matakuliah/{course}/peserta/unknown/pilih-kelompok'
            self.assertEqual(self.client.post(unknown, json={'grup_id': group}).status_code, 409)
            self.assertEqual(self.client.post(url, json={'grup_id': group}).status_code, 200)
            self.assertEqual(self.client.post(url, json={'grup_id': group}).status_code, 409)


if __name__ == "__main__":
    unittest.main()
