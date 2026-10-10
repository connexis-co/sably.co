#!/usr/bin/env python3
"""Back up the local Sably stack without exposing environment values."""

import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import sys
import time
import uuid

CREATOR = "sably-emdash-backup-v1"
NAME_PATTERN = re.compile(r"^sably-emdash-\d{8}T\d{6}Z-[a-f0-9]{8}$")
DATABASES = ("emdash.db", "sably.db")


def private_directory(path):
    if path.is_symlink():
        raise ValueError("Backup directories must not be symbolic links")
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not path.is_dir():
        raise ValueError("Expected a directory")
    path.chmod(0o700)


def regular_file(path):
    if not stat.S_ISREG(path.lstat().st_mode):
        raise ValueError("Expected a regular file; symlinks are not accepted")


def digest(path):
    checksum = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def copy_private(source, destination):
    regular_file(source)
    descriptor = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(descriptor)
        with os.fdopen(descriptor, "rb", closefd=False) as incoming:
            with destination.open("xb") as outgoing:
                shutil.copyfileobj(incoming, outgoing, 1024 * 1024)
                outgoing.flush()
                os.fsync(outgoing.fileno())
        after = os.fstat(descriptor)
        if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise RuntimeError("A source file changed during its backup; retry later")
        destination.chmod(0o600)
    finally:
        os.close(descriptor)


def copy_uploads(source, destination):
    if source.is_symlink() or not source.is_dir():
        raise ValueError("Uploads must be an existing directory, not a symlink")
    private_directory(destination)
    for current, directories, filenames in os.walk(source, followlinks=False):
        current = Path(current)
        target = destination / current.relative_to(source)
        for name in directories:
            if (current / name).is_symlink():
                raise ValueError("Uploads contain a symlink")
            private_directory(target / name)
        for name in filenames:
            copy_private(current / name, target / name)


def open_snapshot(path, timeout):
    regular_file(path)
    connection = sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=timeout)
    try:
        connection.execute("PRAGMA query_only=ON")
        connection.execute("BEGIN")
        # Establish the read transaction now, before copying either database.
        connection.execute("SELECT count(*) FROM sqlite_schema").fetchone()
        return connection
    except BaseException:
        connection.close()
        raise


def save_snapshot(source, path, timeout):
    deadline = time.monotonic() + timeout

    def progress(_status, _remaining, _total):
        if time.monotonic() > deadline:
            raise TimeoutError("SQLite backup exceeded its time budget")

    destination = sqlite3.connect(path)
    try:
        source.backup(destination, pages=256, progress=progress, sleep=0.05)
        result = destination.execute("PRAGMA quick_check").fetchall()
        if result != [("ok",)]:
            raise RuntimeError("SQLite backup integrity check failed")
        destination.execute("PRAGMA journal_mode=DELETE")
    finally:
        destination.close()
    path.chmod(0o600)


def read_owner(root):
    marker = root / ".backup-owner"
    if not marker.exists():
        with marker.open("x", encoding="utf8") as output:
            output.write(str(uuid.uuid4()) + "\n")
    regular_file(marker)
    marker.chmod(0o600)
    return str(uuid.UUID(marker.read_text(encoding="utf8").strip()))


def validate_owned_backup(path, owner):
    if not NAME_PATTERN.fullmatch(path.name) or path.is_symlink() or not path.is_dir():
        return False
    try:
        manifest_path = path / "manifest.json"
        regular_file(manifest_path)
        checksum_path = path / "manifest.sha256"
        regular_file(checksum_path)
        if checksum_path.read_text(encoding="utf8").strip() != f"{digest(manifest_path)}  manifest.json":
            return False
        manifest = json.loads(manifest_path.read_text(encoding="utf8"))
        if (manifest.get("creator"), manifest.get("backupRootId"), manifest.get("name"), manifest.get("complete")) != (CREATOR, owner, path.name, True):
            return False
        if manifest.get("schemaVersion") != 1 or not isinstance(manifest.get("files"), dict):
            return False
        datetime.fromisoformat(manifest["createdAt"])
        for required in (*DATABASES, ".env"):
            regular_file(path / required)
            if not re.fullmatch(r"[a-f0-9]{64}", manifest["files"][required]["sha256"]):
                return False
        return (path / "uploads").is_dir() and not (path / "uploads").is_symlink()
    except (OSError, ValueError, KeyError, TypeError):
        return False


def retain_backups(root, owner, keep):
    owned = sorted(
        (path for path in root.iterdir() if validate_owned_backup(path, owner)),
        key=lambda path: json.loads((path / "manifest.json").read_text(encoding="utf8"))["createdAt"],
        reverse=True,
    )
    removed = 0
    for path in owned[keep:]:
        # Only immediate, complete directories created by this installation.
        if path.parent != root:
            raise ValueError("Invalid retention path")
        shutil.rmtree(path)
        removed += 1
    return removed


def backup(stack, root, retention=14, timeout=300):
    os.umask(0o077)
    stack = Path(stack).absolute()
    root = Path(root).absolute()
    if stack.is_symlink() or (stack / "data").is_symlink():
        raise ValueError("Stack and data directories must not be symlinks")
    if root == stack or root.is_relative_to(stack):
        raise ValueError("Keep backups outside the application stack")
    private_directory(root)
    lock_path = root / ".backup.lock"
    lock_fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    with os.fdopen(lock_fd, "a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return {"status": "skipped", "reason": "backup already running"}
        owner = read_owner(root)
        created_at = datetime.now(timezone.utc)
        name = f"sably-emdash-{created_at:%Y%m%dT%H%M%SZ}-{uuid.uuid4().hex[:8]}"
        temporary = root / f".{name}.partial"
        destination = root / name
        private_directory(temporary)
        try:
            with ExitStack() as resources:
                snapshots = {}
                for filename in DATABASES:
                    source = open_snapshot(stack / "data" / filename, timeout)
                    resources.callback(source.close)
                    snapshots[filename] = source
                for filename, source in snapshots.items():
                    save_snapshot(source, temporary / filename, timeout)
                copy_uploads(stack / "data" / "uploads", temporary / "uploads")
                copy_private(stack / ".env", temporary / ".env")
            files = {}
            for path in sorted(temporary.rglob("*")):
                if path.is_file():
                    files[path.relative_to(temporary).as_posix()] = {"bytes": path.stat().st_size, "sha256": digest(path)}
            manifest = {
                "schemaVersion": 1, "creator": CREATOR, "backupRootId": owner,
                "name": name, "complete": True, "createdAt": created_at.isoformat(),
                "databaseConsistency": "independent SQLite read transactions",
                "files": files,
            }
            manifest_path = temporary / "manifest.json"
            with manifest_path.open("x", encoding="utf8") as output:
                json.dump(manifest, output, indent=2)
                output.write("\n")
                output.flush()
                os.fsync(output.fileno())
            manifest_path.chmod(0o600)
            with (temporary / "manifest.sha256").open("x", encoding="utf8") as output:
                output.write(f"{digest(manifest_path)}  manifest.json\n")
                output.flush()
                os.fsync(output.fileno())
            (temporary / "manifest.sha256").chmod(0o600)
            temporary.rename(destination)
            root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(root_fd)
            finally:
                os.close(root_fd)
        except BaseException:
            if temporary.exists():
                shutil.rmtree(temporary)
            raise
        removed = retain_backups(root, owner, retention)
        return {"status": "ok", "backup": name, "files": len(files), "retiredBackups": removed}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stack-dir", type=Path, default=Path("/opt/stacks/sably-emdash"))
    parser.add_argument("--backup-dir", type=Path, default=Path("/var/backups/sably-emdash"))
    parser.add_argument("--retention", type=int, default=14, help="Completed snapshots to keep (default: 14)")
    parser.add_argument("--timeout", type=int, default=300, help="Maximum seconds per SQLite backup")
    args = parser.parse_args()
    if args.retention < 1 or args.timeout < 1:
        parser.error("retention and timeout must be positive")
    try:
        result = backup(args.stack_dir, args.backup_dir, args.retention, args.timeout)
    except Exception as error:
        # Exception text may contain paths or database content; keep logs generic.
        print(json.dumps({"status": "error", "type": type(error).__name__, "message": "Backup failed; no incomplete snapshot was retained"}), file=sys.stderr)
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
