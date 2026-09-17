import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from api.main import app
from api.course_config import set_course_active
from api.group_selection_config import save_deadline


class CourseConfigTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / 'matakuliah.json'
        for target, value in [('api.course_config.CONFIG_FILE', self.path),
                              ('api.group_selection_config.CONFIG_DIR', Path(directory.name) / 'deadlines')]:
            mocked = patch(target, value)
            mocked.start()
            self.addCleanup(mocked.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.client.headers.update(self.client.get('/csrf-token').json())

    def test_status_updates_preserve_other_courses_in_one_file(self):
        first, second = uuid4(), uuid4()
        with patch('api.routers.matakuliah.fetch_one', return_value={'id': first}):
            self.assertEqual(self.client.put(f'/matakuliah/{first}/status', json={'active': False}).status_code, 200)
            self.assertEqual(self.client.put(f'/matakuliah/{second}/status', json={'active': True}).status_code, 200)
        self.assertEqual(json.loads(self.path.read_text()), {str(first): False, str(second): True})
        self.assertEqual(list(self.path.parent.glob('*.json')), [self.path])

    def test_student_list_follows_activity_deadline_and_membership(self):
        courses = [{'id': uuid4(), 'nama': name, 'members': members} for name, members in [
            ('Open', []), ('Expired', []), ('Not configured', []),
            ('Enrolled expired', ['student']), ('Inactive enrolled', ['student']), ('Inactive open', []),
        ]]
        for index in [0, 5]:
            save_deadline(courses[index]['id'], datetime.now(timezone.utc) + timedelta(days=1))
        for index in [1, 3]:
            save_deadline(courses[index]['id'], datetime.now(timezone.utc) - timedelta(seconds=1))
        for index in [4, 5]:
            set_course_active(courses[index]['id'], False)
        with patch('api.routers.matakuliah.fetch_all', return_value=courses):
            response = self.client.get('/matakuliah?mahasiswa_id=student&include_available=true')
            self.assertEqual(response.status_code, 200)
            self.assertEqual([row['nama'] for row in response.json()], ['Enrolled expired', 'Open'])
            self.assertEqual(len(self.client.get('/matakuliah').json()), 6)
            # Closing the registration window removes an unjoined course on the next request.
            save_deadline(courses[0]['id'], datetime.now(timezone.utc) - timedelta(seconds=1))
            response = self.client.get('/matakuliah?mahasiswa_id=student&include_available=true')
            self.assertEqual([row['nama'] for row in response.json()], ['Enrolled expired'])

    def test_inactive_course_rejects_join_even_before_deadline(self):
        course = uuid4()
        save_deadline(course, datetime.now(timezone.utc) + timedelta(days=1))
        set_course_active(course, False)
        self.assertFalse(self.client.get(f'/matakuliah/{course}/group-selection').json()['is_open'])
        with patch('api.routers.matakuliah.fetch_one') as database:
            response = self.client.post(f'/matakuliah/{course}/peserta/student/pilih-kelompok', json={'grup_id': str(uuid4())})
            self.assertEqual(response.status_code, 403)
            database.assert_not_called()


if __name__ == '__main__':
    unittest.main()
