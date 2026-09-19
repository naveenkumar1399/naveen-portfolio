#!/usr/bin/env python3
"""Import a SCORM 1.2 package into the portfolio player.

Usage:
    python3 tools/import-scorm.py <package.zip> <course-slug> [--root DIR]

The script unzips the package into assets/scorm/<course-slug>/, reads the
launch file from imsmanifest.xml, and updates assets/scorm/courses.json so the
player can launch it.
"""

from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


def local_name(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def attr_by_suffix(element: ET.Element, suffix: str) -> str:
    for name, value in element.attrib.items():
        if local_name(name) == suffix:
            return value
    return ""


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    destination = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if destination != target and destination not in target.parents:
            raise SystemExit("Refusing to extract unsafe path: %s" % member.filename)
    archive.extractall(destination)


def find_manifest(destination: Path) -> Path:
    manifests = sorted(destination.rglob("imsmanifest.xml"), key=lambda p: len(p.parts))
    if not manifests:
        raise SystemExit("No imsmanifest.xml found in the package.")
    return manifests[0]


def find_launch_file(manifest_path: Path) -> str:
    try:
        tree = ET.parse(manifest_path)
    except ET.ParseError as error:
        raise SystemExit("Could not parse imsmanifest.xml: %s" % error)

    resources = [el for el in tree.getroot().iter() if local_name(el.tag) == "resource"]
    if not resources:
        raise SystemExit("No <resource> entries found in imsmanifest.xml.")

    scos = [
        res
        for res in resources
        if attr_by_suffix(res, "scormtype").lower() == "sco" and res.get("href")
    ]
    candidates = scos or [res for res in resources if res.get("href")]

    if not candidates:
        raise SystemExit("No launchable resource with an href was found.")

    href = candidates[0].get("href", "").strip()
    return href.split("?")[0].split("#")[0]


def load_courses(courses_file: Path) -> dict:
    if not courses_file.is_file():
        raise SystemExit("Course registry not found: %s" % courses_file)
    return json.loads(courses_file.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="Import a SCORM 1.2 package.")
    parser.add_argument("package", help="Path to the SCORM .zip package")
    parser.add_argument("slug", help="Course slug from assets/scorm/courses.json")
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parent.parent),
        help="Project root (defaults to the repository root)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    scorm_dir = root / "assets" / "scorm"
    courses_file = scorm_dir / "courses.json"
    package = Path(args.package).expanduser().resolve()

    if not package.is_file():
        raise SystemExit("Package not found: %s" % package)
    if package.suffix.lower() != ".zip":
        raise SystemExit("Expected a .zip SCORM package, got: %s" % package.name)

    data = load_courses(courses_file)
    courses = data.get("courses", [])
    course = next((item for item in courses if item.get("slug") == args.slug), None)

    if course is None:
        available = ", ".join(item.get("slug", "?") for item in courses) or "(none)"
        raise SystemExit(
            "Unknown slug '%s'. Add it to %s first.\nAvailable slugs: %s"
            % (args.slug, courses_file, available)
        )

    destination = (scorm_dir / args.slug).resolve()
    destination.mkdir(parents=True, exist_ok=True)

    print("Extracting %s -> %s" % (package.name, destination.relative_to(root)))
    with zipfile.ZipFile(package) as archive:
        safe_extract(archive, destination)

    manifest = find_manifest(destination)
    href = find_launch_file(manifest)
    launch_path = (manifest.parent / href).resolve()

    try:
        launch_relative = launch_path.relative_to(root).as_posix()
    except ValueError:
        raise SystemExit("Launch file resolved outside the project root.")

    if not launch_path.is_file():
        raise SystemExit("Launch file listed in the manifest was not found: %s" % href)

    course["launch"] = launch_relative
    course["available"] = True
    course.setdefault("scormVersion", "1.2")

    courses_file.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print("Launch file: %s" % launch_relative)
    print("Updated: %s" % courses_file.relative_to(root))
    print("Done. Reload the player page to run '%s'." % course.get("title", args.slug))
    print("Note: keep individual package files under 100 MB for GitHub.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
