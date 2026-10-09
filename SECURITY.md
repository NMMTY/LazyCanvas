# Security Policy

## Supported versions

Security fixes are released for the latest `1.x` version of every package.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Report them privately through
[GitHub's private vulnerability reporting](https://github.com/NMMTY/LazyCanvas/security/advisories/new).

Include what you found, how to reproduce it and which versions are affected. You can expect an
acknowledgement within a few days; we will keep you informed while we work on a fix and credit you
in the release notes if you wish.

## Scope notes

- LazyCanvas renders whatever you hand it. Treat scene descriptions (JSON/YAML) and image URLs
  from untrusted users like any other untrusted input: validate them, and restrict which hosts
  images may be loaded from.
- `@nmmty/lazycanvas/node` reads and writes files with the paths you pass it. Do not build those
  paths from untrusted input.
