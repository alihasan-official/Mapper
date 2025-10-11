# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Updated ESLint configuration (.eslintrc.js) to include browser environment and global definitions for jQuery ($), Leaflet (L), Firebase, Turf, and other libraries, reducing lint errors.
- Added ignorePatterns to exclude minified leaflet.min.js from linting.
- Replaced 'any' types in types/index.d.ts with more specific types (GeoJSON.GeoJsonObject for geoJSON, unknown for FirebaseFeature) to eliminate TypeScript warnings.

### Added
- Created TODO.md for tracking codebase review and fixes.
- Created CHANGELOG.md for documenting changes.

### Changed
- Improved type safety in application types.
