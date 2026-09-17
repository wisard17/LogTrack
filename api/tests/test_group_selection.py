import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient

from api.main import app
from api.group_selection_config import read_deadline, save_deadline


class GroupSelectionTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        config = patch("api.group_selection_config.CONFIG_DIR", Path(self.directory.name))
        config.start()
        self.addCleanup(config.stop)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)
        self.client.headers.update(self.client.get('/csrf-token').json())
        self.course = uuid4()
        self.url = f'/matakuliah/{self.course}/group-selection'
        self.join = f'/matakuliah/{self.course}/peserta/student/pilih-kelompok'

    def test_config_persists_per_course_and_can_be_closed(self):
        deadline = datetime.now(timezone.utc) + timedelta(days=1)
        with patch('api.routers.matakuliah.fetch_one', return_value={'id': self.course}):
            response = self.client.put(self.url, json={'deadline': deadline.isoformat()})
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.json()['is_open'])
            self.assertEqual(read_deadline(self.course), deadline)
            self.assertIsNone(read_deadline(uuid4()))
            self.assertEqual(len(list(Path(self.directory.name).glob('*.json'))), 1)
            self.assertEqual(self.client.put(self.url, json={'deadline': None}).status_code, 200)
        self.assertFalse(self.client.get(self.url).json()['is_open'])

    def test_unconfigured_and_expired_deadlines_reject_join_without_database_write(self):
        for deadline in [None, datetime.now(timezone.utc) - timedelta(seconds=1)]:
            save_deadline(self.course, deadline)
            with patch('api.routers.matakuliah.fetch_one') as database:
                self.assertEqual(self.client.post(self.join, json={'grup_id': str(uuid4())}).status_code, 403)
                database.assert_not_called()

    def test_open_deadline_allows_valid_join_and_rejects_ineligible_membership(self):
        save_deadline(self.course, datetime.now(timezone.utc) + timedelta(days=1))
        group = str(uuid4())
        with patch('api.routers.matakuliah.fetch_one', return_value={'grup_id': group}):
            self.assertEqual(self.client.post(self.join, json={'grup_id': group}).status_code, 200)
        with patch('api.routers.matakuliah.fetch_one', return_value=None):
            self.assertEqual(self.client.post(self.join, json={'grup_id': group}).status_code, 409)

    def test_timezone_required_and_unknown_course_rejected(self):
        self.assertEqual(self.client.put(self.url, json={'deadline': '2030-01-01T12:00:00'}).status_code, 422)
        with patch('api.routers.matakuliah.fetch_one', return_value=None):
            self.assertEqual(self.client.put(self.url, json={'deadline': None}).status_code, 404)


if __name__ == '__main__':
    unittest.main()
