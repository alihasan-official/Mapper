TypeScript migration scaffold

What I added
- `tsconfig.json` with `strict` enabled and strict null checks.
- `package.json` with `build` and `watch` scripts and devDependencies (typescript, @types/leaflet, @types/jquery).
- `src/types/index.d.ts` with initial interfaces for Marker, Shape, User, and Nominatim.

How to run
1. Install dev dependencies locally:

```powershell
npm install
```

2. Run TypeScript compiler (this will type-check the current JS but not yet convert files):

```powershell
npm run build
```

Notes
- I kept `allowJs: true` so you can run `tsc` against existing JS files and iterate gradually.
- Next steps (recommended):
  1. Convert `src/main.js` to `src/main.ts` (or `src/main.tsx` if React is introduced later) incrementally. Keep original JS until green.
  2. Replace `any` in types with more precise types as you discover shapes of objects from Firebase.
  3. Install `@types/firebase` if needed and add exact Firebase types.
  4. Add tests and linting as needed.

If you want, I can now:
- Convert `src/main.js` into `src/main.ts` (copy) and attempt to fix the most common type errors automatically, iterating until `tsc` passes.
- Or do a smaller step: run `npm install` and `npm run build` and show the type errors produced by `tsc` so we can fix them iteratively.
