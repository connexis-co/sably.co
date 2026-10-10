import fcntl
import hashlib
import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("sably_backup", Path(__file__).parents[1] / "deployment" / "backup.py")
backup_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup_module)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.stack = self.base / "stack"
        self.root = self.base / "backups"
        (self.stack / "data" / "uploads" / "media").mkdir(parents=True)
        (self.stack / ".env").write_text("EXAMPLE_SECRET=do-not-print\n")
        (self.stack / "data" / "uploads" / "media" / "example.bin").write_bytes(b"media\x00bytes")
        self.connections = []
        for filename in backup_module.DATABASES:
            connection = sqlite3.connect(self.stack / "data" / filename)
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("CREATE TABLE example (id INTEGER PRIMARY KEY, content TEXT)")
            connection.execute("INSERT INTO example VALUES (1, 'persisted through WAL')")
            connection.commit()
            self.connections.append(connection)
            self.addCleanup(connection.close)

    def test_restorable_sqlite_snapshots_files_checksums_and_permissions(self):
        result = backup_module.backup(self.stack, self.root)
        self.assertEqual(result["status"], "ok")
        destination = self.root / result["backup"]
        for filename in backup_module.DATABASES:
            with sqlite3.connect(destination / filename) as restored:
                self.assertEqual(restored.execute("SELECT content FROM example").fetchone()[0], "persisted through WAL")
                self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone(), ("ok",))
        manifest = json.loads((destination / "manifest.json").read_text())
        self.assertEqual((destination / "manifest.sha256").read_text().strip(), f"{backup_module.digest(destination / 'manifest.json')}  manifest.json")
        for name, entry in manifest["files"].items():
            path = destination / name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), entry["sha256"])
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        for path in [self.root, destination, destination / "uploads", destination / "uploads" / "media"]:
            self.assertEqual(path.stat().st_mode & 0o777, 0o700)
        self.assertEqual((destination / ".env").read_bytes(), (self.stack / ".env").read_bytes())

    def test_retention_preserves_foreign_and_partial_directories(self):
        first = backup_module.backup(self.stack, self.root, retention=1)
        foreign = self.root / "sably-emdash-20000101T000000Z-12345678"
        foreign.mkdir()
        (foreign / "keep.txt").write_text("not produced by this installation")
        partial = self.root / ".sably-emdash-20000101T000000Z-12345678.partial"
        partial.mkdir()
        second = backup_module.backup(self.stack, self.root, retention=1)
        self.assertFalse((self.root / first["backup"]).exists())
        self.assertTrue((self.root / second["backup"]).exists())
        self.assertTrue((foreign / "keep.txt").exists())
        self.assertTrue(partial.exists())
        self.assertEqual(second["retiredBackups"], 1)

    def test_competing_process_lock_skips_without_creating_snapshot(self):
        backup_module.private_directory(self.root)
        with (self.root / ".backup.lock").open("w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(backup_module.backup(self.stack, self.root)["status"], "skipped")
        self.assertFalse(any(path.is_dir() for path in self.root.iterdir()))

    def test_symlink_upload_fails_without_retiring_previous_backup(self):
        first = backup_module.backup(self.stack, self.root, retention=1)
        (self.stack / "data" / "uploads" / "external").symlink_to(self.stack / ".env")
        with self.assertRaises(ValueError):
            backup_module.backup(self.stack, self.root, retention=1)
        self.assertTrue((self.root / first["backup"]).exists())
        self.assertFalse(any(path.name.endswith(".partial") for path in self.root.iterdir()))


if __name__ == "__main__":
    unittest.main()
