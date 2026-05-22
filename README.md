# adhoc_projects

A monorepo of small, self-contained experimental projects. Each subfolder is a standalone experiment with its own README, build, and dependencies — they're not workspaces of a single npm tree.

## Layout

Each project lives in its own top-level folder:

```
adhoc_projects/
├── README.md                  ← this file
├── biometric-vault-lab/       ← biometric-only frontend-only offline-first vault
└── (future experiments)
```

To work on any one project:

```sh
cd <project-folder>
npm install
# follow that project's own README
```

## Projects

### biometric-vault-lab

A throwaway-safe lab proving out a biometric-only, frontend-only, offline-first local vault. Two reusable SDK packages (`@muulorigin/biometric-vault-core` + `@muulorigin/biometric-vault-react`) plus a demo PWA harness. Designed to drop into the cryptjs monorepo as sibling packages once stabilised. Status: complete (4 of 4 build phases), verified on Windows / Android / iPhone with real biometric hardware.

See [`biometric-vault-lab/PROJECT_OVERVIEW.md`](biometric-vault-lab/PROJECT_OVERVIEW.md) for the full handoff document.

## Conventions for new experiments

When you add a new project to this repo, follow this checklist so the umbrella stays navigable:

1. **One folder per experiment.** Don't share dependencies or build steps across projects — each one should be `cd <folder> && npm install && npm run dev`.
2. **Each project carries its own `README.md`** at minimum, explaining what it is, how to run it, and what it's for.
3. **No giant binaries committed.** Use `.gitignore` per folder to exclude `node_modules/`, build outputs, and lockfiles you don't need to share. Vendored dependencies (like `vendor/cryptjs/` in the biometric vault) are an exception when the consuming project needs pre-built artifacts.
4. **Add a one-line entry to this README** under "Projects" when you add a new folder. Link to that project's own README or overview doc.
5. **License each project independently** if they have different licenses. Default is MIT.

## License

MIT, unless a specific project says otherwise.
